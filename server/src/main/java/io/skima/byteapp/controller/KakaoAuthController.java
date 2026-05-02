package io.skima.byteapp.controller;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.repository.UserRepository;
import io.skima.byteapp.service.KakaoAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 카카오 OAuth 로그인 (워커 전용).
 * 흐름: 프론트가 ?code 받아서 POST → 토큰 교환 → 사용자 조회 → User upsert
 * → 일회성 random 비밀번호 발급(매 로그인 회전) → basicHeader 반환.
 * 클라이언트는 받은 basicHeader 를 저장해 이후 모든 API 호출에 사용.
 */
@RestController
@RequestMapping("/api/auth/kakao")
@RequiredArgsConstructor
@Slf4j
public class KakaoAuthController {

    private final KakaoAuthService kakaoAuthService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    @Transactional
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (code == null || code.isBlank()) {
            throw BusinessException.badRequest("인가 코드가 필요합니다");
        }
        String redirectUri = body.get("redirectUri");

        String accessToken = kakaoAuthService.getAccessToken(code, redirectUri);
        Map<String, Object> kakaoUser = kakaoAuthService.getUserInfo(accessToken);

        String kakaoId = (String) kakaoUser.get("kakaoId");
        String nickname = (String) kakaoUser.getOrDefault("nickname", "워커");
        String profileImage = (String) kakaoUser.getOrDefault("profileImage", null);

        // 회전 비밀번호 — 매 카카오 로그인마다 새로 발급
        String rawPassword = UUID.randomUUID().toString().replace("-", "");
        String hashed = passwordEncoder.encode(rawPassword);

        User user = userRepository.findByKakaoId(kakaoId).orElse(null);
        if (user == null) {
            // 신규 — username 은 kakao_<id> 로 고정 (충돌 방지)
            String username = "kakao_" + kakaoId;
            user = userRepository.save(User.builder()
                    .username(username)
                    .password(hashed)
                    .name(nickname)
                    .role(UserRole.WORKER)
                    .kakaoId(kakaoId)
                    .profileImage(profileImage)
                    .build());
            log.info("[KAKAO] 신규 워커 가입 username={} name={}", username, nickname);
        } else {
            user.updateKakaoCredentials(hashed, profileImage);
            log.info("[KAKAO] 기존 워커 재로그인 username={} name={}", user.getUsername(), user.getName());
        }

        String basic = "Basic " + Base64.getEncoder().encodeToString(
                (user.getUsername() + ":" + rawPassword).getBytes(StandardCharsets.UTF_8));

        Map<String, Object> userResp = new HashMap<>();
        userResp.put("id", user.getId());
        userResp.put("username", user.getUsername());
        userResp.put("name", user.getName());
        userResp.put("role", user.getRole().name());
        userResp.put("profileImage", user.getProfileImage());

        Map<String, Object> result = new HashMap<>();
        result.put("basicHeader", basic);
        result.put("user", userResp);
        return result;
    }
}
