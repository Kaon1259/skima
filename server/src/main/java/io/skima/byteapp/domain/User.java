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

    @Column(name = "profile_image", length = 512)
    private String profileImage;

    /** 알림 패널을 마지막으로 본 시각 — 이후 발생한 알림만 unread 로 카운트 */
    @Column(name = "last_notification_seen_at")
    private LocalDateTime lastNotificationSeenAt;

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

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    /** 카카오 재로그인 시 비밀번호·프로필 이미지 갱신용 */
    public void updateKakaoCredentials(String newPasswordHash, String newProfileImage) {
        this.password = newPasswordHash;
        if (newProfileImage != null) this.profileImage = newProfileImage;
    }

    public void markNotificationsSeen(LocalDateTime at) {
        this.lastNotificationSeenAt = at;
    }
}
