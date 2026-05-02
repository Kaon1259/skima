package io.skima.byteapp.dto;

public record CafeStatsResponse(
        Long cafeId,
        String cafeName,
        String brandKey,
        String brandLetter,
        String brandColor,
        int totalShifts,
        int openShifts,
        int matchedShifts,
        int completedShifts,
        long monthGross,
        long monthFee,
        long monthWorkerNet,
        Double avgRating,
        Integer ratingsCount,
        Double noShowRate,
        // 지난달 비교 (트렌드 화살표용)
        long prevMonthGross,
        int prevMonthCompletedMatches,
        int monthCompletedMatches
) {
}
