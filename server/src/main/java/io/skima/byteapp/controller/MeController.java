package io.skima.byteapp.controller;

import io.skima.byteapp.dto.WorkerProfileUpdateRequest;
import io.skima.byteapp.repository.UserRepository;
import io.skima.byteapp.security.AuthUser;
import io.skima.byteapp.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final UserRepository userRepository;
    private final S3Service s3Service;

    @GetMapping
    public Map<String, Object> me(@AuthenticationPrincipal AuthUser principal) {
        var u = principal.getDomainUser();
        // 워커는 자기신고 능력도 함께 노출 (프로필 화면 + 매칭 매트릭스용)
        Map<String, Object> body = new HashMap<>();
        body.put("id", u.getId());
        body.put("username", u.getUsername());
        body.put("name", u.getName());
        body.put("role", u.getRole().name());
        body.put("selfReportedLevel", u.getSelfReportedLevel() == null ? null : u.getSelfReportedLevel().name());
        body.put("capableRoles", u.getCapableRoles() == null ? java.util.Set.of()
                : u.getCapableRoles().stream().map(Enum::name).toList());
        body.put("certifications", u.getCertifications() == null ? java.util.Set.of() : u.getCertifications());
        body.put("bio", u.getBio());
        body.put("experienceYears", u.getExperienceYears());
        body.put("availableHours", u.getAvailableHours());
        body.put("prefMinWage", u.getPrefMinWage());
        body.put("prefMinCafeRating", u.getPrefMinCafeRating());
        body.put("prefMaxCafeNoShowRate", u.getPrefMaxCafeNoShowRate());
        body.put("profileImage", u.getProfileImage());
        body.put("phone", u.getPhone());
        body.put("bankAccount", u.getBankAccount());
        body.put("healthCertImage", u.getHealthCertImage());
        body.put("healthCertStatus", u.getHealthCertStatus() == null ? null : u.getHealthCertStatus().name());
        body.put("healthCertUploadedAt", u.getHealthCertUploadedAt());
        body.put("healthCertVerifiedAt", u.getHealthCertVerifiedAt());
        body.put("healthCertExpiresAt", u.getHealthCertExpiresAt());
        body.put("healthCertRejectReason", u.getHealthCertRejectReason());
        return body;
    }

    /** 워커 본인의 능력 자기신고 갱신. 모든 필드 nullable — 채워진 것만 갱신. */
    @PutMapping("/worker-profile")
    @Transactional
    public Map<String, Object> updateWorkerProfile(@AuthenticationPrincipal AuthUser principal,
                                                   @RequestBody WorkerProfileUpdateRequest req) {
        var u = userRepository.findById(principal.getDomainUser().getId())
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
        u.updateWorkerProfile(req.selfReportedLevel(), req.capableRoles(), req.certifications());
        if (Boolean.TRUE.equals(req.updateBio())) {
            u.updateWorkerBio(req.bio(), req.experienceYears(), req.availableHours());
        }
        if (Boolean.TRUE.equals(req.updatePrefs())) {
            u.updateWorkerPrefs(req.prefMinWage(), req.prefMinCafeRating(), req.prefMaxCafeNoShowRate());
        }
        if (Boolean.TRUE.equals(req.updateBankAccount())) {
            u.updateBankAccount(req.bankAccount());
        }
        return me(principal);
    }

    /** 프로필 이미지 S3 업로드 — multipart file, S3 URL 을 user.profileImage 에 저장 */
    @PostMapping(value = "/profile-image", consumes = "multipart/form-data")
    @Transactional
    public Map<String, Object> uploadProfileImage(@AuthenticationPrincipal AuthUser principal,
                                                   @RequestParam("file") MultipartFile file) throws java.io.IOException {
        if (!s3Service.isEnabled()) {
            throw io.skima.byteapp.common.BusinessException.badRequest("이미지 업로드 서비스가 비활성 상태입니다 (S3 미설정)");
        }
        if (file == null || file.isEmpty()) {
            throw io.skima.byteapp.common.BusinessException.badRequest("파일이 비어있습니다");
        }
        var u = userRepository.findById(principal.getDomainUser().getId())
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
        // 기존 이미지 삭제 (S3 비용 절감)
        String old = u.getProfileImage();
        String url = s3Service.upload(file, "users/profile");
        u.setProfileImage(url);
        s3Service.delete(old);
        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        r.put("imageUrl", url);
        return r;
    }

    /** 프로필 이미지 삭제 */
    @DeleteMapping("/profile-image")
    @Transactional
    public Map<String, Object> deleteProfileImage(@AuthenticationPrincipal AuthUser principal) {
        var u = userRepository.findById(principal.getDomainUser().getId())
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
        String old = u.getProfileImage();
        u.setProfileImage(null);
        s3Service.delete(old);
        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        return r;
    }

    /** 보건증 이미지 업로드 — 워커 전용. 업로드 즉시 PENDING + 1년 후 자동 EXPIRED. MVP 에선 자동 VERIFIED. */
    @PostMapping(value = "/health-cert", consumes = "multipart/form-data")
    @Transactional
    public Map<String, Object> uploadHealthCert(@AuthenticationPrincipal AuthUser principal,
                                                 @RequestParam("file") MultipartFile file) throws java.io.IOException {
        if (!s3Service.isEnabled()) {
            throw io.skima.byteapp.common.BusinessException.badRequest("이미지 업로드 서비스가 비활성 상태입니다 (S3 미설정)");
        }
        if (file == null || file.isEmpty()) {
            throw io.skima.byteapp.common.BusinessException.badRequest("파일이 비어있습니다");
        }
        var u = userRepository.findById(principal.getDomainUser().getId())
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
        if (u.getRole() != io.skima.byteapp.domain.UserRole.WORKER) {
            throw io.skima.byteapp.common.BusinessException.forbidden("워커만 보건증 업로드 가능");
        }
        String old = u.getHealthCertImage();
        String url = s3Service.upload(file, "users/health-cert");
        u.uploadHealthCert(url);
        // 운영: PENDING 유지 — admin 수동 review 후 VERIFIED 처리. 자동 VERIFY 제거.
        // capability set 에는 추가하지 않음 (PENDING 동안은 미검증 상태)
        s3Service.delete(old);
        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        r.put("imageUrl", url);
        r.put("status", u.getHealthCertStatus().name());
        r.put("expiresAt", u.getHealthCertExpiresAt());
        return r;
    }

    @DeleteMapping("/health-cert")
    @Transactional
    public Map<String, Object> deleteHealthCert(@AuthenticationPrincipal AuthUser principal) {
        var u = userRepository.findById(principal.getDomainUser().getId())
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
        String old = u.getHealthCertImage();
        u.clearHealthCert();
        var certs = new java.util.HashSet<>(u.getCertifications());
        certs.remove("HEALTH_CERT");
        u.updateWorkerProfile(null, null, certs);
        s3Service.delete(old);
        Map<String, Object> r = new HashMap<>();
        r.put("ok", true);
        return r;
    }

    /** Expo Push Token 등록 — 디바이스에서 expo-notifications 가 발급한 토큰 저장 */
    @PostMapping("/push-token")
    @Transactional
    public Map<String, Object> registerPushToken(@AuthenticationPrincipal AuthUser principal,
                                                  @RequestBody Map<String, String> body) {
        var u = userRepository.findById(principal.getDomainUser().getId())
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
        String token = body.get("token");
        u.setExpoPushToken(token == null || token.isBlank() ? null : token);
        Map<String, Object> result = new HashMap<>();
        result.put("ok", true);
        return result;
    }
}
