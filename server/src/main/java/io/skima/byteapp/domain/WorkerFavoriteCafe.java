package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "worker_favorite_cafes",
        uniqueConstraints = @UniqueConstraint(name = "uk_wfc_worker_cafe", columnNames = {"worker_id", "cafe_id"}),
        indexes = @Index(name = "idx_wfc_worker", columnList = "worker_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkerFavoriteCafe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cafe_id", nullable = false)
    private Cafe cafe;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public WorkerFavoriteCafe(User worker, Cafe cafe) {
        this.worker = worker;
        this.cafe = cafe;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
