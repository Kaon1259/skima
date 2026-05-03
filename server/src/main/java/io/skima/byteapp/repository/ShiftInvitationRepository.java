package io.skima.byteapp.repository;

import io.skima.byteapp.domain.InvitationStatus;
import io.skima.byteapp.domain.ShiftInvitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ShiftInvitationRepository extends JpaRepository<ShiftInvitation, Long> {

    Optional<ShiftInvitation> findByShiftIdAndWorkerId(Long shiftId, Long workerId);

    List<ShiftInvitation> findAllByWorkerIdAndStatusOrderByCreatedAtDesc(Long workerId, InvitationStatus status);

    List<ShiftInvitation> findAllByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    List<ShiftInvitation> findAllByStatusAndExpiresAtBefore(InvitationStatus status, LocalDateTime now);
}
