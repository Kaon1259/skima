package io.skima.byteapp.dto;

import io.skima.byteapp.domain.CafeType;

/**
 * 카탈로그 브랜드 정보. 로고 이미지 대신 letterAvatar + color로 시각화 (저작권 회피).
 */
public record BrandResponse(
        String key,
        String name,
        CafeType type,
        String letter,
        String color,
        String tagline
) {
}
