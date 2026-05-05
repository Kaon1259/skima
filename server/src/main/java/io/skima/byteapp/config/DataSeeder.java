package io.skima.byteapp.config;

import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.CafeType;
import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftApplication;
import io.skima.byteapp.domain.SkillLevel;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.repository.CafeRepository;
import io.skima.byteapp.repository.PayoutRepository;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftApplicationRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import io.skima.byteapp.repository.ShiftRepository;
import io.skima.byteapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CafeRepository cafeRepository;
    private final ShiftRepository shiftRepository;
    private final ShiftApplicationRepository applicationRepository;
    private final ShiftMatchRepository matchRepository;
    private final PayoutRepository payoutRepository;
    private final RatingRepository ratingRepository;
    private final PasswordEncoder passwordEncoder;
    private final SkimaProperties props;

    @Override
    @Transactional
    public void run(String... args) {
        if (!props.getSeed().isRefreshOnStart()) {
            log.info("[SEED] skima.seed.refresh-on-start=false — wipe + reseed 건너뜀");
            return;
        }
        log.info("[SEED] wiping existing test data");
        ratingRepository.deleteAllInBatch();
        payoutRepository.deleteAllInBatch();
        matchRepository.deleteAllInBatch();
        applicationRepository.deleteAllInBatch();
        shiftRepository.deleteAllInBatch();
        cafeRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        log.info("[SEED] inserting fresh scenario data");

        String pw = passwordEncoder.encode("pw1234");

        // 1 admin
        userRepository.save(User.builder()
                .username("admin").password(pw).name("관리자").phone("010-0000-0000")
                .role(UserRole.ADMIN).build());

        // 5 owners — owner1~3 은 매장 보유, owner4·5 는 매장 0개 (신규 점주 온보딩 테스트용)
        User owner1 = userRepository.save(User.builder()
                .username("owner1").password(pw).name("점주김씨").phone("010-1111-1111")
                .role(UserRole.OWNER).build());
        User owner2 = userRepository.save(User.builder()
                .username("owner2").password(pw).name("점주이씨").phone("010-2222-2222")
                .role(UserRole.OWNER).build());
        User owner3 = userRepository.save(User.builder()
                .username("owner3").password(pw).name("점주박씨").phone("010-3333-3333")
                .role(UserRole.OWNER).build());
        userRepository.save(User.builder()
                .username("owner4").password(pw).name("신규점주최씨").phone("010-4444-4444")
                .role(UserRole.OWNER).build());
        userRepository.save(User.builder()
                .username("owner5").password(pw).name("신규점주정씨").phone("010-5555-5555")
                .role(UserRole.OWNER).build());

        // 4 workers — 등급 다양 (테스트용)
        List<User> workers = new ArrayList<>();
        SkillLevel[] levels = { SkillLevel.L2_BASIC, SkillLevel.L3_SKILLED, SkillLevel.L1_TRAINEE, SkillLevel.L4_EXPERT };
        for (int i = 1; i <= 4; i++) {
            workers.add(userRepository.save(User.builder()
                    .username("worker" + i).password(pw).name("워커" + i)
                    .phone("010-9999-000" + i).role(UserRole.WORKER)
                    .bankAccount("토스 1234-" + i)
                    .selfReportedLevel(levels[i - 1])
                    .capableRoles(java.util.EnumSet.of(JobRole.BARISTA, JobRole.HALL, JobRole.CASHIER))
                    .certifications(i == 1 ? java.util.Set.of("HEALTH_CERT") : java.util.Set.of())
                    .build()));
        }

        // 4 cafes — 종류 다양 (프렌차이즈 카페 / 베이커리 / 개인). 좌표는 카카오맵 데모용 임의 값
        Cafe cafe1 = cafeRepository.save(Cafe.builder()
                .owner(owner1).name("메가MGC커피 강남역점").address("서울 강남구 강남대로 123")
                .cafeType(CafeType.FRANCHISE_CAFE).brandKey("mega")
                .latitude(37.4979).longitude(127.0276).build());
        cafe1.setImageUrl("https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=240&h=240&q=70");
        Cafe cafe2 = cafeRepository.save(Cafe.builder()
                .owner(owner1).name("메가MGC커피 역삼점").address("서울 강남구 역삼로 45")
                .cafeType(CafeType.FRANCHISE_CAFE).brandKey("mega")
                .latitude(37.5006).longitude(127.0367).build());
        Cafe cafe3 = cafeRepository.save(Cafe.builder()
                .owner(owner2).name("컴포즈커피 홍대점").address("서울 마포구 홍익로 78")
                .cafeType(CafeType.FRANCHISE_CAFE).brandKey("compose")
                .latitude(37.5547).longitude(126.9237).build());
        cafe3.setImageUrl("https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=240&h=240&q=70");
        Cafe cafe4 = cafeRepository.save(Cafe.builder()
                .owner(owner3).name("파리바게뜨 신촌점").address("서울 서대문구 연세로 90")
                .cafeType(CafeType.FRANCHISE_BAKERY).brandKey("parisbaguette")
                .latitude(37.5573).longitude(126.9389).build());

        if (!props.getSeed().isCreateShiftsAndApps()) {
            log.info("[SEED] done — users + cafes only (skima.seed.create-shifts-and-apps=false)");
            log.info("[SEED] login: admin·owner1~5·worker1~4 (모두 비번 pw1234, owner4·5는 빈 점주)");
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        // 6 OPEN shifts across cafes
        Shift s1 = saveShift(cafe1, now.plusHours(2), 4, 11_000, "오후 피크 4시간");
        Shift s2 = saveShift(cafe1, now.plusHours(7), 4, 11_500, "저녁 피크 4시간");
        Shift s3 = saveShift(cafe2, now.plusHours(3), 5, 11_000, "런치 + 오후");
        Shift s4 = saveShift(cafe3, now.plusHours(1).plusMinutes(30), 6, 12_000, "홍대 주말 6시간");
        Shift s5 = saveShift(cafe3, now.plusHours(10), 4, 11_500, "마감 청소 포함");
        Shift s6 = saveShift(cafe4, now.plusHours(4), 5, 10_500, "신촌 평일 오후");

        // 사전 지원 (PENDING) — "이미 지원함" 상태 즉시 검증
        // worker1 → s1, s4
        // worker2 → s1, s3
        // worker3 → s4, s5
        applicationRepository.save(ShiftApplication.builder().shift(s1).worker(workers.get(0)).build());
        applicationRepository.save(ShiftApplication.builder().shift(s4).worker(workers.get(0)).build());
        applicationRepository.save(ShiftApplication.builder().shift(s1).worker(workers.get(1)).build());
        applicationRepository.save(ShiftApplication.builder().shift(s3).worker(workers.get(1)).build());
        applicationRepository.save(ShiftApplication.builder().shift(s4).worker(workers.get(2)).build());
        applicationRepository.save(ShiftApplication.builder().shift(s5).worker(workers.get(2)).build());

        log.info("[SEED] done — 1 admin / 3 owners / 4 workers / 4 cafes / 6 OPEN shifts / 6 pending apps");
        log.info("[SEED] login: admin·owner1~5·worker1~4 (모두 비번 pw1234, owner4·5는 빈 점주)");
        log.info("[SEED] 시나리오: worker1로 로그인 → 시프트 #1, #4는 '지원 대기' 표시 / #2, #3, #5, #6 만 지원 가능");
    }

    private Shift saveShift(Cafe cafe, LocalDateTime startAt, int hours, int wage, String desc) {
        return shiftRepository.save(Shift.builder()
                .cafe(cafe)
                .startAt(startAt)
                .endAt(startAt.plusHours(hours))
                .hourlyWage(wage)
                .headcount(1)
                .description(desc)
                .build());
    }
}
