package io.skima.byteapp.dto;

import java.time.LocalDateTime;

public record KpiResponse(
        LocalDateTime since,
        long totalMatchedShifts,
        long matchedWithinSla,
        double matchingSlaRate,
        int matchingSlaMinutes,
        long totalCompletedPayouts,
        long payoutsWithinSla,
        double payoutSlaRate,
        int payoutSlaMinutes,
        // 확장 — PMF 시그널
        Double avgWorkerRating,
        Double rehireRate,
        Double noShowRate,
        long totalRatings,
        long totalNoShows
) {
}
