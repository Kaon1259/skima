package io.skima.byteapp.domain;

public enum InvitationStatus {
    PENDING,    // 워커 응답 대기
    ACCEPTED,   // 워커 수락 → ShiftMatch 자동 생성
    REJECTED,   // 워커 거절
    EXPIRED,    // 만료 (워커 무응답)
    CANCELED,   // 점주 취소
}
