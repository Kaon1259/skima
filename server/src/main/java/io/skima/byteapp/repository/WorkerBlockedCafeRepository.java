package io.skima.byteapp.repository;

import io.skima.byteapp.domain.WorkerBlockedCafe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WorkerBlockedCafeRepository extends JpaRepository<WorkerBlockedCafe, Long> {

    List<WorkerBlockedCafe> findAllByWorkerIdOrderByCreatedAtDesc(Long workerId);

    Optional<WorkerBlockedCafe> findByWorkerIdAndCafeId(Long workerId, Long cafeId);

    boolean existsByWorkerIdAndCafeId(Long workerId, Long cafeId);

    @Query("select b.cafe.id from WorkerBlockedCafe b where b.worker.id = :workerId")
    List<Long> findCafeIdsByWorkerId(@Param("workerId") Long workerId);
}
