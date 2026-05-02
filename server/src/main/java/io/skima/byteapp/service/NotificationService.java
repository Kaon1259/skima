package io.skima.byteapp.service;

import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Payout;
import io.skima.byteapp.domain.PayoutStatus;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftApplication;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.dto.NotificationItem;
import io.skima.byteapp.repository.PayoutRepository;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftApplicationRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.ShiftRepository;
import io.skima.byteapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final ShiftRepository shiftRepository;
    private final ShiftApplicationRepository applicationRepository;
    private final ShiftMatchRepository matchRepository;
    private final RatingRepository ratingRepository;
    private final PayoutRepository payoutRepository;
    private final UserRepository userRepository;
    private final io.skima.byteapp.repository.WorkerFavoriteCafeRepository workerFavRepository;

    @Transactional(readOnly = true)
    public List<NotificationItem> forOwner(User owner) {
        record Raw(String type, String title, String subtitle, String route,
                   Long targetId, LocalDateTime at, String severity) {}
        List<Raw> raws = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime weekAgo = now.minusDays(7);
        LocalDateTime dayAgo = now.minusDays(1);

        List<Shift> myShifts = shiftRepository.findAllByOwnerId(owner.getId());

        // 1) 새 지원자
        for (Shift s : myShifts) {
            List<ShiftApplication> apps = applicationRepository.findAllByShiftIdOrderByAppliedAtAsc(s.getId());
            long pending = apps.stream().filter(a -> a.getStatus() == ApplicationStatus.PENDING).count();
            if (pending > 0) {
                ShiftApplication latest = apps.stream()
                        .filter(a -> a.getStatus() == ApplicationStatus.PENDING)
                        .max(Comparator.comparing(ShiftApplication::getAppliedAt))
                        .orElse(null);
                raws.add(new Raw(
                        "NEW_APPLICATION",
                        "지원자 " + pending + "명 대기",
                        s.getCafe().getName() + " · " + s.getDescription(),
                        "/owner/shift/" + s.getId(),
                        s.getId(),
                        latest != null ? latest.getAppliedAt() : s.getCreatedAt(),
                        "warn"));
            }
        }

        // 2) 매칭 확정 (최근 7일)
        for (Shift s : myShifts) {
            matchRepository.findActiveByShiftId(s.getId()).ifPresent(m -> {
                if (m.getStatus() == MatchStatus.MATCHED
                        && m.getMatchedAt() != null && m.getMatchedAt().isAfter(weekAgo)) {
                    raws.add(new Raw(
                            "NEW_MATCH",
                            m.getWorker().getName() + " 님과 매칭 확정",
                            s.getCafe().getName() + " · " + fmtTime(s.getStartAt()),
                            "/owner/shift/" + s.getId(),
                            s.getId(),
                            m.getMatchedAt(),
                            "info"));
                }
            });
        }

        // 3) 정산 승인 + 평가 대기 — Payout REQUESTED 상태인 매칭
        for (Shift s : myShifts) {
            matchRepository.findActiveByShiftId(s.getId()).ifPresent(m -> {
                if (m.getStatus() == MatchStatus.CHECKED_OUT) {
                    payoutRepository.findByMatchId(m.getId()).ifPresent(p -> {
                        if (p.getStatus() == PayoutStatus.REQUESTED) {
                            int autoMin = 30;
                            LocalDateTime when = m.getCheckOutAt() == null ? m.getMatchedAt() : m.getCheckOutAt();
                            long elapsed = when == null ? 0
                                    : java.time.Duration.between(when, now).toMinutes();
                            long left = Math.max(0, autoMin - elapsed);
                            raws.add(new Raw(
                                    "PAYOUT_REQUESTED",
                                    m.getWorker().getName() + " · 정산 승인 + 평가 대기",
                                    s.getCafe().getName() + " · " + left + "분 후 자동 승인",
                                    "/owner/shift/" + s.getId() + "?action=approve",
                                    m.getId(),
                                    when,
                                    left <= 5 ? "warn" : "info"));
                        } else if (p.isAutoApproved()
                                && !ratingRepository.existsByMatchIdAndDirection(m.getId(), RatingDirection.OWNER_TO_WORKER)) {
                            // 자동 승인됐는데 평가 안 했음 — 평가만 별도로 남기도록 유도
                            raws.add(new Raw(
                                    "NEEDS_RATING",
                                    m.getWorker().getName() + " 평가 대기 (자동 승인됨)",
                                    s.getCafe().getName() + " · 평가만 별도로 남겨주세요",
                                    "/owner/shift/" + s.getId(),
                                    m.getId(),
                                    p.getApprovedAt() == null ? m.getMatchedAt() : p.getApprovedAt(),
                                    "warn"));
                        }
                    });
                }
            });
        }

        // 3-1) 노쇼 발생 (최근 24시간)
        List<ShiftMatch> noShows = matchRepository.findNoShowByOwnerSince(owner.getId(), dayAgo);
        for (ShiftMatch m : noShows) {
            boolean backedUp = matchRepository.findActiveByShiftId(m.getShift().getId()).isPresent();
            String title = backedUp
                    ? m.getWorker().getName() + " 노쇼 → 백업 매칭 완료"
                    : m.getWorker().getName() + " 노쇼 → 재모집중";
            raws.add(new Raw(
                    "NO_SHOW",
                    title,
                    m.getShift().getCafe().getName() + " · " + fmtTime(m.getShift().getStartAt()),
                    "/owner/shift/" + m.getShift().getId(),
                    m.getShift().getId(),
                    m.getMatchedAt(),
                    backedUp ? "info" : "warn"));
        }

        // 4) 워커가 매장에 남긴 평가 (최근 7일)
        List<Rating> received = ratingRepository.findAllByOwnerIdAndDirection(
                owner.getId(), RatingDirection.WORKER_TO_OWNER);
        for (Rating r : received) {
            if (r.getCreatedAt() == null || r.getCreatedAt().isBefore(weekAgo)) continue;
            Long cafeId = r.getMatch().getShift().getCafe().getId();
            raws.add(new Raw(
                    "WORKER_RATING",
                    "★" + r.getScore() + " 평가 도착",
                    r.getMatch().getShift().getCafe().getName() + " · " + r.getWorker().getName(),
                    "/cafe/" + cafeId,
                    r.getMatch().getId(),
                    r.getCreatedAt(),
                    r.getScore() >= 4 ? "success" : "warn"));
        }

        // unread 판정 + 정렬
        LocalDateTime seenAt = owner.getLastNotificationSeenAt();
        return raws.stream()
                .sorted(Comparator.comparing(Raw::at).reversed())
                .map(r -> {
                    boolean unread = seenAt == null || r.at().isAfter(seenAt);
                    return new NotificationItem(
                            r.type(), r.title(), r.subtitle(), r.route(),
                            r.targetId(), r.at(), r.severity(), unread);
                })
                .toList();
    }

    @Transactional
    public void markAllSeen(User owner) {
        // detached entity 일 수 있으므로 다시 로드
        userRepository.findById(owner.getId()).ifPresent(u -> u.markNotificationsSeen(LocalDateTime.now()));
    }

    @Transactional(readOnly = true)
    public List<NotificationItem> forWorker(User worker) {
        record Raw(String type, String title, String subtitle, String route,
                   Long targetId, LocalDateTime at, String severity) {}
        List<Raw> raws = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime weekAgo = now.minusDays(7);

        // 1) 본인 지원 상태 변화 — REJECTED / WITHDRAWN(자동철회) — 최근 7일
        List<ShiftApplication> myApps = applicationRepository.findAllByWorkerId(worker.getId());
        for (ShiftApplication a : myApps) {
            if (a.getAppliedAt() == null || a.getAppliedAt().isBefore(weekAgo)) continue;
            Shift s = a.getShift();
            String cafeName = s.getCafe().getName();
            String desc = s.getDescription() == null ? "" : s.getDescription();
            if (a.getStatus() == ApplicationStatus.REJECTED) {
                // 시프트 자체가 취소된 케이스 vs 다른 워커가 채택된 케이스 구분
                boolean shiftCanceled = s.getStatus() == io.skima.byteapp.domain.ShiftStatus.CANCELED;
                raws.add(new Raw(
                        shiftCanceled ? "SHIFT_CANCELED" : "APPLICATION_REJECTED",
                        shiftCanceled
                                ? cafeName + " · 시프트 취소됨"
                                : cafeName + " · 다른 워커와 매칭됨",
                        desc + " (" + fmtTime(s.getStartAt()) + ")",
                        "/cafe/" + s.getCafe().getId(),
                        s.getId(),
                        a.getAppliedAt(),
                        "warn"));
            } else if (a.getStatus() == ApplicationStatus.WITHDRAWN) {
                // 자동 철회와 본인 철회를 구분할 단서가 없으므로 일괄 INFO로 노출
                // 단, 같은 시각 다른 시프트에 ACCEPTED 가 있으면 자동 철회로 간주
                boolean autoByConflict = myApps.stream().anyMatch(x ->
                        x.getStatus() == ApplicationStatus.ACCEPTED
                        && timeOverlapsWithBuffer(x.getShift(), s, 1));
                if (autoByConflict) {
                    raws.add(new Raw(
                            "APPLICATION_AUTO_WITHDRAWN",
                            cafeName + " · 일정 충돌로 자동 취소",
                            desc + " (" + fmtTime(s.getStartAt()) + ")",
                            "/cafe/" + s.getCafe().getId(),
                            s.getId(),
                            a.getAppliedAt(),
                            "warn"));
                }
            }
        }

        // 2) 매칭 확정 / 노쇼 신고됨 / 평가 대기 / 받은 평가 / 입금완료 — 최근 7일
        List<ShiftMatch> myMatches = matchRepository.findAllByWorkerId(worker.getId());
        for (ShiftMatch m : myMatches) {
            Shift s = m.getShift();
            if (m.getMatchedAt() != null && m.getMatchedAt().isAfter(weekAgo)
                    && (m.getStatus() == MatchStatus.MATCHED
                            || m.getStatus() == MatchStatus.CHECKED_IN
                            || m.getStatus() == MatchStatus.CHECKED_OUT)) {
                raws.add(new Raw(
                        "NEW_MATCH",
                        s.getCafe().getName() + " · 매칭 확정",
                        fmtTime(s.getStartAt()) + " 시작",
                        "/worker/matches?focus=" + m.getId(),
                        m.getId(),
                        m.getMatchedAt(),
                        "success"));
            }
            if (m.getStatus() == MatchStatus.NO_SHOW
                    && m.getMatchedAt() != null && m.getMatchedAt().isAfter(weekAgo)) {
                raws.add(new Raw(
                        "NOSHOW_REPORTED",
                        s.getCafe().getName() + " · 노쇼 처리됨",
                        "근무 시작 시각 무체크인 — 신뢰도에 반영됩니다",
                        "/worker/matches?focus=" + m.getId(),
                        m.getId(),
                        m.getMatchedAt(),
                        "warn"));
            }
            if (m.getStatus() == MatchStatus.CANCELED
                    && m.getMatchedAt() != null && m.getMatchedAt().isAfter(weekAgo)) {
                raws.add(new Raw(
                        "SHIFT_CANCELED",
                        s.getCafe().getName() + " · 매칭 취소됨",
                        "점주가 시프트를 취소했습니다 — " + fmtTime(s.getStartAt()),
                        "/cafe/" + s.getCafe().getId(),
                        m.getId(),
                        m.getMatchedAt(),
                        "warn"));
            }
            if (m.getStatus() == MatchStatus.CHECKED_OUT
                    && !ratingRepository.existsByMatchIdAndDirection(m.getId(), RatingDirection.WORKER_TO_OWNER)) {
                raws.add(new Raw(
                        "NEEDS_RATING",
                        s.getCafe().getName() + " · 매장 평가 대기",
                        "근무 종료 후 매장 평가를 남겨주세요",
                        "/worker/matches?focus=" + m.getId() + "&action=rate",
                        m.getId(),
                        m.getCheckOutAt() == null ? m.getMatchedAt() : m.getCheckOutAt(),
                        "warn"));
            }
        }

        // 3) 점주가 나에게 남긴 평가 (최근 7일)
        List<Rating> received = ratingRepository.findAllByWorkerIdAndDirection(
                worker.getId(), RatingDirection.OWNER_TO_WORKER);
        for (Rating r : received) {
            if (r.getCreatedAt() == null || r.getCreatedAt().isBefore(weekAgo)) continue;
            raws.add(new Raw(
                    "OWNER_RATING",
                    "★" + r.getScore() + " 평가 도착",
                    r.getMatch().getShift().getCafe().getName(),
                    "/worker/stats",
                    r.getMatch().getId(),
                    r.getCreatedAt(),
                    r.getScore() >= 4 ? "success" : "warn"));
        }

        // 5) 즐겨찾기 매장 새 시프트 (최근 24h, OPEN 상태) — Phase 3 리텐션
        List<Long> favCafeIds = workerFavRepository
                .findAllByWorkerIdOrderByCreatedAtDesc(worker.getId()).stream()
                .map(f -> f.getCafe().getId())
                .toList();
        if (!favCafeIds.isEmpty()) {
            LocalDateTime dayAgoForFav = now.minusDays(1);
            for (Shift s : shiftRepository.findAll()) {
                if (s.getStatus() != io.skima.byteapp.domain.ShiftStatus.OPEN) continue;
                if (s.getCreatedAt() == null || s.getCreatedAt().isBefore(dayAgoForFav)) continue;
                if (!favCafeIds.contains(s.getCafe().getId())) continue;
                // 이미 본인이 지원했거나 매칭된 시프트는 노출 안 함
                boolean alreadyApplied = myApps.stream()
                        .anyMatch(a -> a.getShift().getId().equals(s.getId())
                                && a.getStatus() != ApplicationStatus.WITHDRAWN);
                if (alreadyApplied) continue;
                raws.add(new Raw(
                        "FAVORITE_CAFE_NEW_SHIFT",
                        "★ " + s.getCafe().getName() + " 새 시프트",
                        fmtTime(s.getStartAt()) + " 시작 · 시급 ₩" + String.format("%,d", s.getHourlyWage()),
                        "/cafe/" + s.getCafe().getId(),
                        s.getId(),
                        s.getCreatedAt(),
                        "success"));
            }
        }

        // 4) 정산 완료 (최근 7일)
        List<Payout> myPayouts = payoutRepository.findAllByWorkerId(worker.getId());
        for (Payout p : myPayouts) {
            if (p.getStatus() != PayoutStatus.COMPLETED) continue;
            LocalDateTime when = p.getCompletedAt() == null ? p.getTriggerAt() : p.getCompletedAt();
            if (when == null || when.isBefore(weekAgo)) continue;
            raws.add(new Raw(
                    "PAYOUT_COMPLETED",
                    p.getMatch().getShift().getCafe().getName() + " · 입금 완료",
                    "₩" + String.format("%,d", p.getNetAmount()),
                    "/worker/payouts?focus=" + p.getId(),
                    p.getId(),
                    when,
                    "success"));
        }

        LocalDateTime seenAt = worker.getLastNotificationSeenAt();
        return raws.stream()
                .sorted(Comparator.comparing(Raw::at).reversed())
                .map(r -> {
                    boolean unread = seenAt == null || r.at().isAfter(seenAt);
                    return new NotificationItem(
                            r.type(), r.title(), r.subtitle(), r.route(),
                            r.targetId(), r.at(), r.severity(), unread);
                })
                .toList();
    }

    /** 두 시프트의 시간대가 buffer 시간 만큼 겹치는지 (정확한 1시간 버퍼 룰) */
    private static boolean timeOverlapsWithBuffer(Shift a, Shift b, int bufferHours) {
        if (a == null || b == null) return false;
        LocalDateTime aStart = a.getStartAt().minusHours(bufferHours);
        LocalDateTime aEnd = a.getEndAt().plusHours(bufferHours);
        return b.getStartAt().isBefore(aEnd) && b.getEndAt().isAfter(aStart);
    }

    private static String fmtTime(LocalDateTime t) {
        if (t == null) return "";
        return String.format("%02d/%02d %02d:%02d",
                t.getMonthValue(), t.getDayOfMonth(), t.getHour(), t.getMinute());
    }
}
