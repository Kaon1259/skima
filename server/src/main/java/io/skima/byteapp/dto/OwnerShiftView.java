package io.skima.byteapp.dto;

import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.SkillLevel;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

public record OwnerShiftView(
        Long id,
        Long cafeId,
        String cafeName,
        String cafeAddress,
        LocalDateTime startAt,
        LocalDateTime endAt,
        Integer hourlyWage,
        Integer headcount,
        ShiftStatus status,
        String description,
        LocalDateTime createdAt,
        LocalDateTime matchedAt,
        Long matchingMinutes,
        Long minutesUntilStart,
        int applicationsCount,
        int pendingApplicationsCount,
        // 매칭/평가 정보 (있을 때)
        Long matchId,
        Long matchedWorkerId,
        String matchedWorkerName,
        String matchStatus,
        Integer ratingScore,
        Boolean willRehire,
        // 워커 → 매장 평가 완료 여부 (양방향 평가 진행 트래킹)
        Boolean workerRatedOwner,
        // 정산 상태 (있을 때) — 점주 승인 모달 트리거 + 입금완료 표시에 사용
        String payoutStatus,
        java.time.LocalDateTime payoutApprovedAt,
        Boolean payoutAutoApproved,
        java.time.LocalDateTime payoutCompletedAt,
        // 근로계약서 양측 확인 시각 (timeline 표시 + 미확인 강조용)
        java.time.LocalDateTime ownerContractAckAt,
        java.time.LocalDateTime workerContractAckAt,
        // 직무·등급·자격 (Phase A 능력 매칭)
        JobRole jobRole,
        SkillLevel minSkill,
        Set<String> requirements,
        // 점주 측 채팅 unread count (워커가 보낸 메시지 중 점주가 안 본 것)
        long chatUnreadCount
) {
    public static OwnerShiftView from(
            Shift s,
            int total,
            int pending,
            Long matchId,
            Long matchedWorkerId,
            String matchedWorkerName,
            String matchStatus,
            Integer ratingScore,
            Boolean willRehire,
            Boolean workerRatedOwner,
            String payoutStatus,
            java.time.LocalDateTime payoutApprovedAt,
            Boolean payoutAutoApproved,
            java.time.LocalDateTime payoutCompletedAt,
            java.time.LocalDateTime ownerContractAckAt,
            java.time.LocalDateTime workerContractAckAt,
            long chatUnreadCount
    ) {
        Long matchMin = (s.getMatchedAt() != null && s.getCreatedAt() != null)
                ? Duration.between(s.getCreatedAt(), s.getMatchedAt()).toMinutes()
                : null;
        Long untilStart = s.getStartAt() != null
                ? Duration.between(LocalDateTime.now(), s.getStartAt()).toMinutes()
                : null;
        return new OwnerShiftView(
                s.getId(),
                s.getCafe().getId(),
                s.getCafe().getName(),
                s.getCafe().getAddress(),
                s.getStartAt(),
                s.getEndAt(),
                s.getHourlyWage(),
                s.getHeadcount(),
                s.getStatus(),
                s.getDescription(),
                s.getCreatedAt(),
                s.getMatchedAt(),
                matchMin,
                untilStart,
                total,
                pending,
                matchId,
                matchedWorkerId,
                matchedWorkerName,
                matchStatus,
                ratingScore,
                willRehire,
                workerRatedOwner,
                payoutStatus,
                payoutApprovedAt,
                payoutAutoApproved,
                payoutCompletedAt,
                ownerContractAckAt,
                workerContractAckAt,
                s.getJobRole(),
                s.getMinSkill(),
                s.getRequirements() == null ? new HashSet<>() : new HashSet<>(s.getRequirements()),
                chatUnreadCount
        );
    }
}
