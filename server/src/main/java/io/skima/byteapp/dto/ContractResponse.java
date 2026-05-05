package io.skima.byteapp.dto;

import java.time.LocalDateTime;

/**
 * 일용근로자 표준 근로계약서 데이터.
 * 한국 근로기준법 17조에 따라 명시 의무 항목: 임금·소정근로시간·주휴일·연차·근무장소·업무내용.
 */
public record ContractResponse(
        Long matchId,
        // 사업주 (점주)
        String employerName,
        String employerPhone,
        String employerCafeName,
        String employerCafeAddress,
        // 근로자 (워커)
        String workerName,
        String workerPhone,
        String workerBankAccount,
        // 근로 조건
        LocalDateTime workStartAt,
        LocalDateTime workEndAt,
        String workplaceAddress,
        String jobDescription,
        Integer hourlyWage,
        // 근로시간/지급
        Long workMinutes,
        Integer grossAmount,
        Integer withholdingTax,
        Integer netAmount,
        // 메타
        String classification,
        String taxClause,
        LocalDateTime issuedAt,
        // 양측 확인 시각 (B 트랙 — 분쟁 방어)
        LocalDateTime ownerAcknowledgedAt,
        LocalDateTime workerAcknowledgedAt
) {
}
