package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.config.SkimaProperties;
import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftApplication;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftApplicationRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

/**
 * 노쇼 0% 보장 — 시작+graceMinutes 까지 체크인 없으면 자동 NO_SHOW 처리 후
 * 같은 시프트의 가장 오래된 PENDING 지원자를 자동 백업 매칭한다.
 * 백업 후보가 없으면 시프트를 OPEN으로 되돌려 재모집한다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoShowService {

    private final ShiftMatchRepository matchRepository;
    private final ShiftApplicationRepository applicationRepository;
    private final ShiftRepository shiftRepository;
    private final RatingRepository ratingRepository;
    private final SkimaProperties props;
    private final io.skima.byteapp.repository.WorkerFavoriteCafeRepository workerFavoriteCafeRepository;

    public record NoShowOutcome(int noShowCount, int backupMatchedCount, int reopenedCount) {}

    public record ManualNoShowOutcome(
            boolean backupMatched,
            boolean shiftReopened,
            String backupWorkerName,
            Long backupMatchId,
            int favoritingWorkerCount
    ) {}

    @Transactional
    public NoShowOutcome sweep() {
        int graceMin = props.getNoShow().getGraceMinutes();
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(graceMin);
        List<ShiftMatch> candidates = matchRepository.findNoShowCandidates(cutoff);

        int noShowCnt = 0;
        int backupCnt = 0;
        int reopenedCnt = 0;
        for (ShiftMatch m : candidates) {
            m.markNoShow();
            noShowCnt++;
            log.info("[NOSHOW] match={} shift={} worker={} → NO_SHOW",
                    m.getId(), m.getShift().getId(), m.getWorker().getName());

            Shift shift = m.getShift();
            if (tryBackupMatch(shift)) {
                backupCnt++;
            } else {
                shift.markOpen();
                reopenedCnt++;
                log.info("[NOSHOW] shift={} 백업 후보 없음 → OPEN 으로 재모집", shift.getId());
            }
        }
        return new NoShowOutcome(noShowCnt, backupCnt, reopenedCnt);
    }

    /**
     * 점주가 직접 노쇼 신고 — 자동 ★1 평가 + 백업 매칭.
     * match.status = MATCHED 일 때만 가능 (체크인 후는 다른 분쟁 영역).
     */
    @Transactional
    public ManualNoShowOutcome reportByOwner(User owner, Long matchId) {
        ShiftMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));
        Shift shift = match.getShift();
        if (!shift.getCafe().getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 매장의 매칭이 아닙니다");
        }
        if (match.getStatus() != MatchStatus.MATCHED) {
            throw BusinessException.conflict(
                    "노쇼 등록은 체크인 전에만 가능합니다 (현재: " + match.getStatus() + ")");
        }

        match.markNoShow();
        log.info("[NOSHOW_MANUAL] match={} shift={} worker={} → NO_SHOW (점주 신고)",
                match.getId(), shift.getId(), match.getWorker().getName());

        // 자동 ★1 평가 (이미 있으면 skip — 보통 없음)
        if (!ratingRepository.existsByMatchIdAndDirection(match.getId(), RatingDirection.OWNER_TO_WORKER)) {
            Rating auto = Rating.builder()
                    .match(match)
                    .worker(match.getWorker())
                    .owner(owner)
                    .direction(RatingDirection.OWNER_TO_WORKER)
                    .score(1)
                    .willRehire(false)
                    .comment("워커 미출근 — 점주 등록")
                    .build();
            ratingRepository.save(auto);
        }

        // 백업 매칭 시도 — 결과로 워커 이름·매치 ID 추출
        BackupResult backup = tryBackupMatchWithResult(shift);
        boolean reopened = false;
        if (!backup.matched) {
            shift.markOpen();
            reopened = true;
            log.info("[NOSHOW_MANUAL] shift={} 백업 후보 없음 → OPEN 으로 재모집", shift.getId());
        }
        // 재모집 시 즐겨찾기 매장으로 등록한 워커 수 — 단골 알림 안내용
        int favCount = reopened
                ? workerFavoriteCafeRepository.findWorkerIdsByCafeId(shift.getCafe().getId()).size()
                : 0;
        return new ManualNoShowOutcome(
                backup.matched,
                reopened,
                backup.workerName,
                backup.matchId,
                favCount);
    }

    private boolean tryBackupMatch(Shift shift) {
        return tryBackupMatchWithResult(shift).matched;
    }

    private BackupResult tryBackupMatchWithResult(Shift shift) {
        ShiftApplication next = applicationRepository
                .findAllByShiftIdOrderByAppliedAtAsc(shift.getId()).stream()
                .filter(a -> a.getStatus() == ApplicationStatus.PENDING)
                .min(Comparator.comparing(ShiftApplication::getAppliedAt))
                .orElse(null);
        if (next == null) return new BackupResult(false, null, null);

        next.accept();
        // 다른 PENDING 모두 거절
        applicationRepository.findAllByShiftIdOrderByAppliedAtAsc(shift.getId()).stream()
                .filter(a -> a.getStatus() == ApplicationStatus.PENDING && !a.getId().equals(next.getId()))
                .forEach(ShiftApplication::reject);

        ShiftMatch backup = ShiftMatch.builder()
                .shift(shift)
                .worker(next.getWorker())
                .build();
        ShiftMatch saved = matchRepository.save(backup);
        log.info("[NOSHOW] shift={} → 백업 매칭 worker={}", shift.getId(), next.getWorker().getName());
        // shift status 는 MATCHED 유지
        return new BackupResult(true, next.getWorker().getName(), saved.getId());
    }

    private record BackupResult(boolean matched, String workerName, Long matchId) {}
}
