package io.skima.byteapp.dto;

import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.SkillLevel;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.DayOfWeek;
import java.util.Set;

public record ShiftTemplateRequest(
        @NotNull Long cafeId,
        @Size(max = 64) String name,
        @NotEmpty Set<DayOfWeek> daysOfWeek,
        @NotNull @Min(0) Integer startHour,
        @Min(0) Integer startMinute,
        @NotNull Double durationHours,
        @NotNull @Min(1) Integer hourlyWage,
        Integer headcount,
        String description,
        JobRole jobRole,
        SkillLevel minSkill,
        Set<String> requirements,
        Boolean active
) {
}
