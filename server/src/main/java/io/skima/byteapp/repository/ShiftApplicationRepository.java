package io.skima.byteapp.repository;

import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.ShiftApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ShiftApplicationRepository extends JpaRepository<ShiftApplication, Long> {

    Optional<ShiftApplication> findByShiftIdAndWorkerId(Long shiftId, Long workerId);

    List<ShiftApplication> findAllByShiftIdOrderByAppliedAtAsc(Long shiftId);

    @Query("""
            select a from ShiftApplication a
            where a.worker.id = :workerId
            order by a.appliedAt desc
            """)
    List<ShiftApplication> findAllByWorkerId(@Param("workerId") Long workerId);

    @Query("""
            select a from ShiftApplication a
            where a.shift.id = :shiftId and a.status <> :exclude
            """)
    List<ShiftApplication> findActiveByShiftId(@Param("shiftId") Long shiftId,
                                               @Param("exclude") ApplicationStatus exclude);
}
