package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages",
        indexes = @Index(name = "idx_chat_match_created", columnList = "match_id, created_at"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private ShiftMatch match;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_role", nullable = false, length = 16)
    private UserRole senderRole;

    @Column(nullable = false, length = 1000)
    private String body;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public ChatMessage(ShiftMatch match, User sender, UserRole senderRole, String body) {
        this.match = match;
        this.sender = sender;
        this.senderRole = senderRole;
        this.body = body;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
