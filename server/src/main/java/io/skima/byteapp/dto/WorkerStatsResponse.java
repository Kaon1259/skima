package io.skima.byteapp.dto;

public record WorkerStatsResponse(
        Long workerId,
        String workerName,
        int totalMatches,
        int completedMatches,
        int noShowCount,
        long totalWorkedMinutes,
        long totalEarnings,
        Double avgRating,
        Double rehireRate,
        Double noShowRate,
        int ratingsCount,
        // 별점 분포 (인덱스 0=1점, 4=5점)
        int[] scoreDistribution,
        // 자동 부여 등급 — Verified Barista 시스템 (NEW/REGULAR/VERIFIED/ELITE)
        WorkerTier tier,
        // 종합 신뢰도 점수 (0~100). null = 데이터 부족 (completed < 3) → "🌱 신규" 표시
        Integer trustScore
) {
    public enum WorkerTier {
        NEW,        // 0~1회 완료
        REGULAR,    // 2~9회 완료
        VERIFIED,   // 10회+ 완료, 평점 4.5+, 노쇼 0
        ELITE,      // 30회+ 완료, 평점 4.7+, 노쇼 0, 재고용률 60%+
    }

    public static WorkerTier classifyTier(int completed, Double avgRating, int noShowCount, Double rehireRate) {
        if (completed >= 30 && avgRating != null && avgRating >= 4.7
                && noShowCount == 0
                && rehireRate != null && rehireRate >= 0.6) {
            return WorkerTier.ELITE;
        }
        if (completed >= 10 && avgRating != null && avgRating >= 4.5 && noShowCount == 0) {
            return WorkerTier.VERIFIED;
        }
        if (completed >= 2) return WorkerTier.REGULAR;
        return WorkerTier.NEW;
    }

    /**
     * 워커 신뢰도 점수 (0~100). 데이터 부족 (completed < 3) 시 null.
     * 공식: 별점 40 + 재고용률 30 + (1-노쇼율) 20 + 볼륨 10
     */
    public static Integer computeTrustScore(int completed, Double avgRating, Double rehireRate, Double noShowRate) {
        if (completed < 3) return null;
        double score = 0;
        score += (avgRating != null ? avgRating / 5.0 : 0) * 40;
        score += (rehireRate != null ? rehireRate : 0) * 30;
        score += (1.0 - (noShowRate != null ? noShowRate : 0)) * 20;
        score += Math.min(completed / 10.0, 1.0) * 10;
        return (int) Math.round(score);
    }
}
