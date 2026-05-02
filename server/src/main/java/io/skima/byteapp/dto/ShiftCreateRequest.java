package io.skima.byteapp.dto;

import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.SkillLevel;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.Set;

public record ShiftCreateRequest(
        @NotNull Long cafeId,
        @NotNull @Future LocalDateTime startAt,
        @NotNull @Future LocalDateTime endAt,
        @NotNull @Min(1) Integer hourlyWage,
        Integer headcount,
        String description,
        JobRole jobRole,
        SkillLevel minSkill,
        Set<String> requirements
) {
}
