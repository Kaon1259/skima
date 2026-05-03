package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 워커가 차단한 매장 — 시프트 검색에서 자동 제외.
 * 단골(WorkerFavoriteCafe)의 반대 개념. 같은 매장에 대해 단골/차단 동시 불가능.
 */
@Entity
@Table(name = "worker_blocked_cafes",
        uniqueConstraints = @UniqueConstraint(name = "uk_blocked_worker_cafe",
                columnNames = {"worker_id", "cafe_id"}),
        indexes = {
                @Index(name = "idx_blocked_worker", columnList = "worker_id"),
                @Index(name = "idx_blocked_cafe", columnList = "cafe_id"),
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkerBlockedCafe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cafe_id", nullable = false)
    private Cafe cafe;

    @Column(name = "reason", length = 256)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public WorkerBlockedCafe(User worker, Cafe cafe, String reason) {
        this.worker = worker;
        this.cafe = cafe;
        this.reason = reason;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
