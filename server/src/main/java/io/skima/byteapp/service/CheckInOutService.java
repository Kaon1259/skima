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

    private final ShiftMatchRepository matchRepository;
    private final PayoutService payoutService;

    @Transactional
    public ShiftMatch checkIn(User worker, Long matchId) {
        ShiftMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));
        if (!match.getWorker().getId().equals(worker.getId())) {
            throw BusinessException.forbidden("본인 매칭이 아닙니다");
        }
        if (match.getStatus() != MatchStatus.MATCHED) {
            throw BusinessException.conflict("이미 체크인되었거나 종료된 매칭입니다");
        }
        match.checkIn(LocalDateTime.now());
        match.getShift().markInProgress();
        return match;
    }

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
        match.checkOut(LocalDateTime.now());
        match.getShift().markCompleted();

        // 정산 트리거 — Payout(SCHEDULED) 생성
        payoutService.schedulePayout(match);
        return match;
    }
}
