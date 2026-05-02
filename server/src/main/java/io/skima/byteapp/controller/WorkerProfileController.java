package io.skima.byteapp.controller;

import io.skima.byteapp.dto.WorkerProfileResponse;
import io.skima.byteapp.service.WorkerProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 워커 프로필 — 점주가 지원자/매칭 워커 미리보기, 본인 워커가 자기 페이지 확인.
 */
@RestController
@RequestMapping("/api/workers")
@RequiredArgsConstructor
public class WorkerProfileController {

    private final WorkerProfileService workerProfileService;

    @GetMapping("/{workerId}/profile")
    public WorkerProfileResponse profile(@PathVariable Long workerId) {
        return workerProfileService.buildProfile(workerId);
    }
}
