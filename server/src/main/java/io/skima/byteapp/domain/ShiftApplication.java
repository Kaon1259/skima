package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "shift_applications", uniqueConstraints =
        @UniqueConstraint(name = "uk_shift_worker", columnNames = {"shift_id", "worker_id"}),
        indexes = @Index(name = "idx_app_status", columnList = "status"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ShiftApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @Column(name = "applied_at", nullable = false, updatable = false)
    private LocalDateTime appliedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ApplicationStatus status;

    @Builder
    public ShiftApplication(Shift shift, User worker) {
        this.shift = shift;
        this.worker = worker;
        this.status = ApplicationStatus.PENDING;
    }

    @PrePersist
    void onCreate() {
        this.appliedAt = LocalDateTime.now();
    }

    public void accept() {
        this.status = ApplicationStatus.ACCEPTED;
    }

    public void reject() {
        this.status = ApplicationStatus.REJECTED;
    }

    public void withdraw() {
        this.status = ApplicationStatus.WITHDRAWN;
    }
}
