package io.skima.byteapp.domain;

public enum DisputeReason {
    NO_SHOW_DISPUTE,    // 노쇼 처리에 동의 못함 (워커가 신고)
    LATE_CHECKIN,       // 워커 지각 (점주)
    EARLY_CHECKOUT,     // 워커 조기 퇴근 (점주)
    RUDE_BEHAVIOR,      // 무례한 행동 (양측)
    WAGE_MISMATCH,      // 시급/근무시간 불일치 (워커)
    SAFETY_ISSUE,       // 안전 문제 (워커)
    OTHER,
}
