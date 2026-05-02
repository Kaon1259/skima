package io.skima.byteapp.service;

import io.skima.byteapp.config.SkimaProperties;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.dto.KpiResponse;
import io.skima.byteapp.repository.PayoutRepository;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class KpiService {

    private final ShiftRepository shiftRepository;
    private final PayoutRepository payoutRepository;
    private final RatingRepository ratingRepository;
    private final ShiftMatchRepository matchRepository;
    private final SkimaProperties props;

    @Transactional(readOnly = true)
    public KpiResponse getNorthStar(LocalDateTime since) {
        int matchSla = props.getMatching().getSlaMinutes();
        int payoutSla = props.getPayout().getSlaMinutes();

        long totalMatched = shiftRepository.countMatchedShiftsSince(since);
        long matchedWithin = shiftRepository.countMatchedWithinSlaSince(since, matchSla);
        double matchRate = totalMatched == 0 ? 0.0 : (double) matchedWithin / totalMatched;

        long totalPayouts = payoutRepository.countCompletedSince(since);
        long payoutsWithin = payoutRepository.countCompletedWithinSlaSince(since, payoutSla);
        double payoutRate = totalPayouts == 0 ? 0.0 : (double) payoutsWithin / totalPayouts;

        // 확장 — 별점/재고용/노쇼 (북극성 KPI 는 점주→워커 평가 기반)
        List<Rating> recentRatings = ratingRepository.findByDirectionSince(
                RatingDirection.OWNER_TO_WORKER, since);
        Double avgRating = recentRatings.isEmpty() ? null
                : recentRatings.stream().mapToInt(Rating::getScore).average().orElse(0);
        Double rehireRate = recentRatings.isEmpty() ? null
                : (double) recentRatings.stream().filter(Rating::isWillRehire).count() / recentRatings.size();

        long totalNoShows = matchRepository.countByStatusAndMatchedAtAfter(MatchStatus.NO_SHOW, since);
        long totalMatches = matchRepository.countByMatchedAtAfter(since);
        Double noShowRate = totalMatches == 0 ? null : (double) totalNoShows / totalMatches;

        return new KpiResponse(
                since,
                totalMatched,
                matchedWithin,
                matchRate,
                matchSla,
                totalPayouts,
                payoutsWithin,
                payoutRate,
                payoutSla,
                avgRating,
                rehireRate,
                noShowRate,
                recentRatings.size(),
                totalNoShows
        );
    }
}
