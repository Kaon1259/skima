package io.skima.byteapp.scheduler;

import io.skima.byteapp.service.PayoutService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PayoutScheduler {

    private final PayoutService payoutService;

    /** 매분 0초마다 (1) 점주 무응답 자동 승인 (2) SCHEDULED 송금 처리. 30분 SLA 운영 축. */
    @Scheduled(cron = "0 * * * * *")
    public void runPendingPayouts() {
        int autoApproved = payoutService.autoApproveStale();
        if (autoApproved > 0) {
            log.info("[SCHEDULER] auto-approved {} stale REQUESTED payouts", autoApproved);
        }
        int processed = payoutService.executePendingPayouts();
        if (processed > 0) {
            log.info("[SCHEDULER] processed {} pending payouts", processed);
        }
    }
}
