package io.skima.byteapp.dto;

import io.skima.byteapp.domain.Payout;
import io.skima.byteapp.domain.PayoutStatus;

import java.time.Duration;
import java.time.LocalDateTime;

public record PayoutResponse(
        Long id,
        Long matchId,
        Long workerId,
        Long cafeId,
        String cafeName,
        LocalDateTime workDate,
        Integer grossAmount,
        Integer withholdingTax,
        Integer platformFee,
        Integer netAmount,
        LocalDateTime triggerAt,
        LocalDateTime approvedAt,
        boolean autoApproved,
        LocalDateTime completedAt,
        PayoutStatus status,
        Long elapsedMinutes
) {
    public static PayoutResponse from(Payout p) {
        // 기준점: 점주 승인 시각이 있으면 그 후 SLA 측정, 아니면 triggerAt 기준 (완료까지)
        Long elapsed = null;
        if (p.getCompletedAt() != null) {
            LocalDateTime base = p.getApprovedAt() == null ? p.getTriggerAt() : p.getApprovedAt();
            elapsed = Duration.between(base, p.getCompletedAt()).toMinutes();
        }
        var shift = p.getMatch().getShift();
        var cafe = shift.getCafe();
        return new PayoutResponse(
                p.getId(),
                p.getMatch().getId(),
                p.getWorker().getId(),
                cafe.getId(),
                cafe.getName(),
                shift.getStartAt(),
                p.getGrossAmount(),
                p.getWithholdingTax(),
                p.getPlatformFee(),
                p.getNetAmount(),
                p.getTriggerAt(),
                p.getApprovedAt(),
                p.isAutoApproved(),
                p.getCompletedAt(),
                p.getStatus(),
                elapsed
        );
    }
}
