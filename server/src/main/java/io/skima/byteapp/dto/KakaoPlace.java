package io.skima.byteapp.dto;

/**
 * 카카오 Local API keyword search 응답 1건 — 매장 검색·주소 자동완성용.
 */
public record KakaoPlace(
        String placeName,
        String addressName,
        String roadAddressName,
        String phone,
        Double latitude,
        Double longitude,
        String categoryName,
        String placeUrl,
        Double distanceMeters
) {}
