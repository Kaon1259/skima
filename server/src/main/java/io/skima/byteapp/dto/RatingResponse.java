package io.skima.byteapp.dto;

import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;

import java.time.LocalDateTime;

public record RatingResponse(
        Long id,
        Long matchId,
        RatingDirection direction,
        Long workerId,
        String workerName,
        Long ownerId,
        String ownerName,
        Long cafeId,
        String cafeName,
        int score,
        boolean willRehire,
        String comment,
        LocalDateTime createdAt
) {
    public static RatingResponse from(Rating r) {
        var cafe = r.getMatch().getShift().getCafe();
        return new RatingResponse(
                r.getId(),
                r.getMatch().getId(),
                r.getDirection(),
                r.getWorker().getId(),
                r.getWorker().getName(),
                r.getOwner().getId(),
                r.getOwner().getName(),
                cafe.getId(),
                cafe.getName(),
                r.getScore(),
                r.isWillRehire(),
                r.getComment(),
                r.getCreatedAt()
        );
    }
}
