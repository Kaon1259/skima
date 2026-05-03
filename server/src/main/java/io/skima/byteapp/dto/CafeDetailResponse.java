package io.skima.byteapp.dto;

import io.skima.byteapp.domain.CafeType;

import java.util.List;

/**
 * 매장 상세 페이지용 통합 응답.
 * - 모든 인증 사용자에게 기본 정보 + 신뢰도 시그널 + 받은 평가 + 모집중 시프트
 * - 역할 = OWNER 이면서 본인 소유 매장이면 ownerView 채워짐 (이번달 매출/시프트 카운트/단골 워커)
 */
public record CafeDetailResponse(
        Long id,
        String name,
        String address,
        CafeType cafeType,
        String brandKey,
        String brandLetter,
        String brandColor,
        String brandName,
        String ownerName,
        // 추가 매장 정보 (점주 자기신고)
        String openHours,
        Integer seatCount,
        String phone,
        String description,
        String imageUrl,
        // 신뢰도 시그널 (워커가 점주에게 준 평가 집계)
        Double avgRating,
        Integer ratingsCount,
        Double noShowRate,
        int totalCompletedShifts,
        int totalMatches,
        // 평판 강화 시그널
        Double rehireRate,        // 같은 워커가 2회 이상 일한 비율
        Long avgWageGross,        // 최근 30일 평균 일급 (gross)
        Integer regularsCount,    // 단골 (2회 이상 일한 워커) 수
        Double payoutManualRate,  // 점주 명시 승인 비율 (자동 30분 대기보다 빠름) — 정산 신뢰도
        Integer trustScore,       // 종합 신뢰도 점수 (0~100, null=신규 매장)
        // 받은 평가 최신 N건 (코멘트 있는 것만 보여주기 좋게 그대로 전달)
        List<RatingResponse> recentReviews,
        // 모집중 시프트 (워커: 지원 가능 / 점주: 자기 매장이면 관리)
        List<ShiftResponse> openShifts,
        // 점주 전용 (본인 소유 매장일 때만 not null)
        OwnerView ownerView
) {
    public record OwnerView(
            int openShifts,
            int matchedShifts,
            int completedShifts,
            long monthGross,
            long monthFee,
            long monthWorkerNet,
            int monthCompletedMatches,
            // 단골 (해당 매장에서 2회 이상 일한 워커)
            List<RegularWorker> regulars
    ) {}

    public record RegularWorker(
            Long workerId,
            String workerName,
            int matchCount,
            Double avgRating
    ) {}
}
