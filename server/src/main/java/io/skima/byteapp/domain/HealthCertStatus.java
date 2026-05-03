package io.skima.byteapp.domain;

public enum HealthCertStatus {
    NOT_UPLOADED,    // 미업로드 (디폴트)
    PENDING,         // 검토 대기 (업로드 직후)
    VERIFIED,        // 인증 완료
    REJECTED,        // 인증 거부 (이미지 불명확/만료/위조 의심)
    EXPIRED,         // 1년 만료 — cron 자동 전이
}
