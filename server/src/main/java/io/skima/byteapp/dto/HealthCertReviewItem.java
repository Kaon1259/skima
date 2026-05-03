package io.skima.byteapp.dto;

import io.skima.byteapp.domain.HealthCertStatus;
import io.skima.byteapp.domain.User;

import java.time.LocalDateTime;

public record HealthCertReviewItem(
        Long userId,
        String userName,
        String userPhone,
        String imageUrl,
        HealthCertStatus status,
        LocalDateTime uploadedAt,
        LocalDateTime verifiedAt,
        LocalDateTime expiresAt,
        String rejectReason
) {
    public static HealthCertReviewItem from(User u) {
        return new HealthCertReviewItem(
                u.getId(),
                u.getName(),
                u.getPhone(),
                u.getHealthCertImage(),
                u.getHealthCertStatus(),
                u.getHealthCertUploadedAt(),
                u.getHealthCertVerifiedAt(),
                u.getHealthCertExpiresAt(),
                u.getHealthCertRejectReason()
        );
    }
}
