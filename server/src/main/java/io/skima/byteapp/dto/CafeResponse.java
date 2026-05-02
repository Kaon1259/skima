package io.skima.byteapp.dto;

import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.CafeType;

public record CafeResponse(
        Long id,
        String name,
        String address,
        CafeType cafeType,
        String brandKey,
        String brandLetter,
        String brandColor,
        String brandName,
        Double latitude,
        Double longitude
) {
    public static CafeResponse from(Cafe c, BrandResponse brand) {
        return new CafeResponse(
                c.getId(),
                c.getName(),
                c.getAddress(),
                c.getCafeType(),
                c.getBrandKey(),
                brand != null ? brand.letter() : null,
                brand != null ? brand.color() : null,
                brand != null ? brand.name() : null,
                c.getLatitude(),
                c.getLongitude()
        );
    }

    public static CafeResponse from(Cafe c) {
        return from(c, null);
    }
}
