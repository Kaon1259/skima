package io.skima.byteapp.dto;

import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.SkillLevel;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

public record ShiftResponse(
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
        JobRole jobRole,
        SkillLevel minSkill,
        Set<String> requirements,
        LocalDateTime favoritesOnlyUntil
) {
    public static ShiftResponse from(Shift s) {
        Long minutes = (s.getMatchedAt() != null && s.getCreatedAt() != null)
                ? java.time.Duration.between(s.getCreatedAt(), s.getMatchedAt()).toMinutes()
                : null;
        return new ShiftResponse(
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
                minutes,
                s.getJobRole(),
                s.getMinSkill(),
                s.getRequirements() == null ? new HashSet<>() : new HashSet<>(s.getRequirements()),
                s.getFavoritesOnlyUntil()
        );
    }
}
