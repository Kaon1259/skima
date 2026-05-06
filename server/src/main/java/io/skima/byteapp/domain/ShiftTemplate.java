package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * 시프트 템플릿 — 매주 X요일에 자동 등록될 시프트 패턴.
 * Active 상태이면 매일 00:05 cron 이 다음 7일 안에 등록되어야 할 시프트를 자동 생성.
 */
@Entity
@Table(name = "shift_templates", indexes = {
        @Index(name = "idx_tpl_owner", columnList = "owner_id"),
        @Index(name = "idx_tpl_cafe", columnList = "cafe_id"),
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ShiftTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cafe_id", nullable = false)
    private Cafe cafe;

    @Column(name = "name", length = 64)
    private String name;

    /** 해당 요일들에 시프트 자동 등록 */
    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    @CollectionTable(name = "shift_template_dows",
            joinColumns = @JoinColumn(name = "template_id"))
    @Column(name = "dow", length = 16, nullable = false)
    private Set<DayOfWeek> daysOfWeek = new HashSet<>();

    @Column(name = "start_hour", nullable = false)
    private Integer startHour;

    @Column(name = "start_minute", nullable = false)
    private Integer startMinute;

    @Column(name = "duration_hours", nullable = false)
    private Double durationHours;

    @Column(name = "hourly_wage", nullable = false)
    private Integer hourlyWage;

    @Column(name = "headcount", nullable = false)
    private Integer headcount;

    @Column(name = "description", length = 256)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "job_role", length = 16)
    private JobRole jobRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "min_skill", length = 16)
    private SkillLevel minSkill;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "shift_template_requirements",
            joinColumns = @JoinColumn(name = "template_id"))
    @Column(name = "requirement", length = 32, nullable = false)
    private Set<String> requirements = new HashSet<>();

    @Column(name = "active", nullable = false)
    private Boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public ShiftTemplate(User owner, Cafe cafe, String name, Set<DayOfWeek> daysOfWeek,
                         Integer startHour, Integer startMinute, Double durationHours,
                         Integer hourlyWage, Integer headcount, String description,
                         JobRole jobRole, SkillLevel minSkill, Set<String> requirements,
                         Boolean active) {
        this.owner = owner;
        this.cafe = cafe;
        this.name = name;
        if (daysOfWeek != null) this.daysOfWeek = new HashSet<>(daysOfWeek);
        this.startHour = startHour;
        this.startMinute = startMinute == null ? 0 : startMinute;
        this.durationHours = durationHours;
        this.hourlyWage = hourlyWage;
        this.headcount = headcount == null ? 1 : headcount;
        this.description = description;
        this.jobRole = jobRole;
        this.minSkill = minSkill;
        if (requirements != null) this.requirements = new HashSet<>(requirements);
        this.active = active == null ? true : active;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public void setCafe(Cafe cafe) { this.cafe = cafe; }
    public void setName(String name) { this.name = name; }
    public void setDaysOfWeek(Set<DayOfWeek> daysOfWeek) {
        this.daysOfWeek = daysOfWeek == null ? new HashSet<>() : new HashSet<>(daysOfWeek);
    }
    public void setStartHour(Integer startHour) { this.startHour = startHour; }
    public void setStartMinute(Integer startMinute) { this.startMinute = startMinute == null ? 0 : startMinute; }
    public void setDurationHours(Double durationHours) { this.durationHours = durationHours; }
    public void setHourlyWage(Integer hourlyWage) { this.hourlyWage = hourlyWage; }
    public void setHeadcount(Integer headcount) { this.headcount = headcount == null ? 1 : headcount; }
    public void setDescription(String description) { this.description = description; }
    public void setJobRole(JobRole jobRole) { this.jobRole = jobRole; }
    public void setMinSkill(SkillLevel minSkill) { this.minSkill = minSkill; }
    public void setRequirements(Set<String> requirements) {
        this.requirements = requirements == null ? new HashSet<>() : new HashSet<>(requirements);
    }
}
