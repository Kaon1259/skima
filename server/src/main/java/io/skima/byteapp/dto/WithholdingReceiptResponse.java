package io.skima.byteapp.dto;

import java.time.LocalDateTime;

/**
 * 일용근로 원천징수 영수증 데이터 (지급명세서 보조).
 */
public record WithholdingReceiptResponse(
        Long matchId,
        String employerName,
        String employerCafeName,
        String workerName,
        String workerPhone,
        LocalDateTime workDate,
        Integer grossAmount,
        Integer taxableAmount,
        Integer withholdingTax,
        Integer localIncomeTax,
        Integer netAmount,
        String taxClause,
        LocalDateTime issuedAt
) {
}
