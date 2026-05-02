package io.skima.byteapp.controller;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.config.SkimaProperties;
import io.skima.byteapp.domain.ApplicationStatus;
import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.dto.ApplicationResponse;
import io.skima.byteapp.dto.CafeCreateRequest;
import io.skima.byteapp.dto.CafeResponse;
import io.skima.byteapp.dto.MatchResponse;
import io.skima.byteapp.dto.OwnerDashboardResponse;
import io.skima.byteapp.dto.OwnerShiftView;
import io.skima.byteapp.dto.ShiftCreateRequest;
import io.skima.byteapp.dto.ShiftResponse;
import io.skima.byteapp.dto.BulkShiftCreateRequest;
import io.skima.byteapp.dto.CafeStatsResponse;
import io.skima.byteapp.dto.ContractResponse;
import io.skima.byteapp.dto.MonthlyStatementResponse;
import io.skima.byteapp.dto.NotificationItem;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.dto.RatingCreateRequest;
import io.skima.byteapp.dto.RatingResponse;
import io.skima.byteapp.dto.WithholdingReceiptResponse;
import io.skima.byteapp.dto.WorkerStatsResponse;
import io.skima.byteapp.repository.CafeRepository;
import io.skima.byteapp.repository.PayoutRepository;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftApplicationRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.ShiftRepository;
import io.skima.byteapp.security.AuthUser;
import io.skima.byteapp.service.ApplicationService;
import io.skima.byteapp.service.BrandCatalog;
import io.skima.byteapp.service.CafeStatsService;
import io.skima.byteapp.service.ComplianceService;
import io.skima.byteapp.service.NoShowService;
import io.skima.byteapp.service.NotificationService;
import io.skima.byteapp.service.PayoutService;
import io.skima.byteapp.service.RatingService;
import io.skima.byteapp.service.ShiftService;
import io.skima.byteapp.service.WorkerPoolService;
import io.skima.byteapp.service.WorkerStatsService;
import io.skima.byteapp.dto.WorkerPoolEntry;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/owner")
@RequiredArgsConstructor
public class OwnerController {

    private final ShiftService shiftService;
    private final ApplicationService applicationService;
    private final CafeRepository cafeRepository;
    private final ShiftRepository shiftRepository;
    private final ShiftApplicationRepository applicationRepository;
    private final ShiftMatchRepository matchRepository;
    private final RatingRepository ratingRepository;
    private final PayoutRepository payoutRepository;
    private final RatingService ratingService;
    private final SkimaProperties props;
    private final BrandCatalog brandCatalog;
    private final ComplianceService complianceService;
    private final WorkerStatsService workerStatsService;
    private final CafeStatsService cafeStatsService;
    private final NotificationService notificationService;
    private final PayoutService payoutService;
    private final NoShowService noShowService;
    private final WorkerPoolService workerPoolService;
    private final io.skima.byteapp.repository.ChatMessageRepository chatRepository;
    private final io.skima.byteapp.service.FavoriteService favoriteService;

    /* ========= 매장 ========= */

    @GetMapping("/cafes")
    public List<CafeResponse> myCafes(@AuthenticationPrincipal AuthUser principal) {
        return cafeRepository.findAllByOwner(principal.getDomainUser()).stream()
                .map(c -> CafeResponse.from(c, brandCatalog.findByKey(c.getBrandKey()).orElse(null)))
                .toList();
    }

    @PostMapping("/cafes")
    public CafeResponse createCafe(@AuthenticationPrincipal AuthUser principal,
                                   @Valid @RequestBody CafeCreateRequest req) {
        if (principal.getDomainUser().getRole() != UserRole.OWNER) {
            throw BusinessException.forbidden("점주만 매장을 등록할 수 있습니다");
        }
        validateBrand(req);
        Cafe saved = cafeRepository.save(Cafe.builder()
                .owner(principal.getDomainUser())
                .name(req.name())
                .address(req.address())
                .cafeType(req.cafeType())
                .brandKey(req.brandKey())
                .latitude(req.latitude())
                .longitude(req.longitude())
                .build());
        return CafeResponse.from(saved, brandCatalog.findByKey(saved.getBrandKey()).orElse(null));
    }

    @PutMapping("/cafes/{cafeId}")
    @Transactional
    public CafeResponse updateCafe(@AuthenticationPrincipal AuthUser principal,
                                   @PathVariable Long cafeId,
                                   @Valid @RequestBody CafeCreateRequest req) {
        Cafe cafe = mustOwnCafe(principal, cafeId);
        validateBrand(req);
        cafe.update(req.name(), req.address(), req.cafeType(), req.brandKey());
        if (req.latitude() != null || req.longitude() != null) {
            cafe.updateLocation(req.latitude(), req.longitude());
        }
        return CafeResponse.from(cafe, brandCatalog.findByKey(cafe.getBrandKey()).orElse(null));
    }

    private void validateBrand(CafeCreateRequest req) {
        boolean isFranchise = req.cafeType() == io.skima.byteapp.domain.CafeType.FRANCHISE_CAFE
                || req.cafeType() == io.skima.byteapp.domain.CafeType.FRANCHISE_BAKERY;
        if (isFranchise) {
            if (req.brandKey() == null || req.brandKey().isBlank()) {
                throw BusinessException.badRequest("프렌차이즈는 브랜드를 선택해야 합니다");
            }
            var brand = brandCatalog.findByKey(req.brandKey())
                    .orElseThrow(() -> BusinessException.badRequest("알 수 없는 브랜드입니다: " + req.brandKey()));
            if (brand.type() != req.cafeType()) {
                throw BusinessException.badRequest("선택한 브랜드 종류가 매장 종류와 일치하지 않습니다");
            }
        }
    }

    @DeleteMapping("/cafes/{cafeId}")
    @Transactional
    public ResponseEntity<Void> deleteCafe(@AuthenticationPrincipal AuthUser principal,
                                            @PathVariable Long cafeId) {
        Cafe cafe = mustOwnCafe(principal, cafeId);
        long shiftCount = shiftRepository.findAllByOwnerId(principal.getDomainUser().getId()).stream()
                .filter(s -> s.getCafe().getId().equals(cafeId))
                .count();
        if (shiftCount > 0) {
            throw BusinessException.conflict("이 매장에 등록된 시프트(" + shiftCount + "건)가 있어 삭제할 수 없습니다");
        }
        cafeRepository.delete(cafe);
        return ResponseEntity.noContent().build();
    }

    /* ========= 시프트 ========= */

    @PostMapping("/shifts")
    public ResponseEntity<ShiftResponse> createShift(@AuthenticationPrincipal AuthUser principal,
                                                     @Valid @RequestBody ShiftCreateRequest req) {
        var saved = shiftService.create(principal.getDomainUser(), req);
        return ResponseEntity.ok(ShiftResponse.from(saved));
    }

    /** 내 매장 시프트 목록 — 지원자 수 + 매칭 + 평가 enrich */
    @GetMapping("/shifts")
    @Transactional(readOnly = true)
    public List<OwnerShiftView> myShifts(@AuthenticationPrincipal AuthUser principal) {
        List<Shift> shifts = shiftService.findMyShifts(principal.getDomainUser());
        return shifts.stream()
                .map(s -> {
                    var apps = applicationRepository.findAllByShiftIdOrderByAppliedAtAsc(s.getId());
                    int total = apps.size();
                    int pending = (int) apps.stream()
                            .filter(a -> a.getStatus() == ApplicationStatus.PENDING)
                            .count();

                    Long matchId = null;
                    String matchedWorkerName = null;
                    String matchStatus = null;
                    Integer ratingScore = null;
                    Boolean willRehire = null;
                    Boolean workerRatedOwner = null;
                    String payoutStatus = null;
                    java.time.LocalDateTime payoutApprovedAt = null;
                    Boolean payoutAutoApproved = null;
                    java.time.LocalDateTime payoutCompletedAt = null;
                    long chatUnread = 0;

                    var matchOpt = matchRepository.findActiveByShiftId(s.getId());
                    if (matchOpt.isPresent()) {
                        var m = matchOpt.get();
                        matchId = m.getId();
                        matchedWorkerName = m.getWorker().getName();
                        matchStatus = m.getStatus().name();
                        var ratingOpt = ratingRepository.findByMatchIdAndDirection(
                                m.getId(), RatingDirection.OWNER_TO_WORKER);
                        if (ratingOpt.isPresent()) {
                            ratingScore = ratingOpt.get().getScore();
                            willRehire = ratingOpt.get().isWillRehire();
                        }
                        workerRatedOwner = ratingRepository.existsByMatchIdAndDirection(
                                m.getId(), RatingDirection.WORKER_TO_OWNER);
                        var payoutOpt = payoutRepository.findByMatchId(m.getId());
                        if (payoutOpt.isPresent()) {
                            var po = payoutOpt.get();
                            payoutStatus = po.getStatus().name();
                            payoutApprovedAt = po.getApprovedAt();
                            payoutAutoApproved = po.isAutoApproved();
                            payoutCompletedAt = po.getCompletedAt();
                        }
                        // 점주가 안 본 워커 메시지 수
                        var seen = m.getOwnerChatSeenAt();
                        chatUnread = seen == null
                                ? chatRepository.countByMatchIdAndSenderRole(m.getId(), UserRole.WORKER)
                                : chatRepository.countByMatchIdAndSenderRoleAndCreatedAtAfter(
                                        m.getId(), UserRole.WORKER, seen);
                    }

                    return OwnerShiftView.from(s, total, pending,
                            matchId, matchedWorkerName, matchStatus,
                            ratingScore, willRehire, workerRatedOwner,
                            payoutStatus, payoutApprovedAt, payoutAutoApproved, payoutCompletedAt,
                            chatUnread);
                })
                .toList();
    }

    @GetMapping("/shifts/{shiftId}/applications")
    public List<ApplicationResponse> applications(@PathVariable Long shiftId) {
        return applicationService.listByShift(shiftId).stream()
                .map(ApplicationResponse::from)
                .toList();
    }

    @PostMapping("/applications/{applicationId}/accept")
    public MatchResponse accept(@AuthenticationPrincipal AuthUser principal,
                                @PathVariable Long applicationId) {
        var match = applicationService.accept(principal.getDomainUser(), applicationId);
        return MatchResponse.from(match);
    }

    /** 시프트 취소 — 대기 지원 일괄 거절 + 매칭 있으면 취소 */
    @PostMapping("/shifts/{shiftId}/cancel")
    public ShiftResponse cancelShift(@AuthenticationPrincipal AuthUser principal,
                                     @PathVariable Long shiftId) {
        var shift = shiftService.cancel(principal.getDomainUser(), shiftId);
        return ShiftResponse.from(shift);
    }

    /* ========= 워커 평가 (PMF 시그널) ========= */

    @PostMapping("/matches/{matchId}/rating")
    public RatingResponse rate(@AuthenticationPrincipal AuthUser principal,
                               @PathVariable Long matchId,
                               @Valid @RequestBody RatingCreateRequest req) {
        var rating = ratingService.rateByOwner(principal.getDomainUser(), matchId, req);
        return RatingResponse.from(rating);
    }

    /**
     * 정산 승인 + 평가 통합 — Payout(REQUESTED → SCHEDULED) + Rating(OWNER_TO_WORKER) 한 트랜잭션.
     * 평가 없이는 호출 불가 (RatingCreateRequest 검증).
     * 30분 자동 승인 SLA 가 안전망. 점주가 명시 승인하면 즉시 SCHEDULED → 다음 tick 에 입금.
     */
    @PostMapping("/matches/{matchId}/approve-payout")
    @Transactional
    public Map<String, Object> approvePayout(@AuthenticationPrincipal AuthUser principal,
                                             @PathVariable Long matchId,
                                             @Valid @RequestBody RatingCreateRequest req) {
        var owner = principal.getDomainUser();
        var rating = ratingService.rateByOwner(owner, matchId, req);
        var payout = payoutService.approveByOwner(owner, matchId);
        return Map.of(
                "rating", RatingResponse.from(rating),
                "payoutStatus", payout.getStatus().name(),
                "approvedAt", payout.getApprovedAt());
    }

    /**
     * 노쇼 수동 등록 — 점주가 시프트 상세에서 직접 신고.
     * match.status MATCHED 일 때만 가능. NO_SHOW 전이 + 자동 ★1 평가 + 백업 매칭.
     */
    @PostMapping("/matches/{matchId}/no-show")
    public Map<String, Object> reportNoShow(@AuthenticationPrincipal AuthUser principal,
                                            @PathVariable Long matchId) {
        var outcome = noShowService.reportByOwner(principal.getDomainUser(), matchId);
        return Map.of(
                "matchId", matchId,
                "backupMatched", outcome.backupMatched(),
                "shiftReopened", outcome.shiftReopened());
    }

    /** 점주가 워커에게 준 평가 목록 */
    @GetMapping("/ratings")
    public List<RatingResponse> myGivenRatings(@AuthenticationPrincipal AuthUser principal) {
        return ratingService.findGivenByOwner(principal.getDomainUser()).stream()
                .map(RatingResponse::from)
                .toList();
    }

    /** 점주(=매장)가 워커들로부터 받은 평가 목록 */
    @GetMapping("/ratings/received")
    public List<RatingResponse> myReceivedRatings(@AuthenticationPrincipal AuthUser principal) {
        return ratingService.findReceivedByOwner(principal.getDomainUser()).stream()
                .map(RatingResponse::from)
                .toList();
    }

    /* ========= 일괄 등록 ========= */

    @PostMapping("/shifts/bulk")
    public List<ShiftResponse> createBulkShifts(@AuthenticationPrincipal AuthUser principal,
                                                @Valid @RequestBody BulkShiftCreateRequest req) {
        return shiftService.createBulk(principal.getDomainUser(), req).stream()
                .map(ShiftResponse::from)
                .toList();
    }

    /* ========= 워커 통계 미리보기 (지원자 평가에 활용) ========= */

    @GetMapping("/workers/{workerId}/stats")
    public WorkerStatsResponse workerStats(@PathVariable Long workerId) {
        return workerStatsService.computeForWorker(workerId);
    }

    /** 같은 매장(같은 점주)에서 해당 워커가 몇 번 근무했는지 */
    @GetMapping("/cafes/{cafeId}/workers/{workerId}/repeat-count")
    @Transactional(readOnly = true)
    public java.util.Map<String, Integer> repeatCount(@AuthenticationPrincipal AuthUser principal,
                                                       @PathVariable Long cafeId,
                                                       @PathVariable Long workerId) {
        Cafe cafe = cafeRepository.findById(cafeId)
                .orElseThrow(() -> BusinessException.notFound("매장을 찾을 수 없습니다"));
        if (!cafe.getOwner().getId().equals(principal.getDomainUser().getId())) {
            throw BusinessException.forbidden("본인 소유 매장이 아닙니다");
        }
        int n = (int) matchRepository.findAllByWorkerId(workerId).stream()
                .filter(m -> m.getShift().getCafe().getId().equals(cafeId))
                .count();
        return java.util.Map.of("cafeId", cafeId.intValue(), "workerId", workerId.intValue(), "count", n);
    }

    /* ========= 컴플라이언스 ========= */

    @GetMapping("/matches/{matchId}/contract")
    public ContractResponse contract(@AuthenticationPrincipal AuthUser principal,
                                     @PathVariable Long matchId) {
        return complianceService.buildContract(principal.getDomainUser(), matchId);
    }

    @GetMapping("/matches/{matchId}/withholding")
    public WithholdingReceiptResponse withholding(@AuthenticationPrincipal AuthUser principal,
                                                  @PathVariable Long matchId) {
        return complianceService.buildWithholding(principal.getDomainUser(), matchId);
    }

    @GetMapping("/statements")
    public MonthlyStatementResponse monthlyStatement(@AuthenticationPrincipal AuthUser principal,
                                                     @RequestParam String month) {
        return complianceService.buildMonthlyStatement(principal.getDomainUser(), month);
    }

    /* ========= 알림 인박스 ========= */

    @GetMapping("/notifications")
    public List<NotificationItem> notifications(@AuthenticationPrincipal AuthUser principal) {
        return notificationService.forOwner(principal.getDomainUser());
    }

    @PostMapping("/notifications/mark-seen")
    public ResponseEntity<Void> markNotificationsSeen(@AuthenticationPrincipal AuthUser principal) {
        notificationService.markAllSeen(principal.getDomainUser());
        return ResponseEntity.noContent().build();
    }

    /* ========= 워커 풀 (점주 CRM) ========= */

    @GetMapping("/worker-pool")
    public List<WorkerPoolEntry> workerPool(@AuthenticationPrincipal AuthUser principal) {
        return workerPoolService.findPoolForOwner(principal.getDomainUser());
    }

    /* ========= 대시보드 ========= */

    /** 매장별 이번달 매출/지출 + 별점/노쇼율 카드용 */
    @GetMapping("/dashboard/by-cafe")
    public List<CafeStatsResponse> byCafe(@AuthenticationPrincipal AuthUser principal) {
        return cafeStatsService.computeForOwner(principal.getDomainUser());
    }

    @GetMapping("/dashboard")
    @Transactional(readOnly = true)
    public OwnerDashboardResponse dashboard(@AuthenticationPrincipal AuthUser principal) {
        Long ownerId = principal.getDomainUser().getId();
        List<Shift> myShifts = shiftRepository.findAllByOwnerId(ownerId);

        Map<ShiftStatus, Integer> count = new HashMap<>();
        long matchedSum = 0;
        long matchedCount = 0;
        long matchedWithinSla = 0;
        for (Shift s : myShifts) {
            count.merge(s.getStatus(), 1, Integer::sum);
            if (s.getMatchedAt() != null) {
                long m = Duration.between(s.getCreatedAt(), s.getMatchedAt()).toMinutes();
                matchedSum += m;
                matchedCount++;
                if (m <= props.getMatching().getSlaMinutes()) matchedWithinSla++;
            }
        }
        int pendingApps = 0;
        for (Shift s : myShifts) {
            if (s.getStatus() == ShiftStatus.OPEN) {
                pendingApps += (int) applicationRepository
                        .findAllByShiftIdOrderByAppliedAtAsc(s.getId()).stream()
                        .filter(a -> a.getStatus() == ApplicationStatus.PENDING)
                        .count();
            }
        }

        Long avgMatch = matchedCount == 0 ? null : matchedSum / matchedCount;
        Double slaRate = matchedCount == 0 ? null : (double) matchedWithinSla / matchedCount;

        return new OwnerDashboardResponse(
                myShifts.size(),
                count.getOrDefault(ShiftStatus.OPEN, 0),
                count.getOrDefault(ShiftStatus.MATCHED, 0),
                count.getOrDefault(ShiftStatus.IN_PROGRESS, 0),
                count.getOrDefault(ShiftStatus.COMPLETED, 0),
                pendingApps,
                avgMatch,
                slaRate
        );
    }

    private Cafe mustOwnCafe(AuthUser principal, Long cafeId) {
        Cafe cafe = cafeRepository.findById(cafeId)
                .orElseThrow(() -> BusinessException.notFound("매장을 찾을 수 없습니다"));
        if (!cafe.getOwner().getId().equals(principal.getDomainUser().getId())) {
            throw BusinessException.forbidden("본인 소유 매장이 아닙니다");
        }
        return cafe;
    }

    /** 워커 N명이 이 매장을 단골로 등록했는지 — 시프트 등록 시 알림 발송 안내용 */
    @GetMapping("/cafes/{cafeId}/favoriting-count")
    public Map<String, Long> favoritingCount(@AuthenticationPrincipal AuthUser principal,
                                              @PathVariable Long cafeId) {
        mustOwnCafe(principal, cafeId);
        long count = favoriteService.workerIdsFavoriting(cafeId).size();
        Map<String, Long> result = new HashMap<>();
        result.put("count", count);
        return result;
    }

    /* ========= 단골 워커 (Phase 3 리텐션) ========= */

    @GetMapping("/favorites/workers")
    public List<Long> myFavoriteWorkerIds(@AuthenticationPrincipal AuthUser principal) {
        return favoriteService.ownerFavoriteWorkerIds(principal.getDomainUser());
    }

    @PostMapping("/favorites/workers/{workerId}")
    public ResponseEntity<Void> addFavoriteWorker(@AuthenticationPrincipal AuthUser principal,
                                                   @PathVariable Long workerId) {
        favoriteService.addOwnerFavorite(principal.getDomainUser(), workerId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/favorites/workers/{workerId}")
    public ResponseEntity<Void> removeFavoriteWorker(@AuthenticationPrincipal AuthUser principal,
                                                      @PathVariable Long workerId) {
        favoriteService.removeOwnerFavorite(principal.getDomainUser(), workerId);
        return ResponseEntity.noContent().build();
    }
}
