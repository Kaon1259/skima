package io.skima.byteapp.dto;

import io.skima.byteapp.domain.CafeType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CafeCreateRequest(
        @NotBlank @Size(max = 128) String name,
        @NotBlank @Size(max = 256) String address,
        @NotNull CafeType cafeType,
        String brandKey
) {
}
