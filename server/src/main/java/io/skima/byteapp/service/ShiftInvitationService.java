package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.InvitationStatus;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftInvitation;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.dto.ShiftInvitationRequest;
import io.skima.byteapp.repository.ShiftInvitationRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.ShiftRepository;
import io.skima.byteapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShiftInvitationService {

    private static final int DEFAULT_EXPIRES_MIN = 60;

    private final ShiftInvitationRepository inviteRepository;
    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;
    private final ShiftMatchRepository matchRepository;
    private final PushNotificationService pushService;

    @Transactional
    public ShiftInvitation create(User owner, ShiftInvitationRequest req) {
        if (owner.getRole() != UserRole.OWNER) {
            throw BusinessException.forbidden("점주만 초대 가능");
        }
        Shift shift = shiftRepository.findById(req.shiftId())
                .orElseThrow(() -> BusinessException.notFound("시프트를 찾을 수 없습니다"));
        if (!shift.getCafe().getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 매장의 시프트가 아닙니다");
        }
        if (shift.getStatus() != ShiftStatus.OPEN) {
            throw BusinessException.conflict("이미 매칭이 확정된 시프트입니다");
        }
        User worker = userRepository.findById(req.workerId())
                .orElseThrow(() -> BusinessException.notFound("워커를 찾을 수 없습니다"));
        if (worker.getRole() != UserRole.WORKER) {
            throw BusinessException.badRequest("워커가 아닙니다");
        }
        // 같은 워커에게 같은 시프트 중복 초대 방지
        var existing = inviteRepository.findByShiftIdAndWorkerId(req.shiftId(), req.workerId());
        if (existing.isPresent() && existing.get().getStatus() == InvitationStatus.PENDING) {
            throw BusinessException.conflict("이미 초대한 워커입니다");
        }

        int minutes = req.expiresInMinutes() != null && req.expiresInMinutes() > 0
                ? req.expiresInMinutes() : DEFAULT_EXPIRES_MIN;
        ShiftInvitation inv = ShiftInvitation.builder()
                .shift(shift)
                .worker(worker)
                .owner(owner)
                .message(req.message())
                .expiresAt(LocalDateTime.now().plusMinutes(minutes))
                .build();
        var saved = inviteRepository.save(inv);

        // 워커에게 푸시
        pushService.sendToUser(
                worker,
                "★ " + shift.getCafe().getName() + " 점주 직접 호출",
                fmtTime(shift.getStartAt()) + " 시작 · 시급 ₩"
                        + String.format("%,d", shift.getHourlyWage()) + " · " + minutes + "분 안에 응답",
                "/worker/invitations");
        return saved;
    }

    /**
     * 워커 수락 — ShiftMatch 자동 생성. 다른 PENDING 초대(같은 시프트)는 자동 EXPIRED.
     */
    @Transactional
    public ShiftMatch accept(User worker, Long invitationId) {
        ShiftInvitation inv = inviteRepository.findById(invitationId)
                .orElseThrow(() -> BusinessException.notFound("초대를 찾을 수 없습니다"));
        if (!inv.getWorker().getId().equals(worker.getId())) {
            throw BusinessException.forbidden("본인 초대만 응답 가능");
        }
        if (inv.getStatus() != InvitationStatus.PENDING) {
            throw BusinessException.conflict("이미 응답한 초대입니다");
        }
        if (inv.getExpiresAt().isBefore(LocalDateTime.now())) {
            inv.expire();
            throw BusinessException.conflict("초대가 만료되었습니다");
        }
        Shift shift = inv.getShift();
        if (shift.getStatus() != ShiftStatus.OPEN) {
            throw BusinessException.conflict("이미 매칭이 확정된 시프트입니다");
        }

        // ShiftMatch 생성 + 시프트 MATCHED 전이
        ShiftMatch match = ShiftMatch.builder()
                .shift(shift)
                .worker(worker)
                .build();
        match = matchRepository.save(match);
        shift.markMatched(LocalDateTime.now());
        inv.accept();

        // 같은 시프트의 다른 PENDING 초대는 자동 EXPIRED (점주가 여러명에게 동시 초대한 경우)
        // (단순화: 직접 호출은 보통 1명에게만 보냄. 멀티 초대는 향후 확장)

        // 점주에게 푸시
        pushService.sendToUser(
                inv.getOwner(),
                "✅ " + worker.getName() + " 워커가 초대 수락",
                shift.getCafe().getName() + " · 매칭 확정",
                "/owner/shift/" + shift.getId());
        return match;
    }

    @Transactional
    public ShiftInvitation reject(User worker, Long invitationId) {
        ShiftInvitation inv = inviteRepository.findById(invitationId)
                .orElseThrow(() -> BusinessException.notFound("초대를 찾을 수 없습니다"));
        if (!inv.getWorker().getId().equals(worker.getId())) {
            throw BusinessException.forbidden("본인 초대만 응답 가능");
        }
        if (inv.getStatus() != InvitationStatus.PENDING) {
            throw BusinessException.conflict("이미 응답한 초대입니다");
        }
        inv.reject();
        // 점주에게 알림
        pushService.sendToUser(
                inv.getOwner(),
                worker.getName() + " 워커 초대 거절",
                inv.getShift().getCafe().getName() + " · 다른 워커를 찾아주세요",
                "/owner/worker-pool");
        return inv;
    }

    @Transactional(readOnly = true)
    public List<ShiftInvitation> myWorkerInvitations(User worker) {
        return inviteRepository.findAllByWorkerIdAndStatusOrderByCreatedAtDesc(
                worker.getId(), InvitationStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public List<ShiftInvitation> myOwnerInvitations(User owner) {
        return inviteRepository.findAllByOwnerIdOrderByCreatedAtDesc(owner.getId());
    }

    /** 매분 만료 처리 */
    @Scheduled(cron = "0 * * * * *")
    @Transactional
    public void expireDue() {
        var stale = inviteRepository.findAllByStatusAndExpiresAtBefore(
                InvitationStatus.PENDING, LocalDateTime.now());
        for (var inv : stale) {
            inv.expire();
        }
        if (!stale.isEmpty()) {
            log.info("[INVITE] expired {} invitations", stale.size());
        }
    }

    private static String fmtTime(LocalDateTime t) {
        if (t == null) return "";
        return String.format("%02d/%02d %02d:%02d",
                t.getMonthValue(), t.getDayOfMonth(), t.getHour(), t.getMinute());
    }
}
