package io.skima.byteapp.dto;

import java.time.LocalDateTime;

/**
 * 점주 인박스 항목. type 별로 click 시 다른 라우트로 보냄.
 * MVP — read 상태 없이 항상 actionable items 만 노출.
 */
public record NotificationItem(
        String type,            // NEW_APPLICATION | NEEDS_RATING | WORKER_RATING | NEW_MATCH | NO_SHOW
        String title,
        String subtitle,
        String route,           // 프론트 라우트 (e.g. /owner/shift/123)
        Long targetId,          // 관련 entity id (matchId, shiftId 등)
        LocalDateTime at,
        String severity,        // info | warn | success
        boolean unread          // user.lastNotificationSeenAt 이후 발생했는지
) {
}
