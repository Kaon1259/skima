package io.skima.byteapp.dto;

import io.skima.byteapp.domain.Dispute;
import io.skima.byteapp.domain.DisputeReason;
import io.skima.byteapp.domain.DisputeStatus;
import io.skima.byteapp.domain.DisputeVerdict;
import io.skima.byteapp.domain.UserRole;

import java.time.LocalDateTime;

public record DisputeResponse(
        Long id,
        Long matchId,
        Long shiftId,
        String cafeName,
        String workerName,
        Long reporterId,
        String reporterName,
        UserRole reporterRole,
        DisputeReason reason,
        String comment,
        DisputeStatus status,
        DisputeVerdict verdict,
        String resolutionNote,
        LocalDateTime createdAt,
        LocalDateTime resolvedAt
) {
    public static DisputeResponse from(Dispute d) {
        return new DisputeResponse(
                d.getId(),
                d.getMatch().getId(),
                d.getMatch().getShift().getId(),
                d.getMatch().getShift().getCafe().getName(),
                d.getMatch().getWorker().getName(),
                d.getReporter().getId(),
                d.getReporter().getName(),
                d.getReporterRole(),
                d.getReason(),
                d.getComment(),
                d.getStatus(),
                d.getVerdict(),
                d.getResolutionNote(),
                d.getCreatedAt(),
                d.getResolvedAt()
        );
    }
}
