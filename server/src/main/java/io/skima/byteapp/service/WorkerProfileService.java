package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.dto.RatingResponse;
import io.skima.byteapp.dto.WorkerProfileResponse;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.UserRepository;
import io.skima.byteapp.repository.WorkerFavoriteCafeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkerProfileService {

    private final UserRepository userRepository;
    private final RatingRepository ratingRepository;
    private final ShiftMatchRepository matchRepository;
    private final WorkerStatsService workerStatsService;
    private final WorkerFavoriteCafeRepository workerFavoriteCafeRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MM/dd");

    @Transactional(readOnly = true)
    public WorkerProfileResponse buildProfile(Long workerId) {
        User worker = userRepository.findById(workerId)
                .orElseThrow(() -> BusinessException.notFound("워커를 찾을 수 없습니다"));
        if (worker.getRole() != UserRole.WORKER) {
            throw BusinessException.badRequest("워커가 아닙니다");
        }

        var stats = workerStatsService.computeForWorker(workerId);

        // 받은 평가 (점주→워커)
        List<Rating> received = ratingRepository.findAllByWorkerIdAndDirection(
                workerId, RatingDirection.OWNER_TO_WORKER);
        int[] dist = new int[5];
        for (Rating r : received) {
            int idx = r.getScore() - 1;
            if (idx >= 0 && idx < 5) dist[idx]++;
        }

        List<RatingResponse> recentReviews = received.stream()
                .limit(8)
                .map(RatingResponse::from)
                .toList();

        List<ShiftMatch> allMatches = matchRepository.findAllByWorkerId(workerId);

        // 평판 시그널: 재고용률 + 정시·지각 카운트 + 평균 근무시간
        Map<Long, Long> matchesPerCafe = new HashMap<>();
        for (ShiftMatch m : allMatches) {
            if (m.getStatus() == MatchStatus.NO_SHOW || m.getStatus() == MatchStatus.CANCELED) continue;
            matchesPerCafe.merge(m.getShift().getCafe().getId(), 1L, Long::sum);
        }
        long uniqueCafes = matchesPerCafe.size();
        long rehiredCafes = matchesPerCafe.values().stream().filter(v -> v >= 2).count();
        Double rehireRate = uniqueCafes == 0 ? null : (double) rehiredCafes / uniqueCafes;

        int onTime = 0;
        int late = 0;
        long totalMinutes = 0;
        int workedCount = 0;
        for (ShiftMatch m : allMatches) {
            if (m.getCheckInAt() != null) {
                long diff = Duration.between(m.getShift().getStartAt(), m.getCheckInAt()).toMinutes();
                if (diff <= 5) onTime++;
                else late++;
            }
            if (m.getCheckInAt() != null && m.getCheckOutAt() != null) {
                long mins = Duration.between(m.getCheckInAt(), m.getCheckOutAt()).toMinutes();
                if (mins > 0) {
                    totalMinutes += mins;
                    workedCount++;
                }
            }
        }
        Long avgWorkMinutes = workedCount == 0 ? null : totalMinutes / workedCount;

        int favoriteCafeCount = workerFavoriteCafeRepository.findAllByWorkerIdOrderByCreatedAtDesc(workerId).size();

        // 최근 매칭 (8개)
        List<WorkerProfileResponse.MatchSummary> recentMatches = allMatches.stream()
                .limit(8)
                .map(m -> new WorkerProfileResponse.MatchSummary(
                        m.getId(),
                        m.getShift().getId(),
                        m.getShift().getCafe().getId(),
                        m.getShift().getCafe().getName(),
                        m.getShift().getStartAt().format(DATE_FMT),
                        m.getStatus().name()
                ))
                .toList();

        return new WorkerProfileResponse(
                workerId,
                worker.getName(),
                worker.getProfileImage(),
                worker.getSelfReportedLevel() == null ? null : worker.getSelfReportedLevel().name(),
                worker.getCapableRoles() == null ? java.util.Set.of()
                        : worker.getCapableRoles().stream().map(Enum::name).collect(Collectors.toSet()),
                worker.getCertifications() == null ? java.util.Set.of() : worker.getCertifications(),
                worker.getBio(),
                worker.getExperienceYears(),
                worker.getAvailableHours(),
                worker.getHealthCertStatus() == null ? null : worker.getHealthCertStatus().name(),
                stats,
                rehireRate,
                favoriteCafeCount,
                onTime,
                late,
                avgWorkMinutes,
                dist,
                recentReviews,
                recentMatches
        );
    }

}
