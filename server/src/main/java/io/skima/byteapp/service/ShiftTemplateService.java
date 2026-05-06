package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.Shift;
import io.skima.byteapp.domain.ShiftStatus;
import io.skima.byteapp.domain.ShiftTemplate;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.dto.ShiftTemplateRequest;
import io.skima.byteapp.repository.CafeRepository;
import io.skima.byteapp.repository.ShiftRepository;
import io.skima.byteapp.repository.ShiftTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShiftTemplateService {

    private final ShiftTemplateRepository templateRepository;
    private final ShiftRepository shiftRepository;
    private final CafeRepository cafeRepository;
    private static final int LOOKAHEAD_DAYS = 14;

    @Transactional
    public ShiftTemplate create(User owner, ShiftTemplateRequest req) {
        Cafe cafe = cafeRepository.findById(req.cafeId())
                .orElseThrow(() -> BusinessException.notFound("매장을 찾을 수 없습니다"));
        if (!cafe.getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 소유 매장이 아닙니다");
        }
        if (req.daysOfWeek() == null || req.daysOfWeek().isEmpty()) {
            throw BusinessException.badRequest("요일을 1개 이상 선택해주세요");
        }
        if (req.durationHours() == null || req.durationHours() <= 0) {
            throw BusinessException.badRequest("근무 시간은 양수여야 합니다");
        }
        ShiftTemplate t = ShiftTemplate.builder()
                .owner(owner)
                .cafe(cafe)
                .name(req.name())
                .daysOfWeek(req.daysOfWeek())
                .startHour(req.startHour())
                .startMinute(req.startMinute())
                .durationHours(req.durationHours())
                .hourlyWage(req.hourlyWage())
                .headcount(req.headcount())
                .description(req.description())
                .jobRole(req.jobRole())
                .minSkill(req.minSkill())
                .requirements(req.requirements())
                .active(req.active() == null ? true : req.active())
                .build();
        return templateRepository.save(t);
    }

    @Transactional(readOnly = true)
    public List<ShiftTemplate> myTemplates(User owner) {
        return templateRepository.findAllByOwnerIdOrderByCreatedAtDesc(owner.getId());
    }

    @Transactional
    public ShiftTemplate update(User owner, Long id, ShiftTemplateRequest req) {
        var t = templateRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("템플릿을 찾을 수 없습니다"));
        if (!t.getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 템플릿만 수정 가능");
        }
        if (req.daysOfWeek() == null || req.daysOfWeek().isEmpty()) {
            throw BusinessException.badRequest("요일을 1개 이상 선택해주세요");
        }
        if (req.durationHours() == null || req.durationHours() <= 0) {
            throw BusinessException.badRequest("근무 시간은 양수여야 합니다");
        }
        // 매장 변경 가능 — 본인 매장이어야 함
        if (req.cafeId() != null && !req.cafeId().equals(t.getCafe().getId())) {
            var newCafe = cafeRepository.findById(req.cafeId())
                    .orElseThrow(() -> BusinessException.notFound("매장을 찾을 수 없습니다"));
            if (!newCafe.getOwner().getId().equals(owner.getId())) {
                throw BusinessException.forbidden("본인 소유 매장이 아닙니다");
            }
            t.setCafe(newCafe);
        }
        t.setName(req.name());
        t.setDaysOfWeek(req.daysOfWeek());
        t.setStartHour(req.startHour());
        t.setStartMinute(req.startMinute() == null ? 0 : req.startMinute());
        t.setDurationHours(req.durationHours());
        t.setHourlyWage(req.hourlyWage());
        t.setHeadcount(req.headcount() == null ? 1 : req.headcount());
        t.setDescription(req.description());
        t.setJobRole(req.jobRole());
        t.setMinSkill(req.minSkill());
        t.setRequirements(req.requirements());
        if (req.active() != null) t.setActive(req.active());
        return t;
    }

    @Transactional
    public ShiftTemplate setActive(User owner, Long id, boolean active) {
        var t = templateRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("템플릿을 찾을 수 없습니다"));
        if (!t.getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 템플릿만 수정 가능");
        }
        t.setActive(active);
        return t;
    }

    @Transactional
    public void delete(User owner, Long id) {
        var t = templateRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("템플릿을 찾을 수 없습니다"));
        if (!t.getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 템플릿만 삭제 가능");
        }
        templateRepository.delete(t);
    }

    /** 단일 템플릿을 즉시 적용해서 다음 N일 안에 시프트 생성 */
    @Transactional
    public int materialize(User owner, Long id, int days) {
        var t = templateRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("템플릿을 찾을 수 없습니다"));
        if (!t.getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 템플릿만 적용 가능");
        }
        return generateShiftsFromTemplate(t, Math.min(60, Math.max(1, days)));
    }

    /** 활성 템플릿 모두 다음 LOOKAHEAD_DAYS 일 안에 시프트 자동 생성 (cron 에서 호출) */
    @Transactional
    public int generateForActiveTemplates() {
        int total = 0;
        for (var t : templateRepository.findAllByActiveTrue()) {
            total += generateShiftsFromTemplate(t, LOOKAHEAD_DAYS);
        }
        return total;
    }

    private int generateShiftsFromTemplate(ShiftTemplate t, int days) {
        int created = 0;
        LocalDate today = LocalDate.now();
        int hours = (int) Math.floor(t.getDurationHours());
        long extraMinutes = Math.round((t.getDurationHours() - hours) * 60);
        for (int i = 0; i < days; i++) {
            LocalDate date = today.plusDays(i);
            if (!t.getDaysOfWeek().contains(date.getDayOfWeek())) continue;
            LocalDateTime startAt = date.atTime(t.getStartHour(), t.getStartMinute() == null ? 0 : t.getStartMinute());
            // 이미 지난 시각이면 스킵 (오늘 9시인데 오늘 8시 시작은 건너뜀)
            if (startAt.isBefore(LocalDateTime.now())) continue;
            LocalDateTime endAt = startAt.plusHours(hours).plusMinutes(extraMinutes);
            // 같은 매장·시작·종료 가 정확히 일치하는 시프트가 이미 있으면 건너뜀 (CANCELED 제외)
            var existing = shiftRepository.findOverlapping(t.getCafe().getId(), startAt, endAt).stream()
                    .filter(s -> s.getStartAt().equals(startAt) && s.getEndAt().equals(endAt))
                    .findAny();
            if (existing.isPresent()) continue;
            Shift shift = Shift.builder()
                    .cafe(t.getCafe())
                    .startAt(startAt)
                    .endAt(endAt)
                    .hourlyWage(t.getHourlyWage())
                    .headcount(t.getHeadcount())
                    .description(t.getDescription())
                    .jobRole(t.getJobRole())
                    .minSkill(t.getMinSkill())
                    .requirements(new HashSet<>(t.getRequirements()))
                    .build();
            shiftRepository.save(shift);
            created++;
        }
        if (created > 0) {
            log.info("ShiftTemplate#{} ({}) generated {} shifts", t.getId(), t.getName(), created);
        }
        return created;
    }
}
