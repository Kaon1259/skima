package io.skima.byteapp.dto;

import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.ShiftApplication;

import java.time.LocalDateTime;

public record ApplicationResponse(
        Long id,
        Long shiftId,
        Long workerId,
        String workerName,
        LocalDateTime appliedAt,
        ApplicationStatus status
) {
    public static ApplicationResponse from(ShiftApplication a) {
        return new ApplicationResponse(
                a.getId(),
                a.getShift().getId(),
                a.getWorker().getId(),
                a.getWorker().getName(),
                a.getAppliedAt(),
                a.getStatus()
        );
    }
}
