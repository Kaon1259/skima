package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "shift_matches",
        indexes = {
                @Index(name = "idx_match_status", columnList = "status"),
                @Index(name = "idx_match_shift", columnList = "shift_id")
        })
// uk_match_shift unique 제거 — 노쇼 후 백업 매칭으로 같은 shift 에 여러 match 가능
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ShiftMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private User worker;

    @Column(name = "matched_at", nullable = false, updatable = false)
    private LocalDateTime matchedAt;

    @Column(name = "check_in_at")
    private LocalDateTime checkInAt;

    @Column(name = "check_out_at")
    private LocalDateTime checkOutAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MatchStatus status;

    /** 점주가 마지막으로 채팅을 본 시각 — 이후 워커 메시지를 unread 로 카운트 */
    @Column(name = "owner_chat_seen_at")
    private LocalDateTime ownerChatSeenAt;

    /** 워커가 마지막으로 채팅을 본 시각 — 이후 점주 메시지를 unread 로 카운트 */
    @Column(name = "worker_chat_seen_at")
    private LocalDateTime workerChatSeenAt;

    @Builder
    public ShiftMatch(Shift shift, User worker) {
        this.shift = shift;
        this.worker = worker;
        this.status = MatchStatus.MATCHED;
        this.matchedAt = LocalDateTime.now();
    }

    public void markOwnerChatSeen(LocalDateTime at) {
        this.ownerChatSeenAt = at;
    }

    public void markWorkerChatSeen(LocalDateTime at) {
        this.workerChatSeenAt = at;
    }

    public void checkIn(LocalDateTime at) {
        this.checkInAt = at;
        this.status = MatchStatus.CHECKED_IN;
    }

    public void checkOut(LocalDateTime at) {
        this.checkOutAt = at;
        this.status = MatchStatus.CHECKED_OUT;
    }

    public void markNoShow() {
        this.status = MatchStatus.NO_SHOW;
    }

    public void cancel() {
        this.status = MatchStatus.CANCELED;
    }
}
