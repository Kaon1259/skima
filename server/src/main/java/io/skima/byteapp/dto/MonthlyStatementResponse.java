package io.skima.byteapp.dto;

import java.util.List;

/**
 * 점주 측 월간 지급 명세 — 신고용 집계.
 */
public record MonthlyStatementResponse(
        String month,
        String employerName,
        int totalMatches,
        long totalGross,
        long totalWithholding,
        long totalNet,
        long totalPlatformFee,
        List<MonthlyStatementRow> rows
) {
    public record MonthlyStatementRow(
            Long matchId,
            Long shiftId,
            Long cafeId,
            Long workerId,
            String workerName,
            String cafeName,
            String workDate,
            int gross,
            int withholding,
            int net
    ) {
    }
}
