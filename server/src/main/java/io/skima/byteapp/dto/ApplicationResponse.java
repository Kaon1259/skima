package io.skima.byteapp.dto;

import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.ShiftApplication;
import io.skima.byteapp.domain.SkillLevel;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

public record ApplicationResponse(
        Long id,
        Long shiftId,
        Long workerId,
        String workerName,
        LocalDateTime appliedAt,
        ApplicationStatus status,
        // 워커 자기신고 능력 — 점주 측 매칭율 표시용
        SkillLevel workerLevel,
        Set<JobRole> workerRoles,
        Set<String> workerCertifications
) {
    public static ApplicationResponse from(ShiftApplication a) {
        var w = a.getWorker();
        return new ApplicationResponse(
                a.getId(),
                a.getShift().getId(),
                w.getId(),
                w.getName(),
                a.getAppliedAt(),
                a.getStatus(),
                w.getSelfReportedLevel(),
                w.getCapableRoles() == null ? new HashSet<>() : new HashSet<>(w.getCapableRoles()),
                w.getCertifications() == null ? new HashSet<>() : new HashSet<>(w.getCertifications())
        );
    }
}
