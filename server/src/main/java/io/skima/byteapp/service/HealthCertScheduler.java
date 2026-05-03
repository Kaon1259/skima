package io.skima.byteapp.service;

import io.skima.byteapp.domain.HealthCertStatus;
import io.skima.byteapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 보건증 만료 자동 처리 — 매일 자정 1분 실행.
 * VERIFIED + healthCertExpiresAt < now 인 워커를 EXPIRED 로 전이.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HealthCertScheduler {

    private final UserRepository userRepository;

    @Scheduled(cron = "0 1 0 * * *")
    @Transactional
    public void expireDaily() {
        try {
            var now = LocalDateTime.now();
            var users = userRepository.findAll();
            int expired = 0;
            for (var u : users) {
                if (u.getHealthCertStatus() == HealthCertStatus.VERIFIED
                        && u.getHealthCertExpiresAt() != null
                        && u.getHealthCertExpiresAt().isBefore(now)) {
                    u.expireHealthCert();
                    expired++;
                }
            }
            if (expired > 0) log.info("[HEALTH_CERT] expired {} workers", expired);
        } catch (Exception e) {
            log.error("HealthCert expire scheduler error", e);
        }
    }
}
