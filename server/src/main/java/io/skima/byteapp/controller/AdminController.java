package io.skima.byteapp.controller;

import io.skima.byteapp.domain.HealthCertStatus;
import io.skima.byteapp.dto.HealthCertReviewItem;
import io.skima.byteapp.dto.KpiResponse;
import io.skima.byteapp.repository.UserRepository;
import io.skima.byteapp.service.KpiService;
import io.skima.byteapp.service.PayoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final KpiService kpiService;
    private final PayoutService payoutService;
    private final UserRepository userRepository;

    /** 북극성 KPI: 1시간 매칭률 + 30분 입금률 */
    @GetMapping("/kpi")
    public KpiResponse kpi(@RequestParam(required = false, defaultValue = "30") int sinceDays) {
        LocalDateTime since = LocalDateTime.now().minusDays(sinceDays);
        return kpiService.getNorthStar(since);
    }

    /** 정산 강제 트리거 (테스트/디버그용) */
    @PostMapping("/payouts/run")
    public Map<String, Object> runPayouts() {
        int processed = payoutService.executePendingPayouts();
        return Map.of("processed", processed);
    }

    /* ========= 보건증 검토 ========= */

    @GetMapping("/health-certs")
    public List<HealthCertReviewItem> healthCerts(
            @RequestParam(required = false, defaultValue = "PENDING") String status) {
        HealthCertStatus s;
        try {
            s = HealthCertStatus.valueOf(status);
        } catch (IllegalArgumentException e) {
            s = HealthCertStatus.PENDING;
        }
        final HealthCertStatus filter = s;
        return userRepository.findAll().stream()
                .filter(u -> u.getHealthCertStatus() == filter)
                .map(HealthCertReviewItem::from)
                .toList();
    }

    @PostMapping("/health-certs/{userId}/verify")
    @Transactional
    public Map<String, Object> verifyHealthCert(@PathVariable Long userId) {
        var u = userRepository.findById(userId)
                .orElseThrow(() -> io.skima.byteapp.common.BusinessException.notFound("사용자를 찾을 수 없습니다"));
        u.verifyHealthCert();
        // capability set 에 HEALTH_CERT 추가
        var certs = new java.util.HashSet<>(u.getCertifications());
        certs.add("HEALTH_CERT");
        u.updateWorkerProfile(null, null, certs);
        return Map.of(
                "ok", true,
                "userId", u.getId(),
                "status", u.getHealthCertStatus().name(),
                "verifiedAt", u.getHealthCertVerifiedAt());
    }

    @PostMapping("/health-certs/{userId}/reject")
    @Transactional
    public Map<String, Object> rejectHealthCert(@PathVariable Long userId,
                                                  @RequestBody(required = false) Map<String, String> body) {
        var u = userRepository.findById(userId)
                .orElseThrow(() -> io.skima.byteapp.common.BusinessException.notFound("사용자를 찾을 수 없습니다"));
        String reason = body != null ? body.get("reason") : null;
        u.rejectHealthCert(reason != null ? reason : "관리자 검토 후 거부");
        // capability set 에서 HEALTH_CERT 제거
        var certs = new java.util.HashSet<>(u.getCertifications());
        certs.remove("HEALTH_CERT");
        u.updateWorkerProfile(null, null, certs);
        return Map.of(
                "ok", true,
                "userId", u.getId(),
                "status", u.getHealthCertStatus().name(),
                "reason", u.getHealthCertRejectReason());
    }
}
