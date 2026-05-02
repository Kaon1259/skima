package io.skima.byteapp.scheduler;

import io.skima.byteapp.service.NoShowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class NoShowScheduler {

    private final NoShowService noShowService;

    /** 매분 30초마다 노쇼 sweep — PayoutScheduler(0초)와 어긋나게 둠 */
    @Scheduled(cron = "30 * * * * *")
    public void sweep() {
        var out = noShowService.sweep();
        if (out.noShowCount() > 0) {
            log.info("[SCHEDULER] no-show sweep: noShow={} backupMatched={} reopened={}",
                    out.noShowCount(), out.backupMatchedCount(), out.reopenedCount());
        }
    }
}
