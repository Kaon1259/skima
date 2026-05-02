package io.skima.byteapp.repository;

import io.skima.byteapp.domain.OwnerFavoriteWorker;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OwnerFavoriteWorkerRepository extends JpaRepository<OwnerFavoriteWorker, Long> {

    List<OwnerFavoriteWorker> findAllByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    Optional<OwnerFavoriteWorker> findByOwnerIdAndWorkerId(Long ownerId, Long workerId);

    boolean existsByOwnerIdAndWorkerId(Long ownerId, Long workerId);
}
