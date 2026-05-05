package io.skima.byteapp.scheduler;

import io.skima.byteapp.domain.Dispute;
import io.skima.byteapp.domain.DisputeStatus;
import io.skima.byteapp.repository.DisputeRepository;
import io.skima.byteapp.service.DisputeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DisputeScheduler {

    /** PENDING 후 자동 판정까지 대기 시간 — 양측 진술/관리자 개입 여유 */
    private static final long AUTO_RESOLVE_DELAY_MINUTES = 60;

    private final DisputeRepository disputeRepository;
    private final DisputeService disputeService;

    /** 매시간 5분에 PENDING 분쟁 자동 판정 — 생성 후 60분 경과한 것만 */
    @Scheduled(cron = "0 5 * * * *")
    public void resolvePending() {
        LocalDateTime now = LocalDateTime.now();
        var pending = disputeRepository.findAllByStatusOrderByCreatedAtAsc(DisputeStatus.PENDING);
        int resolved = 0;
        int skipped = 0;
        for (Dispute d : pending) {
            if (d.getCreatedAt() == null
                    || Duration.between(d.getCreatedAt(), now).toMinutes() < AUTO_RESOLVE_DELAY_MINUTES) {
                skipped++;
                continue;
            }
            try {
                disputeService.autoResolve(d.getId());
                resolved++;
            } catch (Exception e) {
                log.warn("Dispute#{} auto-resolve failed: {}", d.getId(), e.getMessage());
            }
        }
        if (resolved > 0 || (skipped > 0 && pending.size() <= 5)) {
            log.info("[SCHEDULER] dispute auto-resolve: resolved={} skipped={}", resolved, skipped);
        }
    }
}
