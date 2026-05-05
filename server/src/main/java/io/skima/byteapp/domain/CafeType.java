package io.skima.byteapp.domain;

/**
 * 매장 종류. Phase 1: 카페·베이커리. Phase 2: 펍·이자카야·와인바 (저녁 피크 + 노쇼 0% 가치 max).
 * 이자카야/와인바는 한국 시장 특성상 프렌차이즈가 적어 단일 enum 으로 통합.
 *
 * 향후 음식점·편의점·행사 진입 시 추가 예정.
 */
public enum CafeType {
    // Phase 1 (현재)
    FRANCHISE_CAFE,
    INDIVIDUAL_CAFE,
    FRANCHISE_BAKERY,
    INDIVIDUAL_BAKERY,

    // Phase 2 — 펍·이자카야·와인바
    FRANCHISE_PUB,
    INDIVIDUAL_PUB,
    IZAKAYA,        // 이자카야 — 통합 (프렌차이즈/개인 모두)
    WINE_BAR        // 와인바 — 통합
}
