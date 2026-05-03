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
@Table(name = "shifts", indexes = {
        @Index(name = "idx_shift_status", columnList = "status"),
        @Index(name = "idx_shift_start_at", columnList = "start_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Shift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cafe_id", nullable = false)
    private Cafe cafe;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;

    @Column(name = "hourly_wage", nullable = false)
    private Integer hourlyWage;

    @Column(nullable = false)
    private Integer headcount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ShiftStatus status;

    @Column(length = 256)
    private String description;

    /** 직무 카테고리 (BARISTA/HALL/CASHIER/BAKER/KITCHEN/OPENING/CLOSING). nullable=일반 */
    @Enumerated(EnumType.STRING)
    @Column(name = "job_role", length = 16)
    private JobRole jobRole;

    /** 최소 요구 등급 (L1~L4). nullable=L1 디폴트 */
    @Enumerated(EnumType.STRING)
    @Column(name = "min_skill", length = 16)
    private SkillLevel minSkill;

    /** 요구 자격 — HEALTH_CERT / NIGHT_OK / SOLO_CLOSING / POS_EXPERIENCED / LATTE_ART / ENGLISH_OK / EARLY_MORNING */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "shift_requirements",
            joinColumns = @JoinColumn(name = "shift_id"),
            indexes = @Index(name = "idx_shift_req_shift", columnList = "shift_id"))
    @Column(name = "requirement", length = 32, nullable = false)
    private Set<String> requirements = new HashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "matched_at")
    private LocalDateTime matchedAt;

    /** 단골 워커에게만 N분 우선 노출 — 이 시각까지는 즐겨찾기한 워커만 지원 가능. null=모두 공개 */
    @Column(name = "favorites_only_until")
    private LocalDateTime favoritesOnlyUntil;

    @Builder
    public Shift(Cafe cafe, LocalDateTime startAt, LocalDateTime endAt,
                 Integer hourlyWage, Integer headcount, String description,
                 JobRole jobRole, SkillLevel minSkill, Set<String> requirements,
                 LocalDateTime favoritesOnlyUntil) {
        this.cafe = cafe;
        this.startAt = startAt;
        this.endAt = endAt;
        this.hourlyWage = hourlyWage;
        this.headcount = headcount == null ? 1 : headcount;
        this.description = description;
        this.jobRole = jobRole;
        this.minSkill = minSkill;
        if (requirements != null) this.requirements = new HashSet<>(requirements);
        this.status = ShiftStatus.OPEN;
        this.favoritesOnlyUntil = favoritesOnlyUntil;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public void markMatched(LocalDateTime at) {
        this.status = ShiftStatus.MATCHED;
        this.matchedAt = at;
    }

    /** 노쇼 발생 후 백업 후보 없을 때 — 시프트를 다시 모집 상태로 */
    public void markOpen() {
        this.status = ShiftStatus.OPEN;
        this.matchedAt = null;
    }

    public void markInProgress() {
        this.status = ShiftStatus.IN_PROGRESS;
    }

    public void markCompleted() {
        this.status = ShiftStatus.COMPLETED;
    }

    public void cancel() {
        this.status = ShiftStatus.CANCELED;
    }
}
