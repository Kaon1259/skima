package io.skima.byteapp.dto;

import io.skima.byteapp.domain.DisputeReason;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DisputeRequest(
        @NotNull Long matchId,
        @NotNull DisputeReason reason,
        @Size(max = 1024) String comment
) {
}
