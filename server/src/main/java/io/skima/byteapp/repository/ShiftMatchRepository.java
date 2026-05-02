package io.skima.byteapp.repository;

import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.ShiftMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ShiftMatchRepository extends JpaRepository<ShiftMatch, Long> {

    /** @deprecated 노쇼 백업으로 같은 shift 에 다수 match 가능. findActiveByShiftId 사용 권장 */
    @Deprecated
    Optional<ShiftMatch> findByShiftId(Long shiftId);

    /** NO_SHOW / CANCELED 제외, 가장 최근 매칭 1건 */
    @Query("""
            select m from ShiftMatch m
            where m.shift.id = :shiftId
              and m.status not in (io.skima.byteapp.domain.MatchStatus.NO_SHOW,
                                   io.skima.byteapp.domain.MatchStatus.CANCELED)
            order by m.matchedAt desc
            """)
    List<ShiftMatch> findActiveByShiftIdRaw(@Param("shiftId") Long shiftId);

    default Optional<ShiftMatch> findActiveByShiftId(Long shiftId) {
        return findActiveByShiftIdRaw(shiftId).stream().findFirst();
    }

    /** 시작 시각이 이미 지났고 체크인 안 한 MATCHED 매칭 — 노쇼 후보 */
    @Query("""
            select m from ShiftMatch m
            where m.status = io.skima.byteapp.domain.MatchStatus.MATCHED
              and m.checkInAt is null
              and m.shift.startAt <= :cutoff
            """)
    List<ShiftMatch> findNoShowCandidates(@Param("cutoff") LocalDateTime cutoff);

    List<ShiftMatch> findAllByStatus(MatchStatus status);

    @Query("""
            select m from ShiftMatch m
            where m.worker.id = :workerId
            order by m.matchedAt desc
            """)
    List<ShiftMatch> findAllByWorkerId(@Param("workerId") Long workerId);

    long countByMatchedAtAfter(LocalDateTime since);

    long countByStatusAndMatchedAtAfter(MatchStatus status, LocalDateTime since);

    @Query("""
            select m from ShiftMatch m
            where m.shift.cafe.owner.id = :ownerId
              and m.status = io.skima.byteapp.domain.MatchStatus.NO_SHOW
              and m.matchedAt >= :since
            order by m.matchedAt desc
            """)
    List<ShiftMatch> findNoShowByOwnerSince(@Param("ownerId") Long ownerId,
                                            @Param("since") LocalDateTime since);

    @Query("""
            select m from ShiftMatch m
            where m.shift.cafe.id = :cafeId
            order by m.matchedAt desc
            """)
    List<ShiftMatch> findAllByCafeId(@Param("cafeId") Long cafeId);

    @Query("""
            select m from ShiftMatch m
            where m.shift.cafe.owner.id = :ownerId
            order by m.matchedAt desc
            """)
    List<ShiftMatch> findAllByOwnerId(@Param("ownerId") Long ownerId);
}
