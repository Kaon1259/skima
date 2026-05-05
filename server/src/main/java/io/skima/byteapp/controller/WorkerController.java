package io.skima.byteapp.controller;

import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.dto.ApplicationResponse;
import io.skima.byteapp.dto.MatchResponse;
import io.skima.byteapp.dto.PayoutResponse;
import io.skima.byteapp.dto.RatingCreateRequest;
import io.skima.byteapp.dto.RatingResponse;
import io.skima.byteapp.dto.WorkerShiftView;
import io.skima.byteapp.dto.WorkerStatsResponse;
import io.skima.byteapp.dto.ContractResponse;
import io.skima.byteapp.dto.NotificationItem;
import io.skima.byteapp.dto.WithholdingReceiptResponse;
import io.skima.byteapp.repository.PayoutRepository;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftApplicationRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.security.AuthUser;
import io.skima.byteapp.service.ApplicationService;
import io.skima.byteapp.service.BrandCatalog;
import io.skima.byteapp.service.CheckInOutService;
import io.skima.byteapp.service.ComplianceService;
import io.skima.byteapp.service.NotificationService;
import io.skima.byteapp.service.PayoutService;
import io.skima.byteapp.service.RatingService;
import io.skima.byteapp.service.ShiftService;
import io.skima.byteapp.service.WorkerStatsService;
import org.springframework.http.ResponseEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/worker")
@RequiredArgsConstructor
public class WorkerController {


    private final ShiftService shiftService;
    private final ApplicationService applicationService;
    private final CheckInOutService checkInOutService;
    private final PayoutService payoutService;
    private final ShiftMatchRepository matchRepository;
    private final ShiftApplicationRepository applicationRepository;
    private final RatingRepository ratingRepository;
    private final PayoutRepository payoutRepository;
    private final RatingService ratingService;
    private final WorkerStatsService workerStatsService;
    private final BrandCatalog brandCatalog;
    private final ComplianceService complianceService;
    private final NotificationService notificationService;
    private final io.skima.byteapp.service.FavoriteService favoriteService;
    private final io.skima.byteapp.repository.ChatMessageRepository chatRepository;
    private final io.skima.byteapp.repository.WorkerBlockedCafeRepository workerBlockedCafeRepository;
    private final io.skima.byteapp.repository.CafeRepository workerCafeRepository;

    /** OPEN 시프트 목록 — 워커 본인 지원 상태 + 브랜드 정보 + 매장 신뢰도 enrich */
    @GetMapping("/shifts")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<WorkerShiftView> openShifts(@AuthenticationPrincipal AuthUser principal) {
        Long workerId = principal.getDomainUser().getId();
        Map<Long, io.skima.byteapp.domain.ApplicationStatus> statusByShift = new HashMap<>();
        applicationRepository.findAllByWorkerId(workerId).forEach(a ->
                statusByShift.put(a.getShift().getId(), a.getStatus()));

        var allOpenShifts = shiftService.findOpenShifts();
        // 단골 우선 노출: favoritesOnlyUntil > now 인 시프트는 즐겨찾기한 워커에게만 노출
        var favCafeIds = new java.util.HashSet<>(
                favoriteService.workerFavoriteCafeIds(principal.getDomainUser()));
        // 차단 매장 자동 제외
        var blockedCafeIds = new java.util.HashSet<>(
                workerBlockedCafeRepository.findCafeIdsByWorkerId(workerId));
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        var openShifts = allOpenShifts.stream()
                .filter(s -> {
                    if (blockedCafeIds.contains(s.getCafe().getId())) return false;
                    var until = s.getFavoritesOnlyUntil();
                    if (until == null || until.isBefore(now)) return true;
                    return favCafeIds.contains(s.getCafe().getId());
                })
                .toList();
        // 매장별 시그널 한 번씩만 계산 (cafeId 중복 제거)
        Map<Long, Double> avgRatingByCafe = new HashMap<>();
        Map<Long, Integer> ratingCountByCafe = new HashMap<>();
        Map<Long, Double> noShowRateByCafe = new HashMap<>();
        Map<Long, Integer> trustScoreByCafe = new HashMap<>();
        java.util.Set<Long> cafeIds = new java.util.HashSet<>();
        openShifts.forEach(s -> cafeIds.add(s.getCafe().getId()));
        for (Long cafeId : cafeIds) {
            List<Rating> ratings = ratingRepository.findAllByCafeIdAndDirection(
                    cafeId, RatingDirection.WORKER_TO_OWNER);
            Double avg = null;
            if (!ratings.isEmpty()) {
                avg = ratings.stream().mapToInt(Rating::getScore).average().orElse(0);
                avgRatingByCafe.put(cafeId, avg);
                ratingCountByCafe.put(cafeId, ratings.size());
            }
            List<ShiftMatch> matches = matchRepository.findAllByCafeId(cafeId);
            Double noShowRate = null;
            int totalMatches = matches.size();
            if (!matches.isEmpty()) {
                long noShow = matches.stream().filter(m -> m.getStatus() == MatchStatus.NO_SHOW).count();
                noShowRate = (double) noShow / matches.size();
                noShowRateByCafe.put(cafeId, noShowRate);
            }
            // 매장 trust score 간단 계산 — 5건 미만이면 null (CafeDetailService 와 동일 공식)
            if (totalMatches >= 5) {
                long uniqueWorkers = matches.stream()
                        .filter(m -> m.getStatus() != MatchStatus.NO_SHOW
                                && m.getStatus() != MatchStatus.CANCELED)
                        .map(m -> m.getWorker().getId())
                        .distinct().count();
                long regulars = matches.stream()
                        .filter(m -> m.getStatus() != MatchStatus.NO_SHOW
                                && m.getStatus() != MatchStatus.CANCELED)
                        .collect(java.util.stream.Collectors.groupingBy(
                                m -> m.getWorker().getId(), java.util.stream.Collectors.counting()))
                        .values().stream().filter(v -> v >= 2).count();
                Double rehire = uniqueWorkers == 0 ? 0 : (double) regulars / uniqueWorkers;
                double s = 0;
                s += (avg != null ? avg / 5.0 : 0) * 35;
                s += rehire * 25;
                s += (1.0 - (noShowRate != null ? noShowRate : 0)) * 15;
                s += 0.5 * 15; // 정산 빠른 승인 — 시프트 검색용 간단 추정 (정확히는 CafeDetailService 에서 계산)
                s += Math.min(totalMatches / 20.0, 1.0) * 10;
                trustScoreByCafe.put(cafeId, (int) Math.round(s));
            }
        }

        return openShifts.stream()
                .map(s -> {
                    Long cid = s.getCafe().getId();
                    return WorkerShiftView.from(
                            s,
                            statusByShift.get(s.getId()),
                            brandCatalog.findByKey(s.getCafe().getBrandKey()).orElse(null),
                            avgRatingByCafe.get(cid),
                            ratingCountByCafe.get(cid),
                            noShowRateByCafe.get(cid),
                            favCafeIds.contains(cid),
                            trustScoreByCafe.get(cid));
                })
                .toList();
    }

    /** 워커 본인 누적 통계 */
    @GetMapping("/me/stats")
    public WorkerStatsResponse myStats(@AuthenticationPrincipal AuthUser principal) {
        return workerStatsService.computeForWorker(principal.getDomainUser().getId());
    }

    /** 워커가 받은 평가 목록 (점주가 자기를 어떻게 평가했나) */
    @GetMapping("/me/ratings")
    public List<RatingResponse> myReceivedRatings(@AuthenticationPrincipal AuthUser principal) {
        return ratingService.findReceivedByWorker(principal.getDomainUser()).stream()
                .map(RatingResponse::from)
                .toList();
    }

    /** 워커가 점주에게 준 평가 목록 */
    @GetMapping("/me/ratings/given")
    public List<RatingResponse> myGivenRatings(@AuthenticationPrincipal AuthUser principal) {
        return ratingService.findGivenByWorker(principal.getDomainUser()).stream()
                .map(RatingResponse::from)
                .toList();
    }

    /** 1탭 지원 */
    @PostMapping("/shifts/{shiftId}/apply")
    public ApplicationResponse apply(@AuthenticationPrincipal AuthUser principal,
                                     @PathVariable Long shiftId) {
        var app = applicationService.apply(principal.getDomainUser(), shiftId);
        return ApplicationResponse.from(app);
    }

    /** 시프트에 대한 본인 지원 철회 */
    @PostMapping("/shifts/{shiftId}/withdraw")
    public ApplicationResponse withdrawByShift(@AuthenticationPrincipal AuthUser principal,
                                               @PathVariable Long shiftId) {
        var app = applicationService.withdrawByShift(principal.getDomainUser(), shiftId);
        return ApplicationResponse.from(app);
    }

    /** 내 지원 내역 */
    @GetMapping("/applications")
    public List<ApplicationResponse> myApplications(@AuthenticationPrincipal AuthUser principal) {
        return applicationService.listByWorker(principal.getDomainUser()).stream()
                .map(ApplicationResponse::from)
                .toList();
    }

    /** 내 매칭 내역 — 평가 가능 여부 enrich */
    @GetMapping("/matches")
    @Transactional(readOnly = true)
    public List<MatchResponse> myMatches(@AuthenticationPrincipal AuthUser principal) {
        Long workerId = principal.getDomainUser().getId();
        var matches = matchRepository.findAllByWorkerId(workerId);

        // 평가 존재 여부 일괄 조회 후 set 으로 lookup (N+1 방지)
        var ownerToWorker = ratingRepository.findAllByWorkerIdAndDirection(
                workerId, RatingDirection.OWNER_TO_WORKER);
        var workerToOwner = ratingRepository.findAllByWorkerIdAndDirection(
                workerId, RatingDirection.WORKER_TO_OWNER);
        Set<Long> ownerRatedMatches = new HashSet<>();
        ownerToWorker.forEach(r -> ownerRatedMatches.add(r.getMatch().getId()));
        Set<Long> workerRatedMatches = new HashSet<>();
        workerToOwner.forEach(r -> workerRatedMatches.add(r.getMatch().getId()));

        // payout 상태 일괄 enrich (N+1 방지를 위해 매칭당 단일 조회)
        return matches.stream()
                .map(m -> {
                    var po = payoutRepository.findByMatchId(m.getId()).orElse(null);
                    // 워커가 안 본 점주 메시지 수
                    var seen = m.getWorkerChatSeenAt();
                    long chatUnread = seen == null
                            ? chatRepository.countByMatchIdAndSenderRole(
                                    m.getId(), io.skima.byteapp.domain.UserRole.OWNER)
                            : chatRepository.countByMatchIdAndSenderRoleAndCreatedAtAfter(
                                    m.getId(), io.skima.byteapp.domain.UserRole.OWNER, seen);
                    return MatchResponse.from(m,
                            ownerRatedMatches.contains(m.getId()),
                            workerRatedMatches.contains(m.getId()),
                            po == null ? null : po.getStatus().name(),
                            po == null ? null : po.getApprovedAt(),
                            po == null ? null : po.isAutoApproved(),
                            po == null ? null : po.getCompletedAt(),
                            chatUnread);
                })
                .toList();
    }

    /** 출근 체크인 — GPS 좌표 동봉 가능 (반경 100m 게이트). 좌표 미동봉 시 게이트 스킵 */
    @PostMapping("/matches/{matchId}/check-in")
    public MatchResponse checkIn(@AuthenticationPrincipal AuthUser principal,
                                 @PathVariable Long matchId,
                                 @RequestBody(required = false) Map<String, Double> body) {
        Double lat = body == null ? null : body.get("latitude");
        Double lon = body == null ? null : body.get("longitude");
        var m = checkInOutService.checkIn(principal.getDomainUser(), matchId, lat, lon);
        return MatchResponse.from(m);
    }

    /** 퇴근 체크아웃 — 정산 트리거 */
    @PostMapping("/matches/{matchId}/check-out")
    public MatchResponse checkOut(@AuthenticationPrincipal AuthUser principal,
                                  @PathVariable Long matchId) {
        var m = checkInOutService.checkOut(principal.getDomainUser(), matchId);
        return MatchResponse.from(m);
    }

    /** 워커 → 점주 평가 (시프트 종료 후) */
    @PostMapping("/matches/{matchId}/rating")
    public RatingResponse rateOwner(@AuthenticationPrincipal AuthUser principal,
                                    @PathVariable Long matchId,
                                    @Valid @RequestBody RatingCreateRequest req) {
        var rating = ratingService.rateByWorker(principal.getDomainUser(), matchId, req);
        return RatingResponse.from(rating);
    }

    /** 내 정산 내역 */
    @GetMapping("/payouts")
    public List<PayoutResponse> myPayouts(@AuthenticationPrincipal AuthUser principal) {
        return payoutService.findByWorker(principal.getDomainUser()).stream()
                .map(PayoutResponse::from)
                .toList();
    }

    /** 내 근로계약서 — 본인 매칭만 조회 */
    @GetMapping("/matches/{matchId}/contract")
    public ContractResponse contract(@AuthenticationPrincipal AuthUser principal,
                                     @PathVariable Long matchId) {
        return complianceService.buildContractForWorker(principal.getDomainUser(), matchId);
    }

    /** 워커 측 근로계약서 확인 동의 — 본인 매칭만, 1회 기록 (이후 호출은 무시) */
    @PostMapping("/matches/{matchId}/contract/ack")
    @Transactional
    public Map<String, Object> ackContract(@AuthenticationPrincipal AuthUser principal,
                                            @PathVariable Long matchId) {
        ShiftMatch m = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("매칭을 찾을 수 없어요"));
        if (!m.getWorker().getId().equals(principal.getDomainUser().getId())) {
            throw new IllegalStateException("본인 매칭이 아닙니다");
        }
        m.acknowledgeContractByWorker(java.time.LocalDateTime.now());
        Map<String, Object> result = new HashMap<>();
        result.put("workerAcknowledgedContractAt", m.getWorkerAcknowledgedContractAt().toString());
        result.put("ownerAcknowledgedContractAt",
                m.getOwnerAcknowledgedContractAt() != null ? m.getOwnerAcknowledgedContractAt().toString() : null);
        return result;
    }

    /** 내 원천징수영수증 — 본인 매칭만 조회 */
    @GetMapping("/matches/{matchId}/withholding")
    public WithholdingReceiptResponse withholding(@AuthenticationPrincipal AuthUser principal,
                                                  @PathVariable Long matchId) {
        return complianceService.buildWithholdingForWorker(principal.getDomainUser(), matchId);
    }

    /** 워커 알림 인박스 */
    @GetMapping("/notifications")
    public List<NotificationItem> notifications(@AuthenticationPrincipal AuthUser principal) {
        return notificationService.forWorker(principal.getDomainUser());
    }

    @PostMapping("/notifications/mark-seen")
    public ResponseEntity<Void> markNotificationsSeen(@AuthenticationPrincipal AuthUser principal) {
        notificationService.markAllSeen(principal.getDomainUser());
        return ResponseEntity.noContent().build();
    }

    /* ========= 즐겨찾기 매장 (Phase 3 리텐션) ========= */

    @GetMapping("/favorites/cafes")
    public List<Long> myFavoriteCafeIds(@AuthenticationPrincipal AuthUser principal) {
        return favoriteService.workerFavoriteCafeIds(principal.getDomainUser());
    }

    @PostMapping("/favorites/cafes/{cafeId}")
    public ResponseEntity<Void> addFavoriteCafe(@AuthenticationPrincipal AuthUser principal,
                                                 @PathVariable Long cafeId) {
        favoriteService.addWorkerFavorite(principal.getDomainUser(), cafeId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/favorites/cafes/{cafeId}")
    public ResponseEntity<Void> removeFavoriteCafe(@AuthenticationPrincipal AuthUser principal,
                                                    @PathVariable Long cafeId) {
        favoriteService.removeWorkerFavorite(principal.getDomainUser(), cafeId);
        return ResponseEntity.noContent().build();
    }

    /* ========= 차단 매장 (시프트 자동 제외) ========= */

    @GetMapping("/blocked/cafes")
    public List<Long> myBlockedCafeIds(@AuthenticationPrincipal AuthUser principal) {
        return workerBlockedCafeRepository.findCafeIdsByWorkerId(principal.getDomainUser().getId());
    }

    @PostMapping("/blocked/cafes/{cafeId}")
    @Transactional
    public ResponseEntity<Void> blockCafe(@AuthenticationPrincipal AuthUser principal,
                                           @PathVariable Long cafeId,
                                           @RequestBody(required = false) java.util.Map<String, String> body) {
        var worker = principal.getDomainUser();
        // 단골이면 자동 해제 (단골/차단 동시 불가)
        if (favoriteService.workerFavoriteCafeIds(worker).contains(cafeId)) {
            favoriteService.removeWorkerFavorite(worker, cafeId);
        }
        if (workerBlockedCafeRepository.existsByWorkerIdAndCafeId(worker.getId(), cafeId)) {
            return ResponseEntity.noContent().build();
        }
        var cafe = workerCafeRepository.findById(cafeId)
                .orElseThrow(() -> io.skima.byteapp.common.BusinessException.notFound("매장을 찾을 수 없습니다"));
        String reason = body != null ? body.get("reason") : null;
        workerBlockedCafeRepository.save(io.skima.byteapp.domain.WorkerBlockedCafe.builder()
                .worker(worker).cafe(cafe).reason(reason).build());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/blocked/cafes/{cafeId}")
    @Transactional
    public ResponseEntity<Void> unblockCafe(@AuthenticationPrincipal AuthUser principal,
                                              @PathVariable Long cafeId) {
        workerBlockedCafeRepository.findByWorkerIdAndCafeId(principal.getDomainUser().getId(), cafeId)
                .ifPresent(workerBlockedCafeRepository::delete);
        return ResponseEntity.noContent().build();
    }
}
