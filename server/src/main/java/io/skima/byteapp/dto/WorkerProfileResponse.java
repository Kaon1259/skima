package io.skima.byteapp.dto;

import java.util.List;

/**
 * 워커 프로필 페이지용 응답.
 * 점주가 지원자 미리보기 / 본인 프로필 확인 시 사용.
 */
public record WorkerProfileResponse(
        Long id,
        String name,
        WorkerStatsResponse stats,
        // 별점 분포 (인덱스 0=1점, 4=5점)
        int[] scoreDistribution,
        // 최신 받은 평가 (코멘트 포함)
        List<RatingResponse> recentReviews,
        // 최근 매칭 요약
        List<MatchSummary> recentMatches
) {
    public record MatchSummary(
            Long matchId,
            Long shiftId,
            Long cafeId,
            String cafeName,
            String workDate,
            String status
    ) {}
}
