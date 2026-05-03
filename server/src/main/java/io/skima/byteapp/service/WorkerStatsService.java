package io.skima.byteapp.service;

import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.dto.WorkerStatsResponse;
import io.skima.byteapp.repository.PayoutRepository;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkerStatsService {

    private final UserRepository userRepository;
    private final ShiftMatchRepository matchRepository;
    private final RatingRepository ratingRepository;
    private final PayoutRepository payoutRepository;

    @Transactional(readOnly = true)
    public WorkerStatsResponse computeForWorker(Long workerId) {
        User worker = userRepository.findById(workerId).orElseThrow();
        List<ShiftMatch> matches = matchRepository.findAllByWorkerId(workerId);
        int total = matches.size();
        int completed = (int) matches.stream().filter(m -> m.getStatus() == MatchStatus.CHECKED_OUT).count();
        int noShow = (int) matches.stream().filter(m -> m.getStatus() == MatchStatus.NO_SHOW).count();

        long totalMinutes = 0;
        for (ShiftMatch m : matches) {
            if (m.getCheckInAt() != null && m.getCheckOutAt() != null) {
                totalMinutes += Duration.between(m.getCheckInAt(), m.getCheckOutAt()).toMinutes();
            }
        }
        long totalEarnings = payoutRepository.findAllByWorkerId(workerId).stream()
                .mapToLong(p -> p.getNetAmount() == null ? 0 : p.getNetAmount())
                .sum();

        List<Rating> ratings = ratingRepository.findAllByWorkerIdAndDirection(
                workerId, RatingDirection.OWNER_TO_WORKER);
        Double avgRating = ratings.isEmpty()
                ? null
                : ratings.stream().mapToInt(Rating::getScore).average().orElse(0);
        Double rehireRate = ratings.isEmpty()
                ? null
                : (double) ratings.stream().filter(Rating::isWillRehire).count() / ratings.size();
        Double noShowRate = total == 0 ? null : (double) noShow / total;

        int[] dist = new int[5];
        for (Rating r : ratings) {
            int idx = r.getScore() - 1;
            if (idx >= 0 && idx < 5) dist[idx]++;
        }

        return new WorkerStatsResponse(
                workerId,
                worker.getName(),
                total,
                completed,
                noShow,
                totalMinutes,
                totalEarnings,
                avgRating,
                rehireRate,
                noShowRate,
                ratings.size(),
                dist,
                WorkerStatsResponse.classifyTier(completed, avgRating, noShow, rehireRate),
                WorkerStatsResponse.computeTrustScore(completed, avgRating, rehireRate, noShowRate)
        );
    }
}
