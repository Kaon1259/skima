package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.ChatMessage;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.repository.ChatMessageRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatRepository;
    private final ShiftMatchRepository matchRepository;

    @Transactional(readOnly = true)
    public List<ChatMessage> list(User user, Long matchId) {
        ShiftMatch match = mustParticipate(user, matchId);
        return chatRepository.findAllByMatchIdOrderByCreatedAtAsc(match.getId());
    }

    @Transactional
    public ChatMessage send(User user, Long matchId, String body) {
        if (body == null || body.trim().isEmpty()) {
            throw BusinessException.badRequest("메시지를 입력해주세요");
        }
        ShiftMatch match = mustParticipate(user, matchId);
        if (match.getStatus() == MatchStatus.CANCELED) {
            throw BusinessException.conflict("취소된 매칭에는 메시지를 보낼 수 없습니다");
        }
        ChatMessage msg = ChatMessage.builder()
                .match(match)
                .sender(user)
                .senderRole(user.getRole())
                .body(body.trim())
                .build();
        return chatRepository.save(msg);
    }

    /** 사용자 role 기준 안 본 메시지 수 — 점주는 워커가 보낸 것, 워커는 점주가 보낸 것 */
    @Transactional(readOnly = true)
    public long unreadCountFor(User user, ShiftMatch match) {
        if (user.getRole() == UserRole.OWNER) {
            LocalDateTime seen = match.getOwnerChatSeenAt();
            if (seen == null) {
                return chatRepository.countByMatchIdAndSenderRole(match.getId(), UserRole.WORKER);
            }
            return chatRepository.countByMatchIdAndSenderRoleAndCreatedAtAfter(
                    match.getId(), UserRole.WORKER, seen);
        }
        if (user.getRole() == UserRole.WORKER) {
            LocalDateTime seen = match.getWorkerChatSeenAt();
            if (seen == null) {
                return chatRepository.countByMatchIdAndSenderRole(match.getId(), UserRole.OWNER);
            }
            return chatRepository.countByMatchIdAndSenderRoleAndCreatedAtAfter(
                    match.getId(), UserRole.OWNER, seen);
        }
        return 0;
    }

    @Transactional
    public void markSeen(User user, Long matchId) {
        ShiftMatch match = mustParticipate(user, matchId);
        LocalDateTime now = LocalDateTime.now();
        if (user.getRole() == UserRole.OWNER) {
            match.markOwnerChatSeen(now);
        } else if (user.getRole() == UserRole.WORKER) {
            match.markWorkerChatSeen(now);
        }
    }

    private ShiftMatch mustParticipate(User user, Long matchId) {
        ShiftMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));
        Long workerId = match.getWorker().getId();
        Long ownerId = match.getShift().getCafe().getOwner().getId();
        if (!user.getId().equals(workerId) && !user.getId().equals(ownerId)) {
            throw BusinessException.forbidden("본인 매칭의 채팅방만 접근할 수 있습니다");
        }
        return match;
    }
}
