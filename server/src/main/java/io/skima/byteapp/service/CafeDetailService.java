package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Payout;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.dto.CafeDetailResponse;
import io.skima.byteapp.dto.RatingResponse;
import io.skima.byteapp.dto.ShiftResponse;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CafeDetailService {

    private final CafeRepository cafeRepository;
    private final ShiftRepository shiftRepository;
    private final ShiftMatchRepository matchRepository;
    private final RatingRepository ratingRepository;
    private final PayoutRepository payoutRepository;
    private final BrandCatalog brandCatalog;

    @Transactional(readOnly = true)
    public CafeDetailResponse buildDetail(User viewer, Long cafeId) {
        Cafe cafe = cafeRepository.findById(cafeId)
                .orElseThrow(() -> BusinessException.notFound("매장을 찾을 수 없습니다"));

        var brand = brandCatalog.findByKey(cafe.getBrandKey()).orElse(null);

        // 워커→점주 평가 (매장 신뢰도)
        List<Rating> received = ratingRepository.findAllByCafeIdAndDirection(
                cafeId, RatingDirection.WORKER_TO_OWNER);
        Double avgRating = received.isEmpty() ? null
                : received.stream().mapToInt(Rating::getScore).average().orElse(0);
        Integer ratingsCount = received.isEmpty() ? null : received.size();

        // 노쇼율
        List<ShiftMatch> allMatches = matchRepository.findAllByCafeId(cafeId);
        long noShow = allMatches.stream().filter(m -> m.getStatus() == MatchStatus.NO_SHOW).count();
        Double noShowRate = allMatches.isEmpty() ? null : (double) noShow / allMatches.size();

        // 완료된 시프트 총수
        List<Shift> cafeShifts = shiftRepository.findAllByOwnerId(cafe.getOwner().getId()).stream()
                .filter(s -> s.getCafe().getId().equals(cafeId))
                .toList();
        int completedTotal = (int) cafeShifts.stream()
                .filter(s -> s.getStatus() == ShiftStatus.COMPLETED).count();

        // 평판 시그널: 재고용률 + 평균 일급 + 단골 수
        Map<Long, Long> matchesByWorker = new HashMap<>();
        for (ShiftMatch m : allMatches) {
            if (m.getStatus() == MatchStatus.NO_SHOW || m.getStatus() == MatchStatus.CANCELED) continue;
            matchesByWorker.merge(m.getWorker().getId(), 1L, Long::sum);
        }
        long uniqueWorkers = matchesByWorker.size();
        long regulars = matchesByWorker.values().stream().filter(v -> v >= 2).count();
        Double rehireRate = uniqueWorkers == 0 ? null : (double) regulars / uniqueWorkers;
        Integer regularsCount = uniqueWorkers == 0 ? null : (int) regulars;

        // 평균 일급 (최근 30일 완료된 payout)
        LocalDateTime since = LocalDateTime.now().minusDays(30);
        LocalDateTime nowEnd = LocalDateTime.now().plusDays(1);
        List<Payout> recentPayouts = payoutRepository.findCompletedByCafeInRange(cafeId, since, nowEnd);
        Long avgWageGross = recentPayouts.isEmpty() ? null
                : recentPayouts.stream().mapToLong(p -> nz(p.getGrossAmount())).sum() / recentPayouts.size();

        // 정산 신뢰도 — 점주 명시 승인 비율 (자동 30분 대기 비율의 반대)
        // approvedAt != null 인 모든 payout 중 autoApproved=false 인 비율
        long approvedTotal = recentPayouts.stream().filter(p -> p.getApprovedAt() != null).count();
        long manualApproved = recentPayouts.stream()
                .filter(p -> p.getApprovedAt() != null && !p.isAutoApproved()).count();
        Double payoutManualRate = approvedTotal == 0 ? null : (double) manualApproved / approvedTotal;

        // 종합 신뢰도 점수 — 별점35 + 재고용25 + (1-노쇼)15 + 정산빠른승인15 + 볼륨10
        Integer cafeTrustScore;
        if (allMatches.size() < 5) {
            cafeTrustScore = null;
        } else {
            double s = 0;
            s += (avgRating != null ? avgRating / 5.0 : 0) * 35;
            s += (rehireRate != null ? rehireRate : 0) * 25;
            s += (1.0 - (noShowRate != null ? noShowRate : 0)) * 15;
            s += (payoutManualRate != null ? payoutManualRate : 0.5) * 15; // null이면 중립 0.5
            s += Math.min(allMatches.size() / 20.0, 1.0) * 10;
            cafeTrustScore = (int) Math.round(s);
        }

        // 최신 리뷰 5건
        List<RatingResponse> recentReviews = received.stream()
                .limit(5)
                .map(RatingResponse::from)
                .toList();

        // 모집중 시프트
        List<ShiftResponse> openShifts = cafeShifts.stream()
                .filter(s -> s.getStatus() == ShiftStatus.OPEN)
                .sorted(Comparator.comparing(Shift::getStartAt))
                .map(ShiftResponse::from)
                .toList();

        // 점주 본인 매장이면 OwnerView 채움
        CafeDetailResponse.OwnerView ownerView = null;
        if (viewer.getRole() == UserRole.OWNER
                && cafe.getOwner().getId().equals(viewer.getId())) {
            ownerView = buildOwnerView(cafe, cafeShifts, allMatches);
        }

        return new CafeDetailResponse(
                cafe.getId(),
                cafe.getName(),
                cafe.getAddress(),
                cafe.getCafeType(),
                cafe.getBrandKey(),
                brand != null ? brand.letter() : null,
                brand != null ? brand.color() : null,
                brand != null ? brand.name() : null,
                cafe.getOwner().getName(),
                cafe.getOpenHours(),
                cafe.getSeatCount(),
                cafe.getPhone(),
                cafe.getDescription(),
                cafe.getImageUrl(),
                avgRating,
                ratingsCount,
                noShowRate,
                completedTotal,
                allMatches.size(),
                rehireRate,
                avgWageGross,
                regularsCount,
                payoutManualRate,
                cafeTrustScore,
                recentReviews,
                openShifts,
                ownerView
        );
    }

    private CafeDetailResponse.OwnerView buildOwnerView(Cafe cafe, List<Shift> cafeShifts,
                                                         List<ShiftMatch> allMatches) {
        int open = (int) cafeShifts.stream().filter(s -> s.getStatus() == ShiftStatus.OPEN).count();
        int matched = (int) cafeShifts.stream()
                .filter(s -> s.getStatus() == ShiftStatus.MATCHED || s.getStatus() == ShiftStatus.IN_PROGRESS)
                .count();
        int completed = (int) cafeShifts.stream().filter(s -> s.getStatus() == ShiftStatus.COMPLETED).count();

        YearMonth thisMonth = YearMonth.now();
        LocalDateTime monthStart = thisMonth.atDay(1).atStartOfDay();
        LocalDateTime monthEnd = thisMonth.plusMonths(1).atDay(1).atStartOfDay();

        List<Payout> monthPayouts = payoutRepository.findCompletedByCafeInRange(
                cafe.getId(), monthStart, monthEnd);
        long gross = monthPayouts.stream().mapToLong(p -> nz(p.getGrossAmount())).sum();
        long fee = monthPayouts.stream().mapToLong(p -> nz(p.getPlatformFee())).sum();
        long net = monthPayouts.stream().mapToLong(p -> nz(p.getNetAmount())).sum();
        int monthMatchCount = monthPayouts.size();

        // 단골: 같은 매장에서 2회 이상 일한 워커 (NO_SHOW/CANCELED 제외)
        Map<Long, List<ShiftMatch>> byWorker = new HashMap<>();
        for (ShiftMatch m : allMatches) {
            if (m.getStatus() == MatchStatus.NO_SHOW || m.getStatus() == MatchStatus.CANCELED) continue;
            byWorker.computeIfAbsent(m.getWorker().getId(), k -> new ArrayList<>()).add(m);
        }

        // 워커→점주 평가는 매장 단위, 점주→워커 평가가 워커별 점수
        List<Rating> ownerToWorker = ratingRepository.findAllByCafeIdAndDirection(
                cafe.getId(), RatingDirection.OWNER_TO_WORKER);
        Map<Long, List<Integer>> scoresByWorker = new HashMap<>();
        for (Rating r : ownerToWorker) {
            scoresByWorker.computeIfAbsent(r.getWorker().getId(), k -> new ArrayList<>()).add(r.getScore());
        }

        List<CafeDetailResponse.RegularWorker> regulars = byWorker.entrySet().stream()
                .filter(e -> e.getValue().size() >= 2)
                .map(e -> {
                    Long wid = e.getKey();
                    String name = e.getValue().get(0).getWorker().getName();
                    int count = e.getValue().size();
                    List<Integer> scores = scoresByWorker.getOrDefault(wid, List.of());
                    Double avg = scores.isEmpty() ? null
                            : scores.stream().mapToInt(Integer::intValue).average().orElse(0);
                    return new CafeDetailResponse.RegularWorker(wid, name, count, avg);
                })
                .sorted(Comparator.comparingInt(CafeDetailResponse.RegularWorker::matchCount).reversed())
                .limit(10)
                .toList();

        return new CafeDetailResponse.OwnerView(open, matched, completed,
                gross, fee, net, monthMatchCount, regulars);
    }

    private static int nz(Integer v) { return v == null ? 0 : v; }
}
