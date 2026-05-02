package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "payouts", uniqueConstraints =
        @UniqueConstraint(name = "uk_payout_match", columnNames = "match_id"),
        indexes = @Index(name = "idx_payout_status", columnList = "status"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Payout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private ShiftMatch match;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @Column(name = "gross_amount", nullable = false)
    private Integer grossAmount;

    @Column(name = "withholding_tax", nullable = false)
    private Integer withholdingTax;

    @Column(name = "platform_fee", nullable = false)
    private Integer platformFee;

    @Column(name = "net_amount", nullable = false)
    private Integer netAmount;

    @Column(name = "trigger_at", nullable = false)
    private LocalDateTime triggerAt;

    /** 점주 또는 자동 승인 시점 — REQUESTED→SCHEDULED 전이된 시각 */
    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    /** 자동 승인이면 true — 점주가 명시 승인하면 false */
    @Column(name = "auto_approved", nullable = false)
    private boolean autoApproved;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PayoutStatus status;

    @Builder
    public Payout(ShiftMatch match, User worker, Integer grossAmount, Integer withholdingTax,
                  Integer platformFee, Integer netAmount, LocalDateTime triggerAt) {
        this.match = match;
        this.worker = worker;
        this.grossAmount = grossAmount;
        this.withholdingTax = withholdingTax;
        this.platformFee = platformFee;
        this.netAmount = netAmount;
        this.triggerAt = triggerAt;
        this.status = PayoutStatus.REQUESTED;
        this.autoApproved = false;
    }

    /** 점주 승인 또는 자동 승인 — REQUESTED → SCHEDULED 전이 */
    public void approve(LocalDateTime at, boolean auto) {
        this.approvedAt = at;
        this.autoApproved = auto;
        this.status = PayoutStatus.SCHEDULED;
    }

    public void complete(LocalDateTime at) {
        this.completedAt = at;
        this.status = PayoutStatus.COMPLETED;
    }

    public void fail() {
        this.status = PayoutStatus.FAILED;
    }
}
