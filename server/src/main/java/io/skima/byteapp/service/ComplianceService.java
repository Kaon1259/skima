package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.config.SkimaProperties;
import io.skima.byteapp.domain.Payout;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.dto.ContractResponse;
import io.skima.byteapp.dto.MonthlyStatementResponse;
import io.skima.byteapp.dto.MonthlyStatementResponse.MonthlyStatementRow;
import io.skima.byteapp.dto.WithholdingReceiptResponse;
import io.skima.byteapp.repository.PayoutRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ComplianceService {

    private final ShiftMatchRepository matchRepository;
    private final PayoutRepository payoutRepository;
    private final SkimaProperties props;

    @Transactional(readOnly = true)
    public ContractResponse buildContractForWorker(User worker, Long matchId) {
        ShiftMatch match = mustBeWorkerOf(worker, matchId);
        return buildContractFromMatch(match);
    }

    @Transactional(readOnly = true)
    public WithholdingReceiptResponse buildWithholdingForWorker(User worker, Long matchId) {
        ShiftMatch match = mustBeWorkerOf(worker, matchId);
        return buildWithholdingFromMatch(match);
    }

    @Transactional(readOnly = true)
    public ContractResponse buildContract(User owner, Long matchId) {
        ShiftMatch match = mustOwn(owner, matchId);
        return buildContractFromMatch(match);
    }

    private ContractResponse buildContractFromMatch(ShiftMatch match) {
        Shift shift = match.getShift();
        User worker = match.getWorker();
        User employer = shift.getCafe().getOwner();

        Long workMinutes = (match.getCheckInAt() != null && match.getCheckOutAt() != null)
                ? Duration.between(match.getCheckInAt(), match.getCheckOutAt()).toMinutes()
                : Duration.between(shift.getStartAt(), shift.getEndAt()).toMinutes();
        int gross = (int) Math.round(shift.getHourlyWage() * (workMinutes / 60.0));
        int withholding = computeWithholding(gross);

        return new ContractResponse(
                match.getId(),
                employer.getName(),
                employer.getPhone(),
                shift.getCafe().getName(),
                shift.getCafe().getAddress(),
                worker.getName(),
                worker.getPhone(),
                worker.getBankAccount(),
                shift.getStartAt(),
                shift.getEndAt(),
                shift.getCafe().getAddress(),
                shift.getDescription() == null ? "카페 매장 운영 보조" : shift.getDescription(),
                shift.getHourlyWage(),
                workMinutes,
                gross,
                withholding,
                gross - withholding,
                "일용근로자 (근로기준법 제18조 단시간근로자 / 1일 단위 근로계약)",
                taxClause(),
                LocalDateTime.now()
        );
    }

    @Transactional(readOnly = true)
    public WithholdingReceiptResponse buildWithholding(User owner, Long matchId) {
        ShiftMatch match = mustOwn(owner, matchId);
        return buildWithholdingFromMatch(match);
    }

    private WithholdingReceiptResponse buildWithholdingFromMatch(ShiftMatch match) {
        Shift shift = match.getShift();
        User worker = match.getWorker();
        User employer = shift.getCafe().getOwner();

        Payout payout = payoutRepository.findByMatchId(match.getId()).orElse(null);

        int gross = payout != null ? payout.getGrossAmount() : 0;
        int withholding = payout != null ? payout.getWithholdingTax() : 0;
        int taxable = Math.max(0, gross - props.getPayout().getDailyTaxThreshold());
        // 지방소득세 = 원천징수의 10%
        int localTax = Math.round(withholding * 0.1f);
        int net = gross - withholding - localTax;

        return new WithholdingReceiptResponse(
                match.getId(),
                employer.getName(),
                shift.getCafe().getName(),
                worker.getName(),
                worker.getPhone(),
                match.getCheckOutAt() == null ? shift.getEndAt() : match.getCheckOutAt(),
                gross,
                taxable,
                withholding,
                localTax,
                net,
                taxClause(),
                LocalDateTime.now()
        );
    }

    @Transactional(readOnly = true)
    public MonthlyStatementResponse buildMonthlyStatement(User owner, String month) {
        YearMonth ym;
        try {
            ym = YearMonth.parse(month);
        } catch (Exception e) {
            throw BusinessException.badRequest("month는 YYYY-MM 형식이어야 합니다");
        }
        LocalDateTime start = ym.atDay(1).atStartOfDay();
        LocalDateTime end = ym.plusMonths(1).atDay(1).atStartOfDay();

        DateTimeFormatter df = DateTimeFormatter.ofPattern("MM/dd HH:mm");

        List<Payout> payouts = payoutRepository.findCompletedByOwnerInRange(owner.getId(), start, end);

        long sumGross = 0, sumWithholding = 0, sumNet = 0, sumFee = 0;
        List<MonthlyStatementRow> rows = new ArrayList<>();
        for (Payout p : payouts) {
            sumGross += p.getGrossAmount();
            sumWithholding += p.getWithholdingTax();
            sumNet += p.getNetAmount();
            sumFee += p.getPlatformFee();
            var pShift = p.getMatch().getShift();
            rows.add(new MonthlyStatementRow(
                    p.getMatch().getId(),
                    pShift.getId(),
                    pShift.getCafe().getId(),
                    p.getWorker().getId(),
                    p.getWorker().getName(),
                    pShift.getCafe().getName(),
                    p.getCompletedAt().format(df),
                    p.getGrossAmount(),
                    p.getWithholdingTax(),
                    p.getNetAmount()
            ));
        }

        return new MonthlyStatementResponse(
                month,
                owner.getName(),
                rows.size(),
                sumGross,
                sumWithholding,
                sumNet,
                sumFee,
                rows
        );
    }

    private ShiftMatch mustOwn(User owner, Long matchId) {
        ShiftMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));
        if (!match.getShift().getCafe().getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 매장의 매칭이 아닙니다");
        }
        return match;
    }

    private ShiftMatch mustBeWorkerOf(User worker, Long matchId) {
        ShiftMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));
        if (!match.getWorker().getId().equals(worker.getId())) {
            throw BusinessException.forbidden("본인 매칭이 아닙니다");
        }
        return match;
    }

    private int computeWithholding(int gross) {
        if (gross < props.getPayout().getDailyTaxThreshold()) return 0;
        return (int) Math.round(gross * props.getPayout().getDailyTaxRate());
    }

    private String taxClause() {
        return "소득세법 제14조·제20조 일용근로자 분리과세 적용. 일급 "
                + props.getPayout().getDailyTaxThreshold() + "원 미만 비과세, 이상 "
                + (props.getPayout().getDailyTaxRate() * 100) + "% 원천징수.";
    }
}
