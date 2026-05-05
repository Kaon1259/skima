package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(name = "uk_user_username", columnNames = "username"),
        @UniqueConstraint(name = "uk_user_kakao_id", columnNames = "kakao_id")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String username;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(length = 32)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role;

    @Column(name = "bank_account", length = 64)
    private String bankAccount;

    /** 카카오 OAuth 로그인 시 채워짐. 로컬 로그인 사용자는 null */
    @Column(name = "kakao_id", length = 64)
    private String kakaoId;

    /** 프로필 이미지 — base64 data URL (작은 썸네일) 또는 외부 URL. MEDIUMTEXT (16MB) */
    @Column(name = "profile_image", columnDefinition = "MEDIUMTEXT")
    private String profileImage;

    /** 알림 패널을 마지막으로 본 시각 — 이후 발생한 알림만 unread 로 카운트 */
    @Column(name = "last_notification_seen_at")
    private LocalDateTime lastNotificationSeenAt;

    /** Expo Push Token — 디바이스별 1개. 새 디바이스에서 로그인하면 덮어씀 */
    @Column(name = "expo_push_token", length = 255)
    private String expoPushToken;

    /** 워커 자기신고 능력 등급. 디폴트 L2_BASIC. WORKER 만 의미 있음. */
    @Enumerated(EnumType.STRING)
    @Column(name = "self_reported_level", length = 16)
    private SkillLevel selfReportedLevel;

    /** 워커가 가능하다고 신고한 직무. 비어있으면 모든 직무 가능. */
    @ElementCollection(fetch = FetchType.EAGER, targetClass = JobRole.class)
    @Enumerated(EnumType.STRING)
    @CollectionTable(name = "user_capable_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            indexes = @Index(name = "idx_ucr_user", columnList = "user_id"))
    @Column(name = "role", length = 16, nullable = false)
    private Set<JobRole> capableRoles = new HashSet<>();

    /** 워커 자기신고 자격증. 자기신고 (Phase 2 점주 인증) */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_certifications",
            joinColumns = @JoinColumn(name = "user_id"),
            indexes = @Index(name = "idx_uc_user", columnList = "user_id"))
    @Column(name = "certification", length = 32, nullable = false)
    private Set<String> certifications = new HashSet<>();

    /** 워커 자기소개 — 점주에게 어필하는 자유 텍스트 */
    @Column(name = "bio", length = 1024)
    private String bio;

    /** 워커 경력 (햇수). 단기 알바 이력 합산 자기신고 */
    @Column(name = "experience_years")
    private Integer experienceYears;

    /** 워커 가능 시간대 자유 입력 (예: "주말 위주 / 평일 야간") */
    @Column(name = "available_hours", length = 256)
    private String availableHours;

    /** 워커 선호 — 시프트 시급 최소값 (원). 0/null = 제한 없음. 알림 푸시 + 시프트 화면 영구 필터로 사용. */
    @Column(name = "pref_min_wage")
    private Integer prefMinWage;

    /** 워커 선호 — 매장 평균 별점 최소값. null = 제한 없음 */
    @Column(name = "pref_min_cafe_rating")
    private Double prefMinCafeRating;

    /** 워커 선호 — 매장 노쇼율 최대값 (0~1). null = 제한 없음 */
    @Column(name = "pref_max_cafe_noshow_rate")
    private Double prefMaxCafeNoShowRate;

    /** 보건증 이미지 (S3 URL). null = 미업로드 */
    @Column(name = "health_cert_image", columnDefinition = "MEDIUMTEXT")
    private String healthCertImage;

    /** 보건증 인증 상태 */
    @Enumerated(EnumType.STRING)
    @Column(name = "health_cert_status", length = 16)
    private HealthCertStatus healthCertStatus;

    /** 보건증 업로드 시각 */
    @Column(name = "health_cert_uploaded_at")
    private LocalDateTime healthCertUploadedAt;

    /** 보건증 인증 완료 시각 (관리자/자동 검증 시점) */
    @Column(name = "health_cert_verified_at")
    private LocalDateTime healthCertVerifiedAt;

    /** 보건증 만료일 (1년 — 발급일 기준이 아니라 업로드 시점 + 1년 으로 단순화) */
    @Column(name = "health_cert_expires_at")
    private LocalDateTime healthCertExpiresAt;

    /** 거부 사유 (REJECTED 상태에서) */
    @Column(name = "health_cert_reject_reason", length = 256)
    private String healthCertRejectReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public User(String username, String password, String name, String phone, UserRole role,
                String bankAccount, String kakaoId, String profileImage,
                SkillLevel selfReportedLevel, Set<JobRole> capableRoles, Set<String> certifications) {
        this.username = username;
        this.password = password;
        this.name = name;
        this.phone = phone;
        this.role = role;
        this.bankAccount = bankAccount;
        this.kakaoId = kakaoId;
        this.profileImage = profileImage;
        this.selfReportedLevel = selfReportedLevel;
        if (capableRoles != null) this.capableRoles = new HashSet<>(capableRoles);
        if (certifications != null) this.certifications = new HashSet<>(certifications);
    }

    /** 워커 자기신고 프로필 갱신 — null이면 해당 필드 변경 안 함 */
    public void updateWorkerProfile(SkillLevel level, Set<JobRole> roles, Set<String> certs) {
        if (level != null) this.selfReportedLevel = level;
        if (roles != null) {
            this.capableRoles.clear();
            this.capableRoles.addAll(roles);
        }
        if (certs != null) {
            this.certifications.clear();
            this.certifications.addAll(certs);
        }
    }

    /** 워커 자기소개/경력/가능시간대 갱신 — 빈 문자열은 null로 */
    public void updateWorkerBio(String bio, Integer experienceYears, String availableHours) {
        this.bio = (bio != null && !bio.isBlank()) ? bio : null;
        this.experienceYears = experienceYears;
        this.availableHours = (availableHours != null && !availableHours.isBlank()) ? availableHours : null;
    }

    /** 워커 선호 조건 갱신 — null/0 = 제한 없음 */
    public void updateWorkerPrefs(Integer minWage, Double minCafeRating, Double maxCafeNoShowRate) {
        this.prefMinWage = (minWage != null && minWage > 0) ? minWage : null;
        this.prefMinCafeRating = minCafeRating;
        this.prefMaxCafeNoShowRate = maxCafeNoShowRate;
    }

    /** 입금 계좌 갱신 — 빈 문자열은 null 처리 */
    public void updateBankAccount(String bankAccount) {
        if (bankAccount == null || bankAccount.isBlank()) {
            this.bankAccount = null;
        } else {
            this.bankAccount = bankAccount.trim();
        }
    }

    /** 워커 prefs 가 통과하는 시프트인지 — 매장 단골이면 면제, 그 외엔 prefs 모두 통과해야 함 */
    public boolean prefsAcceptShift(Integer hourlyWage, Double cafeAvgRating, Double cafeNoShowRate, boolean isFavoriteCafe) {
        if (isFavoriteCafe) return true;
        if (prefMinWage != null && prefMinWage > 0) {
            if (hourlyWage == null || hourlyWage < prefMinWage) return false;
        }
        if (prefMinCafeRating != null) {
            if (cafeAvgRating != null && cafeAvgRating < prefMinCafeRating) return false;
        }
        if (prefMaxCafeNoShowRate != null) {
            if (cafeNoShowRate != null && cafeNoShowRate > prefMaxCafeNoShowRate) return false;
        }
        return true;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    /** 카카오 재로그인 시 비밀번호·프로필 이미지 갱신용 */
    public void updateKakaoCredentials(String newPasswordHash, String newProfileImage) {
        this.password = newPasswordHash;
        if (newProfileImage != null) this.profileImage = newProfileImage;
    }

    /** 프로필 이미지 직접 갱신 (사용자 업로드) — null/빈 문자열 = clear */
    public void setProfileImage(String image) {
        this.profileImage = (image != null && !image.isBlank()) ? image : null;
    }

    /** 보건증 이미지 업로드 — 자동 PENDING / 1년 후 EXPIRED. */
    public void uploadHealthCert(String imageUrl) {
        this.healthCertImage = imageUrl;
        this.healthCertStatus = HealthCertStatus.PENDING;
        LocalDateTime now = LocalDateTime.now();
        this.healthCertUploadedAt = now;
        this.healthCertVerifiedAt = null;
        this.healthCertExpiresAt = now.plusYears(1);
        this.healthCertRejectReason = null;
    }

    /** 보건증 인증 — 관리자 또는 자동(MVP) */
    public void verifyHealthCert() {
        this.healthCertStatus = HealthCertStatus.VERIFIED;
        this.healthCertVerifiedAt = LocalDateTime.now();
        this.healthCertRejectReason = null;
    }

    public void rejectHealthCert(String reason) {
        this.healthCertStatus = HealthCertStatus.REJECTED;
        this.healthCertRejectReason = reason;
    }

    /** cron 만료 처리 */
    public void expireHealthCert() {
        this.healthCertStatus = HealthCertStatus.EXPIRED;
    }

    public void clearHealthCert() {
        this.healthCertImage = null;
        this.healthCertStatus = null;
        this.healthCertUploadedAt = null;
        this.healthCertVerifiedAt = null;
        this.healthCertExpiresAt = null;
        this.healthCertRejectReason = null;
    }

    public void markNotificationsSeen(LocalDateTime at) {
        this.lastNotificationSeenAt = at;
    }

    public void setExpoPushToken(String token) {
        this.expoPushToken = token;
    }
}
