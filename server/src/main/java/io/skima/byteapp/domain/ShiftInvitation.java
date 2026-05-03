package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 점주가 특정 워커에게 시프트를 직접 초대.
 * 일반 지원 흐름과 별도. 워커 수락 시 ShiftMatch 자동 생성 + invitation = ACCEPTED.
 */
@Entity
@Table(name = "shift_invitations",
        uniqueConstraints = @UniqueConstraint(name = "uk_invite_shift_worker",
                columnNames = {"shift_id", "worker_id"}),
        indexes = {
                @Index(name = "idx_invite_worker", columnList = "worker_id"),
                @Index(name = "idx_invite_shift", columnList = "shift_id"),
                @Index(name = "idx_invite_status", columnList = "status"),
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ShiftInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "message", length = 256)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private InvitationStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @Builder
    public ShiftInvitation(Shift shift, User worker, User owner, String message, LocalDateTime expiresAt) {
        this.shift = shift;
        this.worker = worker;
        this.owner = owner;
        this.message = message;
        this.status = InvitationStatus.PENDING;
        this.expiresAt = expiresAt;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public void accept() {
        this.status = InvitationStatus.ACCEPTED;
        this.respondedAt = LocalDateTime.now();
    }

    public void reject() {
        this.status = InvitationStatus.REJECTED;
        this.respondedAt = LocalDateTime.now();
    }

    public void expire() {
        this.status = InvitationStatus.EXPIRED;
    }

    public void cancel() {
        this.status = InvitationStatus.CANCELED;
        this.respondedAt = LocalDateTime.now();
    }
}
