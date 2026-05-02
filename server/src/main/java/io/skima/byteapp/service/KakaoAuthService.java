package io.skima.byteapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.skima.byteapp.common.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Kakao OAuth — saju 프로젝트의 KakaoAuthService 를 그대로 포팅.
 * 인가 코드 → 액세스 토큰 → 사용자 정보 흐름.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KakaoAuthService {

    @Value("${kakao.rest-api-key:}")
    private String restApiKey;

    @Value("${kakao.client-secret:}")
    private String clientSecret;

    @Value("${kakao.default-redirect-uri:}")
    private String defaultRedirectUri;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String getAccessToken(String code, String clientRedirectUri) {
        String tokenUrl = "https://kauth.kakao.com/oauth/token";
        String effectiveRedirectUri = (clientRedirectUri != null && !clientRedirectUri.isBlank())
                ? clientRedirectUri : defaultRedirectUri;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", restApiKey);
        params.add("redirect_uri", effectiveRedirectUri);
        params.add("code", code);
        if (clientSecret != null && !clientSecret.isBlank()) {
            params.add("client_secret", clientSecret);
        }

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(tokenUrl, request, String.class);
            JsonNode json = objectMapper.readTree(response.getBody());
            return json.get("access_token").asText();
        } catch (HttpClientErrorException e) {
            log.error("[KAKAO] 토큰 요청 실패 status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw BusinessException.badRequest("카카오 토큰 요청 실패: " + e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[KAKAO] 토큰 요청 실패: {}", e.getMessage());
            throw BusinessException.badRequest("카카오 토큰 요청 실패");
        }
    }

    public Map<String, Object> getUserInfo(String accessToken) {
        String userInfoUrl = "https://kapi.kakao.com/v2/user/me";
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    userInfoUrl, HttpMethod.GET, request, String.class);
            JsonNode json = objectMapper.readTree(response.getBody());

            Map<String, Object> userInfo = new HashMap<>();
            userInfo.put("kakaoId", json.get("id").asText());

            JsonNode kakaoAccount = json.get("kakao_account");
            if (kakaoAccount != null) {
                JsonNode profile = kakaoAccount.get("profile");
                if (profile != null) {
                    if (profile.has("nickname")) {
                        userInfo.put("nickname", profile.get("nickname").asText());
                    }
                    if (profile.has("profile_image_url")) {
                        userInfo.put("profileImage", profile.get("profile_image_url").asText());
                    }
                }
                if (kakaoAccount.has("email")) {
                    userInfo.put("email", kakaoAccount.get("email").asText());
                }
            }
            return userInfo;
        } catch (Exception e) {
            log.error("[KAKAO] 사용자 정보 조회 실패: {}", e.getMessage());
            throw BusinessException.badRequest("카카오 사용자 정보 조회 실패");
        }
    }
}
