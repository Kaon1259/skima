package io.skima.byteapp.service;

import io.skima.byteapp.config.SkimaProperties;
import io.skima.byteapp.domain.Payout;
import io.skima.byteapp.domain.PayoutStatus;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.repository.PayoutRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PayoutService {

    private final PayoutRepository payoutRepository;
    private final SkimaProperties props;

    /** 체크아웃 시 호출 — Payout(SCHEDULED) 생성, triggerAt = 체크아웃 시각 */
    @Transactional
    public Payout schedulePayout(ShiftMatch match) {
        if (match.getCheckInAt() == null || match.getCheckOutAt() == null) {
            throw new IllegalStateException("체크인/체크아웃 정보가 없습니다");
        }
        long workedMinutes = Duration.between(match.getCheckInAt(), match.getCheckOutAt()).toMinutes();
        if (workedMinutes <= 0) workedMinutes = 0;
        int hourlyWage = match.getShift().getHourlyWage();
        int gross = (int) Math.round(hourlyWage * (workedMinutes / 60.0));

        int withholding = computeWithholdingTax(gross);
        int net = gross - withholding;
        int platformFee = (int) Math.round(gross * props.getPayout().getPlatformFeeRate());

        Payout payout = Payout.builder()
                .match(match)
                .worker(match.getWorker())
                .grossAmount(gross)
                .withholdingTax(withholding)
                .platformFee(platformFee)
                .netAmount(net)
                .triggerAt(match.getCheckOutAt())
                .build();
        Payout saved = payoutRepository.save(payout);
        log.info("[PAYOUT_REQUESTED] payoutId={}, workerId={}, gross={}, net={}, fee={} — 점주 승인 또는 {}분 자동승인 대기",
                saved.getId(), match.getWorker().getId(), gross, net, platformFee,
                props.getPayout().getAutoApproveMinutes());
        return saved;
    }

    /** 일용근로 원천징수 계산 — 일급 15만원 미만 비과세, 이상 시 6.6% */
    public int computeWithholdingTax(int gross) {
        if (gross < props.getPayout().getDailyTaxThreshold()) {
            return 0;
        }
        return (int) Math.round(gross * props.getPayout().getDailyTaxRate());
    }

    /** 스케줄러가 호출 — SCHEDULED 상태 모두 mock 송금 처리 */
    @Transactional
    public int executePendingPayouts() {
        List<Payout> pending = payoutRepository.findAllByStatus(PayoutStatus.SCHEDULED);
        int processed = 0;
        for (Payout p : pending) {
            // mock 송금: 외부 API 호출 대신 즉시 완료 처리
            LocalDateTime now = LocalDateTime.now();
            p.complete(now);
            long elapsedFromApproval = p.getApprovedAt() == null
                    ? 0
                    : Duration.between(p.getApprovedAt(), now).toMinutes();
            log.info("[PAYOUT_COMPLETED] payoutId={}, workerId={}, net={}, elapsedFromApproval={}분, slaTarget={}분",
                    p.getId(), p.getWorker().getId(), p.getNetAmount(), elapsedFromApproval,
                    props.getPayout().getSlaMinutes());
            processed++;
        }
        return processed;
    }

    /** 점주 무응답 자동 승인 — REQUESTED + triggerAt+autoApproveMinutes 경과 → SCHEDULED */
    @Transactional
    public int autoApproveStale() {
        int autoMin = props.getPayout().getAutoApproveMinutes();
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(autoMin);
        List<Payout> stale = payoutRepository.findStaleByStatus(PayoutStatus.REQUESTED, cutoff);
        for (Payout p : stale) {
            p.approve(LocalDateTime.now(), true);
            log.info("[PAYOUT_AUTO_APPROVED] payoutId={}, workerId={} — 점주 {}분 무응답으로 자동 승인",
                    p.getId(), p.getWorker().getId(), autoMin);
        }
        return stale.size();
    }

    /** 점주 명시 승인 — REQUESTED → SCHEDULED 전이. matchId 기준 1건. */
    @Transactional
    public Payout approveByOwner(io.skima.byteapp.domain.User owner, Long matchId) {
        Payout p = payoutRepository.findByMatchId(matchId)
                .orElseThrow(() -> io.skima.byteapp.common.BusinessException.notFound("정산 내역을 찾을 수 없습니다"));
        if (!p.getMatch().getShift().getCafe().getOwner().getId().equals(owner.getId())) {
            throw io.skima.byteapp.common.BusinessException.forbidden("본인 매장의 정산이 아닙니다");
        }
        if (p.getStatus() != PayoutStatus.REQUESTED) {
            throw io.skima.byteapp.common.BusinessException.conflict("이미 승인된 정산입니다");
        }
        p.approve(LocalDateTime.now(), false);
        log.info("[PAYOUT_OWNER_APPROVED] payoutId={}, ownerId={}", p.getId(), owner.getId());
        return p;
    }

    @Transactional(readOnly = true)
    public List<Payout> findByWorker(User worker) {
        return payoutRepository.findAllByWorkerId(worker.getId());
    }
}
