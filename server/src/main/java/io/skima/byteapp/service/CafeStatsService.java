package io.skima.byteapp.service;

import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Payout;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.dto.CafeStatsResponse;
import io.skima.byteapp.repository.CafeRepository;
import io.skima.byteapp.repository.PayoutRepository;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CafeStatsService {

    private final CafeRepository cafeRepository;
    private final ShiftRepository shiftRepository;
    private final PayoutRepository payoutRepository;
    private final RatingRepository ratingRepository;
    private final ShiftMatchRepository matchRepository;
    private final BrandCatalog brandCatalog;

    @Transactional(readOnly = true)
    public List<CafeStatsResponse> computeForOwner(User owner) {
        List<Cafe> cafes = cafeRepository.findAllByOwner(owner);
        List<Shift> ownerShifts = shiftRepository.findAllByOwnerId(owner.getId());

        YearMonth thisMonth = YearMonth.now();
        LocalDateTime monthStart = thisMonth.atDay(1).atStartOfDay();
        LocalDateTime monthEnd = thisMonth.plusMonths(1).atDay(1).atStartOfDay();

        YearMonth prevMonth = thisMonth.minusMonths(1);
        LocalDateTime prevStart = prevMonth.atDay(1).atStartOfDay();
        LocalDateTime prevEnd = prevMonth.plusMonths(1).atDay(1).atStartOfDay();

        List<CafeStatsResponse> out = new ArrayList<>();
        for (Cafe c : cafes) {
            List<Shift> myShifts = ownerShifts.stream()
                    .filter(s -> s.getCafe().getId().equals(c.getId()))
                    .toList();

            int total = myShifts.size();
            int open = (int) myShifts.stream().filter(s -> s.getStatus() == ShiftStatus.OPEN).count();
            int matched = (int) myShifts.stream()
                    .filter(s -> s.getStatus() == ShiftStatus.MATCHED || s.getStatus() == ShiftStatus.IN_PROGRESS)
                    .count();
            int completed = (int) myShifts.stream().filter(s -> s.getStatus() == ShiftStatus.COMPLETED).count();

            List<Payout> monthPayouts = payoutRepository.findCompletedByCafeInRange(c.getId(), monthStart, monthEnd);
            long gross = monthPayouts.stream().mapToLong(p -> nz(p.getGrossAmount())).sum();
            long fee = monthPayouts.stream().mapToLong(p -> nz(p.getPlatformFee())).sum();
            long net = monthPayouts.stream().mapToLong(p -> nz(p.getNetAmount())).sum();

            List<Payout> prevPayouts = payoutRepository.findCompletedByCafeInRange(c.getId(), prevStart, prevEnd);
            long prevGross = prevPayouts.stream().mapToLong(p -> nz(p.getGrossAmount())).sum();

            List<Rating> ratings = ratingRepository.findAllByCafeIdAndDirection(
                    c.getId(), RatingDirection.OWNER_TO_WORKER);
            Double avgRating = ratings.isEmpty() ? null
                    : ratings.stream().mapToInt(Rating::getScore).average().orElse(0);
            Integer ratingsCount = ratings.isEmpty() ? null : ratings.size();

            List<io.skima.byteapp.domain.ShiftMatch> matches = matchRepository.findAllByCafeId(c.getId());
            long noShow = matches.stream().filter(m -> m.getStatus() == MatchStatus.NO_SHOW).count();
            Double noShowRate = matches.isEmpty() ? null : (double) noShow / matches.size();

            var brand = brandCatalog.findByKey(c.getBrandKey()).orElse(null);
            String brandLetter = brand == null ? null : brand.letter();
            String brandColor = brand == null ? null : brand.color();

            out.add(new CafeStatsResponse(
                    c.getId(), c.getName(), c.getBrandKey(),
                    brandLetter, brandColor,
                    total, open, matched, completed,
                    gross, fee, net,
                    avgRating, ratingsCount, noShowRate,
                    prevGross, prevPayouts.size(), monthPayouts.size()
            ));
        }
        return out;
    }

    private static int nz(Integer v) { return v == null ? 0 : v; }
}
