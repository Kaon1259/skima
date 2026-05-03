package io.skima.byteapp.repository;

import io.skima.byteapp.domain.Payout;
import io.skima.byteapp.domain.PayoutStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PayoutRepository extends JpaRepository<Payout, Long> {

    List<Payout> findAllByStatus(PayoutStatus status);

    @Query("""
            select p from Payout p
            where p.status = :status
              and p.triggerAt < :cutoff
            """)
    List<Payout> findStaleByStatus(@Param("status") PayoutStatus status,
                                   @Param("cutoff") LocalDateTime cutoff);

    @Query("""
            select p from Payout p
            where p.worker.id = :workerId
            order by p.triggerAt desc
            """)
    List<Payout> findAllByWorkerId(@Param("workerId") Long workerId);

    Optional<Payout> findByMatchId(Long matchId);

    @Query("""
            select p from Payout p
            where p.status = io.skima.byteapp.domain.PayoutStatus.COMPLETED
              and p.match.shift.cafe.owner.id = :ownerId
              and p.completedAt >= :start
              and p.completedAt < :end
            order by p.completedAt asc
            """)
    List<Payout> findCompletedByOwnerInRange(@Param("ownerId") Long ownerId,
                                             @Param("start") LocalDateTime start,
                                             @Param("end") LocalDateTime end);

    /** 점주 전체 매장의 모든 payout — 상태 무관, triggerAt 최신순 */
    @Query("""
            select p from Payout p
            where p.match.shift.cafe.owner.id = :ownerId
            order by p.triggerAt desc
            """)
    List<Payout> findAllByOwnerId(@Param("ownerId") Long ownerId);

    @Query("""
            select p from Payout p
            where p.match.shift.cafe.id = :cafeId
              and p.status = io.skima.byteapp.domain.PayoutStatus.COMPLETED
              and p.completedAt >= :start
              and p.completedAt < :end
            """)
    List<Payout> findCompletedByCafeInRange(@Param("cafeId") Long cafeId,
                                            @Param("start") LocalDateTime start,
                                            @Param("end") LocalDateTime end);

    @Query("""
            select count(p) from Payout p
            where p.status = io.skima.byteapp.domain.PayoutStatus.COMPLETED
              and p.triggerAt >= :since
            """)
    long countCompletedSince(@Param("since") LocalDateTime since);

    @Query(value = """
            select count(*) from payouts
            where status = 'COMPLETED'
              and trigger_at >= :since
              and TIMESTAMPDIFF(MINUTE, trigger_at, completed_at) <= :slaMinutes
            """, nativeQuery = true)
    long countCompletedWithinSlaSince(@Param("since") LocalDateTime since, @Param("slaMinutes") int slaMinutes);
}
