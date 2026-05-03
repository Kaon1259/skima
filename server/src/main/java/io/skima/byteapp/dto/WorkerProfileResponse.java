package io.skima.byteapp.dto;

import java.util.List;
import java.util.Set;

/**
 * 워커 프로필 페이지용 응답.
 * 점주가 지원자 미리보기 / 본인 프로필 확인 시 사용.
 */
public record WorkerProfileResponse(
        Long id,
        String name,
        String profileImage,
        // 자기신고 능력
        String selfReportedLevel,
        Set<String> capableRoles,
        Set<String> certifications,
        // 자기소개 / 경력 / 가능 시간대 (자기신고)
        String bio,
        Integer experienceYears,
        String availableHours,
        // 보건증 인증 상태 (점주에게는 status만 노출, 이미지 자체는 admin 전용)
        String healthCertStatus,
        // 기존 통계
        WorkerStatsResponse stats,
        // 평판 시그널 — 점주가 신뢰도 판단용
        Double rehireRate,            // 재고용 받은 매장 비율
        Integer favoriteCafeCount,    // 즐겨찾기한 매장 수
        Integer onTimeCount,          // 정시·조기 출근 (시작-5분 이내) 횟수
        Integer lateCount,            // 지각 (시작 이후 출근) 횟수
        Long avgWorkMinutes,          // 평균 실 근무 분
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
