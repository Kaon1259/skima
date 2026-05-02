package io.skima.byteapp.dto;

import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.SkillLevel;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public record BulkShiftCreateRequest(
        @NotNull Long cafeId,
        @NotNull @Future LocalDateTime firstStartAt,
        @NotNull @Min(1) @Max(24) Integer durationHours,
        @NotNull @Min(1) Integer hourlyWage,
        Integer headcount,
        String description,
        /** 시작일~시작일+repeatDays-1 범위. null/empty 면 매일, 채워져있으면 해당 요일만 */
        List<DayOfWeek> daysOfWeek,
        /** 며칠 동안 동일 시간대 반복 (1~60). 요일 필터와 함께면 범위 윈도우로 동작 */
        @NotNull @Min(1) @Max(60) Integer repeatDays,
        JobRole jobRole,
        SkillLevel minSkill,
        Set<String> requirements
) {
}
