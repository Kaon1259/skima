package io.skima.byteapp.dto;

import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.ShiftTemplate;
import io.skima.byteapp.domain.SkillLevel;

import java.time.DayOfWeek;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public record ShiftTemplateResponse(
        Long id,
        Long cafeId,
        String cafeName,
        String name,
        Set<DayOfWeek> daysOfWeek,
        Integer startHour,
        Integer startMinute,
        Double durationHours,
        Integer hourlyWage,
        Integer headcount,
        String description,
        JobRole jobRole,
        SkillLevel minSkill,
        Set<String> requirements,
        Boolean active
) {
    public static ShiftTemplateResponse from(ShiftTemplate t) {
        return new ShiftTemplateResponse(
                t.getId(),
                t.getCafe().getId(),
                t.getCafe().getName(),
                t.getName(),
                t.getDaysOfWeek() == null ? Set.of()
                        : t.getDaysOfWeek().stream().collect(Collectors.toSet()),
                t.getStartHour(),
                t.getStartMinute(),
                t.getDurationHours(),
                t.getHourlyWage(),
                t.getHeadcount(),
                t.getDescription(),
                t.getJobRole(),
                t.getMinSkill(),
                t.getRequirements() == null ? new HashSet<>() : new HashSet<>(t.getRequirements()),
                t.getActive()
        );
    }
}
