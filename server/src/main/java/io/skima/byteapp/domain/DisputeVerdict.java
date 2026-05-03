package io.skima.byteapp.domain;

public enum DisputeVerdict {
    REPORTER_WINS,    // 신고자 손을 들어줌 (상대측 평점 영향)
    RESPONDENT_WINS,  // 피신고자 손을 들어줌 (신고 기각)
    NEUTRAL,          // 중립 (둘 다 일부 책임)
}
