package io.skima.byteapp.domain;

/**
 * 능력 수직 계열화. 시프트는 minSkill 요구, 워커는 selfReportedLevel 자기신고.
 * MVP — 점주 인증 시스템(Phase 2)으로 점진 확장.
 */
public enum SkillLevel {
    /** 신입 OK — 교육 필요, 기본 응대만 가능 */
    L1_TRAINEE,
    /** 기본 — POS·기본 음료·홀 모두 가능 */
    L2_BASIC,
    /** 숙련 — 라떼아트·바쁜 시간 단독 운영 */
    L3_SKILLED,
    /** 매니저급 — 단독 마감, 재고 관리, 신입 교육 */
    L4_EXPERT;

    public boolean meetsRequirement(SkillLevel required) {
        if (required == null) return true;
        return this.ordinal() >= required.ordinal();
    }
}
