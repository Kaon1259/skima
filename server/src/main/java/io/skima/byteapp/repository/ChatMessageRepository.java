package io.skima.byteapp.repository;

import io.skima.byteapp.domain.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findAllByMatchIdOrderByCreatedAtAsc(Long matchId);
}
