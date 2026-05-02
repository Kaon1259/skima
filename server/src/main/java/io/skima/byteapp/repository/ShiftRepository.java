package io.skima.byteapp.repository;

import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    List<Shift> findAllByStatusOrderByStartAtAsc(ShiftStatus status);

    @Query("select s from Shift s where s.cafe.owner.id = :ownerId order by s.createdAt desc")
    List<Shift> findAllByOwnerId(@Param("ownerId") Long ownerId);

    @Query("""
            select count(s) from Shift s
            where s.matchedAt is not null
              and s.createdAt >= :since
            """)
    long countMatchedShiftsSince(@Param("since") LocalDateTime since);

    @Query(value = """
            select count(*) from shifts
            where matched_at is not null
              and created_at >= :since
              and TIMESTAMPDIFF(MINUTE, created_at, matched_at) <= :slaMinutes
            """, nativeQuery = true)
    long countMatchedWithinSlaSince(@Param("since") LocalDateTime since, @Param("slaMinutes") int slaMinutes);
}
