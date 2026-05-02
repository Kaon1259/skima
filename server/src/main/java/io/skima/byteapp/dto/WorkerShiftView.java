package io.skima.byteapp.dto;

import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.CafeType;
import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.SkillLevel;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

public record WorkerShiftView(
        Long id,
        Long cafeId,
        String cafeName,
        String cafeAddress,
        CafeType cafeType,
        String brandKey,
        String brandLetter,
        String brandColor,
        String brandName,
        LocalDateTime startAt,
        LocalDateTime endAt,
        Integer hourlyWage,
        Integer headcount,
        ShiftStatus status,
        String description,
        LocalDateTime createdAt,
        ApplicationStatus myApplicationStatus,
        // 매장 신뢰도 시그널 — 워커가 매장 선택할 때 참고
        Double cafeAvgRating,
        Integer cafeRatingsCount,
        Double cafeNoShowRate,
        // 직무·등급·자격 (Phase A 능력 매칭)
        JobRole jobRole,
        SkillLevel minSkill,
        Set<String> requirements
) {
    public static WorkerShiftView from(Shift s, ApplicationStatus myStatus, BrandResponse brand,
                                       Double cafeAvgRating, Integer cafeRatingsCount, Double cafeNoShowRate) {
        return new WorkerShiftView(
                s.getId(),
                s.getCafe().getId(),
                s.getCafe().getName(),
                s.getCafe().getAddress(),
                s.getCafe().getCafeType(),
                s.getCafe().getBrandKey(),
                brand != null ? brand.letter() : null,
                brand != null ? brand.color() : null,
                brand != null ? brand.name() : null,
                s.getStartAt(),
                s.getEndAt(),
                s.getHourlyWage(),
                s.getHeadcount(),
                s.getStatus(),
                s.getDescription(),
                s.getCreatedAt(),
                myStatus,
                cafeAvgRating,
                cafeRatingsCount,
                cafeNoShowRate,
                s.getJobRole(),
                s.getMinSkill(),
                s.getRequirements() == null ? new HashSet<>() : new HashSet<>(s.getRequirements())
        );
    }
}
