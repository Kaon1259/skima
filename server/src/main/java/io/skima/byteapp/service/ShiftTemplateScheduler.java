package io.skima.byteapp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ShiftTemplateScheduler {

    private final ShiftTemplateService templateService;

    /** 매일 00:05 — 활성 템플릿으로부터 다음 14일 시프트 자동 생성 */
    @Scheduled(cron = "0 5 0 * * *")
    public void daily() {
        try {
            int n = templateService.generateForActiveTemplates();
            if (n > 0) log.info("Daily template materialize: {} new shifts", n);
        } catch (Exception e) {
            log.error("Template scheduler error", e);
        }
    }
}
