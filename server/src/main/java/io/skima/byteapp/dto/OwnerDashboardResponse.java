package io.skima.byteapp.dto;

public record OwnerDashboardResponse(
        int totalShifts,
        int openShifts,
        int matchedShifts,
        int inProgressShifts,
        int completedShifts,
        int pendingApplications,
        Long avgMatchingMinutes,
        Double matchingSlaRate
) {
}
