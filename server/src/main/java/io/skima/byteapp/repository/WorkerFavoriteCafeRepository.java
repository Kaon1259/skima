package io.skima.byteapp.repository;

import io.skima.byteapp.domain.WorkerFavoriteCafe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkerFavoriteCafeRepository extends JpaRepository<WorkerFavoriteCafe, Long> {

    List<WorkerFavoriteCafe> findAllByWorkerIdOrderByCreatedAtDesc(Long workerId);

    Optional<WorkerFavoriteCafe> findByWorkerIdAndCafeId(Long workerId, Long cafeId);

    boolean existsByWorkerIdAndCafeId(Long workerId, Long cafeId);

    /** 한 카페를 즐겨찾기한 워커 id 목록 — 단골 알림용 */
    @org.springframework.data.jpa.repository.Query(
            "select f.worker.id from WorkerFavoriteCafe f where f.cafe.id = :cafeId")
    List<Long> findWorkerIdsByCafeId(@org.springframework.data.repository.query.Param("cafeId") Long cafeId);
}
