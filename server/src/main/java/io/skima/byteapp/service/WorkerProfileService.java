package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.dto.RatingResponse;
import io.skima.byteapp.dto.WorkerProfileResponse;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkerProfileService {

    private final UserRepository userRepository;
    private final RatingRepository ratingRepository;
    private final ShiftMatchRepository matchRepository;
    private final WorkerStatsService workerStatsService;

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

        // 최근 매칭 (8개)
        List<WorkerProfileResponse.MatchSummary> recentMatches = matchRepository.findAllByWorkerId(workerId).stream()
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
                stats,
                dist,
                recentReviews,
                recentMatches
        );
    }

}
