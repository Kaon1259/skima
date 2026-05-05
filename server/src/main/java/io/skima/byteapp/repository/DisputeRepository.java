package io.skima.byteapp.repository;

import io.skima.byteapp.domain.Dispute;
import io.skima.byteapp.domain.DisputeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DisputeRepository extends JpaRepository<Dispute, Long> {

    List<Dispute> findAllByMatchId(Long matchId);

    Optional<Dispute> findFirstByMatchIdAndReporterId(Long matchId, Long reporterId);

    List<Dispute> findAllByStatusOrderByCreatedAtAsc(DisputeStatus status);

    @Query("select d from Dispute d where d.reporter.id = :workerId order by d.createdAt desc")
    List<Dispute> findAllByReporterId(@Param("workerId") Long workerId);

    @Query("""
            select d from Dispute d
            where d.match.shift.cafe.owner.id = :ownerId
            order by d.createdAt desc
            """)
    List<Dispute> findAllByOwnerId(@Param("ownerId") Long ownerId);

    @Query("""
            select d from Dispute d
            where d.match.worker.id = :workerId
            order by d.createdAt desc
            """)
    List<Dispute> findAllByMatchWorkerId(@Param("workerId") Long workerId);
}
