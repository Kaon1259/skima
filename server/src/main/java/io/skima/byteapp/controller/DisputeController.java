package io.skima.byteapp.controller;

import io.skima.byteapp.dto.DisputeRequest;
import io.skima.byteapp.dto.DisputeResponse;
import io.skima.byteapp.security.AuthUser;
import io.skima.byteapp.service.DisputeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/disputes")
@RequiredArgsConstructor
public class DisputeController {

    private final DisputeService disputeService;

    /** 분쟁 신고 생성 — 워커 또는 점주 본인 매칭만 */
    @PostMapping
    public DisputeResponse create(@AuthenticationPrincipal AuthUser principal,
                                   @Valid @RequestBody DisputeRequest req) {
        var d = disputeService.create(principal.getDomainUser(), req);
        return DisputeResponse.from(d);
    }

    /** 내가 신고한/내 매장 관련 분쟁 목록 */
    @GetMapping
    public List<DisputeResponse> myDisputes(@AuthenticationPrincipal AuthUser principal) {
        return disputeService.myReportedDisputes(principal.getDomainUser()).stream()
                .map(DisputeResponse::from)
                .toList();
    }

    /** 자동 판정 트리거 (테스트용 — 운영에선 cron 으로 자동) */
    @PostMapping("/{id}/auto-resolve")
    public DisputeResponse autoResolve(@PathVariable Long id) {
        return DisputeResponse.from(disputeService.autoResolve(id));
    }
}
