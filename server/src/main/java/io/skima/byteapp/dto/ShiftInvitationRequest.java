package io.skima.byteapp.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ShiftInvitationRequest(
        @NotNull Long shiftId,
        @NotNull Long workerId,
        @Size(max = 256) String message,
        /** 응답 마감 (분). null = 60분 디폴트 */
        Integer expiresInMinutes
) {
}
