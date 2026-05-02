package io.skima.byteapp.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RatingCreateRequest(
        @NotNull @Min(1) @Max(5) Integer score,
        @NotNull Boolean willRehire,
        @Size(max = 500) String comment
) {
}
