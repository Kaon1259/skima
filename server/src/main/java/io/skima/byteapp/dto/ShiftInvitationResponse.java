package io.skima.byteapp.dto;

import io.skima.byteapp.domain.InvitationStatus;
import io.skima.byteapp.domain.ShiftInvitation;

import java.time.LocalDateTime;

public record ShiftInvitationResponse(
        Long id,
        Long shiftId,
        Long cafeId,
        String cafeName,
        Long workerId,
        String workerName,
        Long ownerId,
        String ownerName,
        String message,
        InvitationStatus status,
        LocalDateTime startAt,
        LocalDateTime endAt,
        Integer hourlyWage,
        LocalDateTime createdAt,
        LocalDateTime expiresAt,
        LocalDateTime respondedAt
) {
    public static ShiftInvitationResponse from(ShiftInvitation inv) {
        var s = inv.getShift();
        return new ShiftInvitationResponse(
                inv.getId(),
                s.getId(),
                s.getCafe().getId(),
                s.getCafe().getName(),
                inv.getWorker().getId(),
                inv.getWorker().getName(),
                inv.getOwner().getId(),
                inv.getOwner().getName(),
                inv.getMessage(),
                inv.getStatus(),
                s.getStartAt(),
                s.getEndAt(),
                s.getHourlyWage(),
                inv.getCreatedAt(),
                inv.getExpiresAt(),
                inv.getRespondedAt()
        );
    }
}
