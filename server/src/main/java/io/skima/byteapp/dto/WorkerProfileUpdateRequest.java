package io.skima.byteapp.dto;

import io.skima.byteapp.domain.JobRole;
import io.skima.byteapp.domain.SkillLevel;

import java.util.Set;

/**
 * 워커 본인이 자기 능력을 갱신할 때 사용. 모든 필드 nullable — null 이면 변경 안 함.
 */
public record WorkerProfileUpdateRequest(
        SkillLevel selfReportedLevel,
        Set<JobRole> capableRoles,
        Set<String> certifications
) {
}
