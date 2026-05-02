package io.skima.byteapp.controller;

import io.skima.byteapp.dto.ChatMessageRequest;
import io.skima.byteapp.dto.ChatMessageResponse;
import io.skima.byteapp.security.AuthUser;
import io.skima.byteapp.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 워커·점주 공통 — 매칭 단위 단발 채팅 (폴링 기반 MVP) */
@RestController
@RequestMapping("/api/matches/{matchId}/messages")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping
    public List<ChatMessageResponse> list(@AuthenticationPrincipal AuthUser principal,
                                          @PathVariable Long matchId) {
        return chatService.list(principal.getDomainUser(), matchId).stream()
                .map(ChatMessageResponse::from)
                .toList();
    }

    @PostMapping
    public ChatMessageResponse send(@AuthenticationPrincipal AuthUser principal,
                                    @PathVariable Long matchId,
                                    @Valid @RequestBody ChatMessageRequest req) {
        return ChatMessageResponse.from(
                chatService.send(principal.getDomainUser(), matchId, req.body()));
    }
}
