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
        int[] scoreDistribution
) {
}
