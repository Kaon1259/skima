package io.skima.byteapp.controller;

import io.skima.byteapp.dto.KpiResponse;
import io.skima.byteapp.service.KpiService;
import io.skima.byteapp.service.PayoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final KpiService kpiService;
    private final PayoutService payoutService;

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
}
