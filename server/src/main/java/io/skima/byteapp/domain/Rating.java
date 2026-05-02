package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "ratings", uniqueConstraints =
        @UniqueConstraint(name = "uk_rating_match_direction", columnNames = {"match_id", "direction"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Rating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private ShiftMatch match;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RatingDirection direction;

    /** 1~5 별점 */
    @Column(nullable = false)
    private int score;

    /** 양방향 PMF 시그널 — owner 시점=재고용 의향, worker 시점=재방문 의향 */
    @Column(name = "will_rehire", nullable = false)
    private boolean willRehire;

    @Column(length = 500)
    private String comment;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public Rating(ShiftMatch match, User worker, User owner, RatingDirection direction,
                  int score, boolean willRehire, String comment) {
        this.match = match;
        this.worker = worker;
        this.owner = owner;
        this.direction = direction;
        this.score = score;
        this.willRehire = willRehire;
        this.comment = comment;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
