package io.skima.byteapp.controller;

import io.skima.byteapp.dto.CafeDetailResponse;
import io.skima.byteapp.security.AuthUser;
import io.skima.byteapp.service.CafeDetailService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 매장 상세 — 인증된 사용자(점주/워커/어드민) 모두 접근 가능.
 * 본인 소유 매장이면 ownerView 추가로 채워짐.
 */
@RestController
@RequestMapping("/api/cafes")
@RequiredArgsConstructor
public class CafeController {

    private final CafeDetailService cafeDetailService;

    @GetMapping("/{cafeId}/detail")
    public CafeDetailResponse detail(@AuthenticationPrincipal AuthUser principal,
                                     @PathVariable Long cafeId) {
        return cafeDetailService.buildDetail(principal.getDomainUser(), cafeId);
    }
}
