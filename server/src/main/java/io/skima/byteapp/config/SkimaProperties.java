package io.skima.byteapp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "skima")
public class SkimaProperties {

    private Matching matching = new Matching();
    private Payout payout = new Payout();
    private Seed seed = new Seed();

    @Getter
    @Setter
    public static class Matching {
        /** 1시간 매칭 SLA (분 단위) */
        private int slaMinutes = 60;
    }

    @Getter
    @Setter
    public static class Payout {
        /** 30분 입금 SLA (분 단위) — 점주 승인(또는 자동 승인) 후 송금까지 */
        private int slaMinutes = 30;
        /** 체크아웃 후 N분 무응답 시 자동 승인 (REQUESTED → SCHEDULED). 정체성 30분 페이 보장 */
        private int autoApproveMinutes = 30;
        /** 점주 부담 플랫폼 수수료율 */
        private double platformFeeRate = 0.12;
        /** 일급 비과세 임계값(원) — 미만은 원천징수 0 */
        private int dailyTaxThreshold = 150_000;
        /** 일용근로 원천징수율 */
        private double dailyTaxRate = 0.066;
    }

    @Getter
    @Setter
    public static class Seed {
        /** true 면 매 부팅마다 wipe + reseed (dev). 운영 전환 시 false. */
        private boolean refreshOnStart = true;
        /** false 면 wipe 후 시프트와 지원만 비워둠 — 사용자가 직접 만들어 테스트용 */
        private boolean createShiftsAndApps = true;
    }

    private NoShow noShow = new NoShow();

    @Getter
    @Setter
    public static class NoShow {
        /** 시프트 시작 후 N분 까지 체크인 없으면 노쇼 처리 */
        private int graceMinutes = 30;
    }
}
