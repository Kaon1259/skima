package io.skima.byteapp.repository;

import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RatingRepository extends JpaRepository<Rating, Long> {

    Optional<Rating> findByMatchIdAndDirection(Long matchId, RatingDirection direction);

    boolean existsByMatchIdAndDirection(Long matchId, RatingDirection direction);

    @Query("select r from Rating r where r.direction = :direction and r.createdAt >= :since")
    List<Rating> findByDirectionSince(@Param("direction") RatingDirection direction,
                                      @Param("since") LocalDateTime since);

    @Query("select r from Rating r where r.worker.id = :workerId and r.direction = :direction order by r.createdAt desc")
    List<Rating> findAllByWorkerIdAndDirection(@Param("workerId") Long workerId,
                                               @Param("direction") RatingDirection direction);

    @Query("select r from Rating r where r.owner.id = :ownerId and r.direction = :direction order by r.createdAt desc")
    List<Rating> findAllByOwnerIdAndDirection(@Param("ownerId") Long ownerId,
                                              @Param("direction") RatingDirection direction);

    @Query("""
            select r from Rating r
            where r.match.shift.cafe.id = :cafeId
              and r.direction = :direction
            order by r.createdAt desc
            """)
    List<Rating> findAllByCafeIdAndDirection(@Param("cafeId") Long cafeId,
                                             @Param("direction") RatingDirection direction);
}
