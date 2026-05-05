package io.skima.byteapp.domain;

/**
 * 시프트 직무 카테고리. 시프트 등록 시 단일 선택, 워커는 가능한 다중 선택.
 * Phase 1: 카페·베이커리 직무. Phase 2: 펍·이자카야 BARTENDER 추가.
 */
public enum JobRole {
    /** 바리스타 — 음료 제조, 라떼아트, 머신 운영 */
    BARISTA,
    /** 홀/서빙 — 주문 받기, 서빙, 정리, 청소 (펍·이자카야 서버 포함) */
    HALL,
    /** 캐셔 — POS, 결제, 응대 */
    CASHIER,
    /** 베이커 — 빵 굽기, 진열, 포장 (베이커리 전용) */
    BAKER,
    /** 주방 보조 — 설거지, 재료 준비 */
    KITCHEN,
    /** 오픈 전담 — 매장 개점, 세팅, 재료 준비 */
    OPENING,
    /** 마감 전담 — 청소·정리·재고·정산 (혼자 마감 가능자) */
    CLOSING,
    /** 바텐더 — 칵테일·주류 제조, 펍/이자카야/와인바 전용 (Phase 2) */
    BARTENDER
}
