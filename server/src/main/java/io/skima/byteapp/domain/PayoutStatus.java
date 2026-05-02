package io.skima.byteapp.domain;

public enum PayoutStatus {
    /** 워커 체크아웃 직후 — 점주 승인 대기 (자동 승인 SLA 30분) */
    REQUESTED,
    /** 점주 또는 자동 승인됨 — 입금 대기 (PayoutScheduler 가 매분 처리) */
    SCHEDULED,
    COMPLETED,
    FAILED
}
