package io.skima.byteapp.service;

import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.dto.WorkerPoolEntry;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkerPoolService {

    private final ShiftMatchRepository matchRepository;
    private final RatingRepository ratingRepository;

    /**
     * 점주 전체 매장에 매칭된 모든 워커를 그룹핑해 워커별 집계 반환.
     * 정렬/검색은 클라이언트에서 처리 (메모리 부담 가벼움).
     */
    @Transactional(readOnly = true)
    public List<WorkerPoolEntry> findPoolForOwner(User owner) {
        // 점주의 매장 = matchRepository에서 cafe.owner = owner 인 모든 매칭
        // 일단 owner_id 인덱스 부재로 점주 매장 매칭 조회를 효율적으로 하려면
        // ShiftMatchRepository에 메서드 추가 필요.
        List<ShiftMatch> matches = matchRepository.findAllByOwnerId(owner.getId());

        // workerId → 누적
        Map<Long, Aggregate> byWorker = new HashMap<>();
        for (ShiftMatch m : matches) {
            Long wid = m.getWorker().getId();
            Aggregate agg = byWorker.computeIfAbsent(wid, k -> new Aggregate(m.getWorker()));
            agg.totalMatches++;
            if (m.getStatus() == MatchStatus.CHECKED_OUT) agg.completedMatches++;
            if (m.getStatus() == MatchStatus.NO_SHOW) agg.noShowCount++;
            if (agg.lastMatchAt == null || (m.getMatchedAt() != null && m.getMatchedAt().isAfter(agg.lastMatchAt))) {
                agg.lastMatchAt = m.getMatchedAt();
                agg.lastCafeName = m.getShift().getCafe().getName();
                agg.lastCafeId = m.getShift().getCafe().getId();
            }
        }

        // 점주 → 워커 평가 (OWNER_TO_WORKER) 누적
        List<Rating> ratings = ratingRepository.findAllByOwnerIdAndDirection(
                owner.getId(), RatingDirection.OWNER_TO_WORKER);
        for (Rating r : ratings) {
            Long wid = r.getWorker().getId();
            Aggregate agg = byWorker.get(wid);
            if (agg == null) continue;  // 평가는 있는데 매칭이 없는 케이스(이론적으로 없음) skip
            agg.ratingSum += r.getScore();
            agg.ratingsCount++;
            if (r.isWillRehire()) agg.rehireCount++;
        }

        List<WorkerPoolEntry> result = new ArrayList<>();
        for (Aggregate a : byWorker.values()) {
            Double avg = a.ratingsCount > 0 ? (double) a.ratingSum / a.ratingsCount : null;
            Double rehire = a.ratingsCount > 0 ? (double) a.rehireCount / a.ratingsCount : null;
            result.add(new WorkerPoolEntry(
                    a.worker.getId(),
                    a.worker.getName(),
                    a.worker.getProfileImage(),
                    a.totalMatches,
                    a.completedMatches,
                    a.noShowCount,
                    avg,
                    a.ratingsCount > 0 ? a.ratingsCount : null,
                    rehire,
                    a.lastMatchAt,
                    a.lastCafeName,
                    a.lastCafeId
            ));
        }
        // 기본 정렬: 최근 매칭 순
        result.sort(Comparator.comparing(
                (WorkerPoolEntry e) -> e.lastMatchAt() == null ? LocalDateTime.MIN : e.lastMatchAt()
        ).reversed());
        return result;
    }

    private static class Aggregate {
        final User worker;
        int totalMatches;
        int completedMatches;
        int noShowCount;
        int ratingSum;
        int ratingsCount;
        int rehireCount;
        LocalDateTime lastMatchAt;
        String lastCafeName;
        Long lastCafeId;

        Aggregate(User worker) { this.worker = worker; }
    }
}
