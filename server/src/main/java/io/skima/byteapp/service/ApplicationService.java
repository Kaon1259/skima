package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftApplication;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.repository.ShiftApplicationRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ShiftService shiftService;
    private final ShiftApplicationRepository applicationRepository;
    private final ShiftMatchRepository matchRepository;

    /** 워커의 1탭 지원 */
    @Transactional
    public ShiftApplication apply(User worker, Long shiftId) {
        if (worker.getRole() != UserRole.WORKER) {
            throw BusinessException.forbidden("워커만 지원할 수 있습니다");
        }
        Shift shift = shiftService.findById(shiftId);
        if (shift.getStatus() != ShiftStatus.OPEN) {
            throw BusinessException.conflict("이미 마감된 시프트입니다");
        }
        applicationRepository.findByShiftIdAndWorkerId(shiftId, worker.getId())
                .ifPresent(a -> {
                    throw BusinessException.conflict("이미 지원한 시프트입니다");
                });

        ShiftApplication app = ShiftApplication.builder()
                .shift(shift)
                .worker(worker)
                .build();
        return applicationRepository.save(app);
    }

    /** 점주의 지원자 확정 — 매칭 SLA 측정 시점 */
    @Transactional
    public ShiftMatch accept(User owner, Long applicationId) {
        ShiftApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> BusinessException.notFound("지원 내역을 찾을 수 없습니다"));
        Shift shift = app.getShift();
        if (!shift.getCafe().getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 매장의 시프트가 아닙니다");
        }
        if (shift.getStatus() != ShiftStatus.OPEN) {
            throw BusinessException.conflict("이미 매칭이 확정된 시프트입니다");
        }
        if (app.getStatus() != ApplicationStatus.PENDING) {
            throw BusinessException.conflict("이미 처리된 지원입니다");
        }

        LocalDateTime now = LocalDateTime.now();
        app.accept();
        shift.markMatched(now);

        // 같은 시프트의 다른 PENDING 지원자는 자동 거절
        List<ShiftApplication> others = applicationRepository.findActiveByShiftId(
                shift.getId(), ApplicationStatus.WITHDRAWN);
        for (ShiftApplication other : others) {
            if (!other.getId().equals(app.getId()) && other.getStatus() == ApplicationStatus.PENDING) {
                other.reject();
            }
        }

        // 1시간 버퍼 룰 — 매칭된 워커가 다른 시프트에 걸어둔 PENDING 지원 중,
        // 시간대가 1시간 이내로 충돌하는 것은 자동 철회 (이중 매칭 방지)
        List<ShiftApplication> myOtherApps = applicationRepository.findAllByWorkerId(app.getWorker().getId());
        LocalDateTime bufferStart = shift.getStartAt().minusHours(BUFFER_HOURS);
        LocalDateTime bufferEnd = shift.getEndAt().plusHours(BUFFER_HOURS);
        for (ShiftApplication mine : myOtherApps) {
            if (mine.getId().equals(app.getId())) continue;
            if (mine.getStatus() != ApplicationStatus.PENDING) continue;
            Shift other = mine.getShift();
            if (other.getStartAt().isBefore(bufferEnd) && other.getEndAt().isAfter(bufferStart)) {
                mine.withdraw();
            }
        }

        ShiftMatch match = ShiftMatch.builder()
                .shift(shift)
                .worker(app.getWorker())
                .build();
        return matchRepository.save(match);
    }

    private static final int BUFFER_HOURS = 1;

    /** 워커 본인이 PENDING 지원 철회 */
    @Transactional
    public ShiftApplication withdraw(User worker, Long applicationId) {
        ShiftApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> BusinessException.notFound("지원 내역을 찾을 수 없습니다"));
        if (!app.getWorker().getId().equals(worker.getId())) {
            throw BusinessException.forbidden("본인 지원 내역이 아닙니다");
        }
        if (app.getStatus() != ApplicationStatus.PENDING) {
            throw BusinessException.conflict("대기 중인 지원만 철회할 수 있습니다");
        }
        app.withdraw();
        return app;
    }

    /** 시프트 ID 기반으로 워커가 자기 지원을 찾아 철회 (워커 화면에서 시프트 카드에서 직접 호출하기 편함) */
    @Transactional
    public ShiftApplication withdrawByShift(User worker, Long shiftId) {
        ShiftApplication app = applicationRepository.findByShiftIdAndWorkerId(shiftId, worker.getId())
                .orElseThrow(() -> BusinessException.notFound("이 시프트에 지원한 적이 없습니다"));
        return withdraw(worker, app.getId());
    }

    /** 점주가 시프트 취소 시 호출 — 모든 PENDING 지원을 일괄 거절 */
    @Transactional
    public int rejectAllPending(Long shiftId) {
        List<ShiftApplication> apps = applicationRepository.findAllByShiftIdOrderByAppliedAtAsc(shiftId);
        int count = 0;
        for (ShiftApplication a : apps) {
            if (a.getStatus() == ApplicationStatus.PENDING) {
                a.reject();
                count++;
            }
        }
        return count;
    }

    @Transactional(readOnly = true)
    public List<ShiftApplication> listByShift(Long shiftId) {
        return applicationRepository.findAllByShiftIdOrderByAppliedAtAsc(shiftId);
    }

    @Transactional(readOnly = true)
    public List<ShiftApplication> listByWorker(User worker) {
        return applicationRepository.findAllByWorkerId(worker.getId());
    }
}
