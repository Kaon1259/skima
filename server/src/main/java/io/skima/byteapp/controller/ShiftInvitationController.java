package io.skima.byteapp.controller;

import io.skima.byteapp.dto.ShiftInvitationRequest;
import io.skima.byteapp.dto.ShiftInvitationResponse;
import io.skima.byteapp.security.AuthUser;
import io.skima.byteapp.service.ShiftInvitationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ShiftInvitationController {

    private final ShiftInvitationService inviteService;

    /** 점주 → 워커 시프트 직접 초대 */
    @PostMapping("/api/owner/shift-invitations")
    public ShiftInvitationResponse create(@AuthenticationPrincipal AuthUser principal,
                                           @Valid @RequestBody ShiftInvitationRequest req) {
        return ShiftInvitationResponse.from(
                inviteService.create(principal.getDomainUser(), req));
    }

    /** 점주 본인 발송 초대 목록 */
    @GetMapping("/api/owner/shift-invitations")
    public List<ShiftInvitationResponse> ownerInvitations(@AuthenticationPrincipal AuthUser principal) {
        return inviteService.myOwnerInvitations(principal.getDomainUser()).stream()
                .map(ShiftInvitationResponse::from)
                .toList();
    }

    /** 워커 본인 받은 PENDING 초대 */
    @GetMapping("/api/worker/invitations")
    public List<ShiftInvitationResponse> workerInvitations(@AuthenticationPrincipal AuthUser principal) {
        return inviteService.myWorkerInvitations(principal.getDomainUser()).stream()
                .map(ShiftInvitationResponse::from)
                .toList();
    }

    /** 워커 1탭 수락 — ShiftMatch 자동 생성 */
    @PostMapping("/api/worker/invitations/{id}/accept")
    public Map<String, Object> accept(@AuthenticationPrincipal AuthUser principal,
                                       @PathVariable Long id) {
        var match = inviteService.accept(principal.getDomainUser(), id);
        return Map.of(
                "ok", true,
                "matchId", match.getId(),
                "shiftId", match.getShift().getId());
    }

    /** 워커 거절 */
    @PostMapping("/api/worker/invitations/{id}/reject")
    public ShiftInvitationResponse reject(@AuthenticationPrincipal AuthUser principal,
                                           @PathVariable Long id) {
        return ShiftInvitationResponse.from(
                inviteService.reject(principal.getDomainUser(), id));
    }
}
