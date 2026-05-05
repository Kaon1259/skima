package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.repository.ShiftMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class CheckInOutService {

    /** GPS 체크인 게이트 — 매장 반경 (m) */
    private static final double GEOFENCE_METERS = 100.0;

    private final ShiftMatchRepository matchRepository;
    private final PayoutService payoutService;

    @Transactional
    public ShiftMatch checkIn(User worker, Long matchId) {
        return checkIn(worker, matchId, null, null);
    }

    /**
     * GPS 좌표 함께 받는 체크인 — 매장 반경 100m 안에서만 허용.
     * 매장에 좌표가 없으면 게이트 스킵 (점주가 좌표 미입력한 매장은 검증 안 함).
     * 워커가 좌표를 안 보내면 게이트 스킵 (구버전 클라이언트 호환).
     */
    @Transactional
    public ShiftMatch checkIn(User worker, Long matchId, Double workerLat, Double workerLon) {
        ShiftMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));
        if (!match.getWorker().getId().equals(worker.getId())) {
            throw BusinessException.forbidden("본인 매칭이 아닙니다");
        }
        if (match.getStatus() != MatchStatus.MATCHED) {
            throw BusinessException.conflict("이미 체크인되었거나 종료된 매칭입니다");
        }
        // 근로계약서 확인 게이트 — 워커가 ack 안 했으면 체크인 거부
        if (match.getWorkerAcknowledgedContractAt() == null) {
            throw BusinessException.badRequest("근로계약서를 먼저 확인해주세요. 매칭 카드의 '📄 근로계약서 확인' 배너를 탭해 동의하면 체크인 가능합니다.");
        }

        var cafe = match.getShift().getCafe();
        Double cafeLat = cafe.getLatitude();
        Double cafeLon = cafe.getLongitude();
        if (workerLat != null && workerLon != null && cafeLat != null && cafeLon != null) {
            double dist = haversineMeters(workerLat, workerLon, cafeLat, cafeLon);
            if (dist > GEOFENCE_METERS) {
                throw BusinessException.badRequest(String.format(
                        "매장에서 %.0fm 떨어져 있어 체크인할 수 없습니다 (반경 %.0fm 안에서만 가능)",
                        dist, GEOFENCE_METERS));
            }
        }

        match.checkIn(LocalDateTime.now());
        match.getShift().markInProgress();
        return match;
    }

    /** Haversine 공식 — 두 좌표 사이 거리(미터) */
    private static double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6_371_000.0; // 지구 반지름 m
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                   * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private static final long MIN_WORK_MINUTES = 30;

    @Transactional
    public ShiftMatch checkOut(User worker, Long matchId) {
        ShiftMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));
        if (!match.getWorker().getId().equals(worker.getId())) {
            throw BusinessException.forbidden("본인 매칭이 아닙니다");
        }
        if (match.getStatus() != MatchStatus.CHECKED_IN) {
            throw BusinessException.conflict("체크인 상태가 아닙니다");
        }
        // 최소 근무 시간 검증 — 체크인 후 30분 미만 체크아웃은 거부 (gross=0 방지 + 악용 방지)
        if (match.getCheckInAt() != null) {
            long worked = java.time.Duration.between(match.getCheckInAt(), LocalDateTime.now()).toMinutes();
            if (worked < MIN_WORK_MINUTES) {
                throw BusinessException.badRequest(
                        "근무 시작 후 " + MIN_WORK_MINUTES + "분이 지나야 퇴근 체크아웃 가능합니다 (현재 " + worked + "분)");
            }
        }
        match.checkOut(LocalDateTime.now());
        match.getShift().markCompleted();

        // 정산 트리거 — Payout(SCHEDULED) 생성
        payoutService.schedulePayout(match);
        return match;
    }
}
