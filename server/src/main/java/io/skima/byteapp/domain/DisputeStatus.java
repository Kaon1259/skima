package io.skima.byteapp.domain;

public enum DisputeStatus {
    PENDING,    // 신고 접수 — 24h 자동 판정 또는 관리자 검토 대기
    RESOLVED,   // 처리 완료 (verdict 있음)
    DISMISSED,  // 기각 (사실관계 불충분 등)
}
