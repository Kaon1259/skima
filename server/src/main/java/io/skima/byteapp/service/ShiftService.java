package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.dto.ShiftCreateRequest;
import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.ShiftApplication;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.repository.CafeRepository;
import io.skima.byteapp.repository.ShiftApplicationRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ShiftService {

    private final ShiftRepository shiftRepository;
    private final CafeRepository cafeRepository;
    private final ShiftMatchRepository matchRepository;
    private final ShiftApplicationRepository applicationRepository;
    private final io.skima.byteapp.repository.WorkerFavoriteCafeRepository workerFavoriteCafeRepository;
    private final io.skima.byteapp.repository.UserRepository userRepository;
    private final PushNotificationService pushService;

    @Transactional
    public Shift create(User owner, ShiftCreateRequest req) {
        if (owner.getRole() != UserRole.OWNER) {
            throw BusinessException.forbidden("점주만 시프트를 등록할 수 있습니다");
        }
        Cafe cafe = cafeRepository.findById(req.cafeId())
                .orElseThrow(() -> BusinessException.notFound("매장을 찾을 수 없습니다"));
        if (!cafe.getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 소유 매장이 아닙니다");
        }
        if (!req.endAt().isAfter(req.startAt())) {
            throw BusinessException.badRequest("종료시각은 시작시각보다 이후여야 합니다");
        }

        Shift shift = Shift.builder()
                .cafe(cafe)
                .startAt(req.startAt())
                .endAt(req.endAt())
                .hourlyWage(req.hourlyWage())
                .headcount(req.headcount())
                .description(req.description())
                .jobRole(req.jobRole())
                .minSkill(req.minSkill())
                .requirements(req.requirements())
                .build();
        var saved = shiftRepository.save(shift);

        // 단골 워커들에게 푸시 — 즐겨찾기 매장 새 시프트
        var favWorkerIds = workerFavoriteCafeRepository.findWorkerIdsByCafeId(cafe.getId());
        if (!favWorkerIds.isEmpty()) {
            var favWorkers = userRepository.findAllById(favWorkerIds);
            pushService.sendToUsers(
                    favWorkers,
                    "⭐ " + cafe.getName() + " 새 시프트",
                    fmtPushTime(saved.getStartAt()) + " 시작 · 시급 ₩" + String.format("%,d", saved.getHourlyWage()),
                    "/cafe/" + cafe.getId());
        }

        return saved;
    }

    private static String fmtPushTime(java.time.LocalDateTime t) {
        if (t == null) return "";
        return String.format("%02d/%02d %02d:%02d",
                t.getMonthValue(), t.getDayOfMonth(), t.getHour(), t.getMinute());
    }

    @Transactional(readOnly = true)
    public List<Shift> findOpenShifts() {
        return shiftRepository.findAllByStatusOrderByStartAtAsc(ShiftStatus.OPEN);
    }

    @Transactional(readOnly = true)
    public List<Shift> findMyShifts(User owner) {
        return shiftRepository.findAllByOwnerId(owner.getId());
    }

    @Transactional(readOnly = true)
    public Shift findById(Long id) {
        return shiftRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("시프트를 찾을 수 없습니다"));
    }

    /** 일괄 등록 — 시작일부터 repeatDays 윈도우 내에서 daysOfWeek 매치되는 날만 (null/empty 면 매일) */
    @Transactional
    public List<Shift> createBulk(User owner, io.skima.byteapp.dto.BulkShiftCreateRequest req) {
        if (owner.getRole() != UserRole.OWNER) {
            throw BusinessException.forbidden("점주만 시프트를 등록할 수 있습니다");
        }
        Cafe cafe = cafeRepository.findById(req.cafeId())
                .orElseThrow(() -> BusinessException.notFound("매장을 찾을 수 없습니다"));
        if (!cafe.getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 소유 매장이 아닙니다");
        }

        java.util.Set<java.time.DayOfWeek> dows =
                (req.daysOfWeek() == null || req.daysOfWeek().isEmpty())
                        ? java.util.EnumSet.allOf(java.time.DayOfWeek.class)
                        : java.util.EnumSet.copyOf(req.daysOfWeek());

        java.util.List<Shift> created = new java.util.ArrayList<>();
        for (int i = 0; i < req.repeatDays(); i++) {
            java.time.LocalDateTime start = req.firstStartAt().plusDays(i);
            if (!dows.contains(start.getDayOfWeek())) continue;
            java.time.LocalDateTime end = start.plusHours(req.durationHours());
            Shift s = Shift.builder()
                    .cafe(cafe)
                    .startAt(start)
                    .endAt(end)
                    .hourlyWage(req.hourlyWage())
                    .headcount(req.headcount() == null ? 1 : req.headcount())
                    .description(req.description())
                    .jobRole(req.jobRole())
                    .minSkill(req.minSkill())
                    .requirements(req.requirements())
                    .build();
            created.add(shiftRepository.save(s));
        }
        if (created.isEmpty()) {
            throw BusinessException.badRequest("선택한 요일과 반복 일수 조합으로 생성된 시프트가 없습니다");
        }
        return created;
    }

    /** 점주가 시프트 취소 — OPEN/MATCHED 상태에서만 가능. 대기 지원 자동 거절, 매칭 있으면 취소 */
    @Transactional
    public Shift cancel(User owner, Long shiftId) {
        Shift shift = findById(shiftId);
        if (!shift.getCafe().getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 소유 매장의 시프트가 아닙니다");
        }
        if (shift.getStatus() == ShiftStatus.IN_PROGRESS) {
            throw BusinessException.conflict("이미 근무가 시작된 시프트는 취소할 수 없습니다");
        }
        if (shift.getStatus() == ShiftStatus.COMPLETED || shift.getStatus() == ShiftStatus.CANCELED) {
            throw BusinessException.conflict("이미 종료된 시프트입니다");
        }

        // 대기 지원 일괄 거절
        for (ShiftApplication a : applicationRepository.findAllByShiftIdOrderByAppliedAtAsc(shiftId)) {
            if (a.getStatus() == ApplicationStatus.PENDING) a.reject();
        }
        // 매칭이 있었다면 같이 취소
        matchRepository.findActiveByShiftId(shiftId).ifPresent(ShiftMatch::cancel);

        shift.cancel();
        return shift;
    }
}
