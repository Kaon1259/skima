package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.Dispute;
import io.skima.byteapp.domain.DisputeReason;
import io.skima.byteapp.domain.DisputeStatus;
import io.skima.byteapp.domain.DisputeVerdict;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.dto.DisputeRequest;
import io.skima.byteapp.repository.DisputeRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class DisputeService {

    private static final long REPORT_WINDOW_HOURS = 24;

    private final DisputeRepository disputeRepository;
    private final ShiftMatchRepository matchRepository;

    @Transactional
    public Dispute create(User reporter, DisputeRequest req) {
        ShiftMatch match = matchRepository.findById(req.matchId())
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));

        // 권한 — 워커 본인 매칭이거나 점주 본인 매장
        boolean isWorker = match.getWorker().getId().equals(reporter.getId());
        boolean isOwner = match.getShift().getCafe().getOwner().getId().equals(reporter.getId());
        if (!isWorker && !isOwner) {
            throw BusinessException.forbidden("본인이 관련된 매칭만 신고 가능");
        }

        // 매칭 종료 후 24시간 이내만 가능
        LocalDateTime endRef = match.getCheckOutAt() != null ? match.getCheckOutAt()
                : (match.getStatus() == MatchStatus.NO_SHOW ? match.getMatchedAt() : match.getShift().getEndAt());
        if (endRef != null) {
            long hours = Duration.between(endRef, LocalDateTime.now()).toHours();
            if (hours > REPORT_WINDOW_HOURS) {
                throw BusinessException.badRequest("신고 가능 기간(24시간)이 지났습니다");
            }
        }

        // 같은 사람이 같은 매칭 중복 신고 방지
        var existing = disputeRepository.findFirstByMatchIdAndReporterId(req.matchId(), reporter.getId());
        if (existing.isPresent()) {
            throw BusinessException.badRequest("이미 신고한 매칭입니다");
        }

        Dispute d = Dispute.builder()
                .match(match)
                .reporter(reporter)
                .reporterRole(reporter.getRole())
                .reason(req.reason())
                .comment(req.comment())
                .build();
        return disputeRepository.save(d);
    }

    @Transactional(readOnly = true)
    public java.util.List<Dispute> myReportedDisputes(User user) {
        if (user.getRole() == UserRole.OWNER) return disputeRepository.findAllByOwnerId(user.getId());
        return disputeRepository.findAllByReporterId(user.getId());
    }

    /** 자동 판정 — GPS·체크인·평점 등 시그널 기반 룰 (간단 휴리스틱) */
    @Transactional
    public Dispute autoResolve(Long disputeId) {
        Dispute d = disputeRepository.findById(disputeId)
                .orElseThrow(() -> BusinessException.notFound("분쟁을 찾을 수 없습니다"));
        if (d.getStatus() != DisputeStatus.PENDING) return d;

        var match = d.getMatch();
        DisputeVerdict verdict;
        String note;

        switch (d.getReason()) {
            case NO_SHOW_DISPUTE -> {
                // 워커가 노쇼 처리에 이의 — 체크인 기록 있으면 워커 손, 없으면 점주 손
                if (match.getCheckInAt() != null) {
                    verdict = DisputeVerdict.REPORTER_WINS;
                    note = "체크인 기록 발견 — 노쇼 평가 무효";
                } else {
                    verdict = DisputeVerdict.RESPONDENT_WINS;
                    note = "체크인 기록 없음 — 노쇼 평가 유지";
                }
            }
            case LATE_CHECKIN -> {
                if (match.getCheckInAt() != null
                        && match.getCheckInAt().isAfter(match.getShift().getStartAt().plusMinutes(10))) {
                    verdict = DisputeVerdict.REPORTER_WINS;
                    note = "체크인 시각이 시작 +10분 이후 — 지각 인정";
                } else {
                    verdict = DisputeVerdict.RESPONDENT_WINS;
                    note = "지각 근거 부족";
                }
            }
            case EARLY_CHECKOUT -> {
                if (match.getCheckOutAt() != null
                        && match.getCheckOutAt().isBefore(match.getShift().getEndAt().minusMinutes(10))) {
                    verdict = DisputeVerdict.REPORTER_WINS;
                    note = "체크아웃 시각이 종료 -10분 이전 — 조기 퇴근 인정";
                } else {
                    verdict = DisputeVerdict.RESPONDENT_WINS;
                    note = "조기 퇴근 근거 부족";
                }
            }
            default -> {
                // 자동 판정 어려운 사유 — 중립으로 마감 (운영자 검토 필요시 별도 절차)
                verdict = DisputeVerdict.NEUTRAL;
                note = "자동 판정 보류 — 양측 진술 검토 필요";
            }
        }
        d.resolve(verdict, note);
        log.info("Dispute#{} auto-resolved: {} ({})", d.getId(), verdict, note);
        return d;
    }
}
