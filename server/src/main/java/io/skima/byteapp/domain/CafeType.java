package io.skima.byteapp.domain;

/**
 * 매장 종류 (Phase 2 통합 정리). 큰 그릇은 enum 으로, 세부 카테고리는 BrandCatalog · description 으로 표현.
 *
 * Phase 1: 카페·베이커리 (현재 매칭 검증 완료)
 * Phase 2: 음식점·바 (저녁 피크 + 시급↑ + 노쇼 가치 max)
 * Phase 3+: 편의점·행사 등 추후 확장
 *
 * 음식점 세분화 (한식/중식/일식/양식/분식/치킨) 와 바 세분화 (펍/이자카야/와인바) 는
 * 모두 BrandCatalog 의 브랜드명 + 매장 description 으로 표현 → enum 폭증 방지 + 1탭 정신 유지.
 */
public enum CafeType {
    // Phase 1
    FRANCHISE_CAFE,
    INDIVIDUAL_CAFE,
    FRANCHISE_BAKERY,
    INDIVIDUAL_BAKERY,

    // Phase 2 — 음식점 (한식/양식/중식/일식/분식/치킨 등 모든 식당 통합)
    FRANCHISE_RESTAURANT,
    INDIVIDUAL_RESTAURANT,

    // Phase 2 — 바 (펍·이자카야·와인바 통합)
    FRANCHISE_BAR,
    INDIVIDUAL_BAR
}
