package io.skima.byteapp.dto;

import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.SkillLevel;

import java.util.Set;

/**
 * 워커 본인이 자기 능력/자기소개/선호 조건을 갱신할 때 사용.
 * - 능력 (level/roles/certs): null이면 변경 안 함
 * - bio (bio/exp/hours): updateBio=true일 때만 갱신 (null이 의미 있는 값 = clear 이라 토글 필요)
 * - prefs (minWage/rating/noshow): updatePrefs=true일 때만 갱신
 */
public record WorkerProfileUpdateRequest(
        SkillLevel selfReportedLevel,
        Set<JobRole> capableRoles,
        Set<String> certifications,
        String bio,
        Integer experienceYears,
        String availableHours,
        Boolean updateBio,
        // 선호 조건 (영구 필터 + 알림 채널)
        Integer prefMinWage,
        Double prefMinCafeRating,
        Double prefMaxCafeNoShowRate,
        Boolean updatePrefs
) {
}
