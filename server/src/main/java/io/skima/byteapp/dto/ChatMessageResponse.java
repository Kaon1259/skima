package io.skima.byteapp.dto;

import io.skima.byteapp.domain.ChatMessage;
import io.skima.byteapp.domain.UserRole;

import java.time.LocalDateTime;

public record ChatMessageResponse(
        Long id,
        Long matchId,
        Long senderId,
        String senderName,
        UserRole senderRole,
        String body,
        LocalDateTime createdAt
) {
    public static ChatMessageResponse from(ChatMessage m) {
        return new ChatMessageResponse(
                m.getId(),
                m.getMatch().getId(),
                m.getSender().getId(),
                m.getSender().getName(),
                m.getSenderRole(),
                m.getBody(),
                m.getCreatedAt()
        );
    }
}
