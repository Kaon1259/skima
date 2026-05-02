package io.skima.byteapp.controller;

import io.skima.byteapp.dto.WorkerProfileUpdateRequest;
import io.skima.byteapp.repository.UserRepository;
import io.skima.byteapp.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final UserRepository userRepository;

    @GetMapping
    public Map<String, Object> me(@AuthenticationPrincipal AuthUser principal) {
        var u = principal.getDomainUser();
        // 워커는 자기신고 능력도 함께 노출 (프로필 화면 + 매칭 매트릭스용)
        Map<String, Object> body = new HashMap<>();
        body.put("id", u.getId());
        body.put("username", u.getUsername());
        body.put("name", u.getName());
        body.put("role", u.getRole().name());
        body.put("selfReportedLevel", u.getSelfReportedLevel() == null ? null : u.getSelfReportedLevel().name());
        body.put("capableRoles", u.getCapableRoles() == null ? java.util.Set.of()
                : u.getCapableRoles().stream().map(Enum::name).toList());
        body.put("certifications", u.getCertifications() == null ? java.util.Set.of() : u.getCertifications());
        return body;
    }

    /** 워커 본인의 능력 자기신고 갱신. 모든 필드 nullable — 채워진 것만 갱신. */
    @PutMapping("/worker-profile")
    @Transactional
    public Map<String, Object> updateWorkerProfile(@AuthenticationPrincipal AuthUser principal,
                                                   @RequestBody WorkerProfileUpdateRequest req) {
        var u = userRepository.findById(principal.getDomainUser().getId())
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
        u.updateWorkerProfile(req.selfReportedLevel(), req.capableRoles(), req.certifications());
        return me(principal);
    }
}
