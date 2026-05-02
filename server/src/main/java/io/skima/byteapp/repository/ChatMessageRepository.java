package io.skima.byteapp.repository;

import io.skima.byteapp.domain.ChatMessage;
import io.skima.byteapp.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findAllByMatchIdOrderByCreatedAtAsc(Long matchId);

    long countByMatchIdAndSenderRole(Long matchId, UserRole senderRole);

    long countByMatchIdAndSenderRoleAndCreatedAtAfter(
            Long matchId, UserRole senderRole, LocalDateTime after);
}
