package io.skima.byteapp.dto;

import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.ShiftMatch;

import java.time.LocalDateTime;

public record MatchResponse(
        Long id,
        Long shiftId,
        Long workerId,
        String workerName,
        Long cafeId,
        String cafeName,
        String cafeAddress,
        LocalDateTime shiftStartAt,
        LocalDateTime shiftEndAt,
        Integer hourlyWage,
        LocalDateTime matchedAt,
        LocalDateTime checkInAt,
        LocalDateTime checkOutAt,
        MatchStatus status,
        Boolean ownerRatedWorker,
        Boolean workerRatedOwner,
        // 정산 진행 상태 — 워커가 매칭 화면에서 한눈에 단계 추적 가능
        String payoutStatus,
        LocalDateTime payoutApprovedAt,
        Boolean payoutAutoApproved,
        LocalDateTime payoutCompletedAt,
        // 채팅 unread (워커 기준 — 점주가 보낸 메시지 중 워커가 안 본 것)
        long chatUnreadCount
) {
    public static MatchResponse from(ShiftMatch m) {
        return from(m, null, null, null, null, null, null, 0);
    }

    public static MatchResponse from(ShiftMatch m, Boolean ownerRatedWorker, Boolean workerRatedOwner) {
        return from(m, ownerRatedWorker, workerRatedOwner, null, null, null, null, 0);
    }

    public static MatchResponse from(ShiftMatch m,
                                     Boolean ownerRatedWorker,
                                     Boolean workerRatedOwner,
                                     String payoutStatus,
                                     LocalDateTime payoutApprovedAt,
                                     Boolean payoutAutoApproved,
                                     LocalDateTime payoutCompletedAt) {
        return from(m, ownerRatedWorker, workerRatedOwner,
                payoutStatus, payoutApprovedAt, payoutAutoApproved, payoutCompletedAt, 0);
    }

    public static MatchResponse from(ShiftMatch m,
                                     Boolean ownerRatedWorker,
                                     Boolean workerRatedOwner,
                                     String payoutStatus,
                                     LocalDateTime payoutApprovedAt,
                                     Boolean payoutAutoApproved,
                                     LocalDateTime payoutCompletedAt,
                                     long chatUnreadCount) {
        var shift = m.getShift();
        var cafe = shift.getCafe();
        return new MatchResponse(
                m.getId(),
                shift.getId(),
                m.getWorker().getId(),
                m.getWorker().getName(),
                cafe.getId(),
                cafe.getName(),
                cafe.getAddress(),
                shift.getStartAt(),
                shift.getEndAt(),
                shift.getHourlyWage(),
                m.getMatchedAt(),
                m.getCheckInAt(),
                m.getCheckOutAt(),
                m.getStatus(),
                ownerRatedWorker,
                workerRatedOwner,
                payoutStatus,
                payoutApprovedAt,
                payoutAutoApproved,
                payoutCompletedAt,
                chatUnreadCount
        );
    }
}
