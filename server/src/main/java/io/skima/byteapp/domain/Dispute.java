package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 분쟁 이의제기 — 매칭 종료 후 24시간 이내 워커/점주가 신고.
 * 사유: NO_SHOW_DISPUTE / LATE_CHECKIN / EARLY_CHECKOUT / RUDE_BEHAVIOR / WAGE_MISMATCH / OTHER
 * 처리: PENDING → RESOLVED(자동/관리자 판정) / DISMISSED
 */
@Entity
@Table(name = "disputes", indexes = {
        @Index(name = "idx_dispute_match", columnList = "match_id"),
        @Index(name = "idx_dispute_status", columnList = "status"),
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Dispute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private ShiftMatch match;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "reporter_role", nullable = false, length = 16)
    private UserRole reporterRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 32)
    private DisputeReason reason;

    @Column(name = "comment", length = 1024)
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private DisputeStatus status;

    /** 자동 판정 결과 — RESOLVED 시 누구 손을 들어줬는지 (REPORTER / RESPONDENT / NEUTRAL) */
    @Enumerated(EnumType.STRING)
    @Column(name = "verdict", length = 16)
    private DisputeVerdict verdict;

    @Column(name = "resolution_note", length = 512)
    private String resolutionNote;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Builder
    public Dispute(ShiftMatch match, User reporter, UserRole reporterRole, DisputeReason reason, String comment) {
        this.match = match;
        this.reporter = reporter;
        this.reporterRole = reporterRole;
        this.reason = reason;
        this.comment = comment;
        this.status = DisputeStatus.PENDING;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public void resolve(DisputeVerdict verdict, String note) {
        this.status = DisputeStatus.RESOLVED;
        this.verdict = verdict;
        this.resolutionNote = note;
        this.resolvedAt = LocalDateTime.now();
    }

    public void dismiss(String note) {
        this.status = DisputeStatus.DISMISSED;
        this.resolutionNote = note;
        this.resolvedAt = LocalDateTime.now();
    }
}
