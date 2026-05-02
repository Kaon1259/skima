package io.skima.byteapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.skima.byteapp.domain.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Expo Push Notification 발송 — 클라이언트가 expoPushToken 을 등록한 사용자에게 푸시.
 * 외부 푸시 서비스(APNs/FCM) 의존 없이 Expo Push API 1개로 처리.
 *
 * <p>호출은 @Async 로 백그라운드 처리 — DB 트랜잭션과 분리.
 *
 * <p>Expo 문서: https://docs.expo.dev/push-notifications/sending-notifications/
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PushNotificationService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Async
    public void sendToUser(User user, String title, String body, String route) {
        String token = user.getExpoPushToken();
        if (token == null || token.isBlank()) return;
        sendRaw(token, title, body, route);
    }

    @Async
    public void sendToUsers(List<User> users, String title, String body, String route) {
        for (User u : users) {
            String token = u.getExpoPushToken();
            if (token != null && !token.isBlank()) {
                sendRaw(token, title, body, route);
            }
        }
    }

    private void sendRaw(String token, String title, String body, String route) {
        try {
            Map<String, Object> data = new HashMap<>();
            if (route != null) data.put("route", route);

            Map<String, Object> payload = new HashMap<>();
            payload.put("to", token);
            payload.put("title", title);
            payload.put("body", body);
            payload.put("sound", "default");
            payload.put("priority", "high");
            payload.put("data", data);

            String json = objectMapper.writeValueAsString(payload);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(EXPO_PUSH_URL))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Accept-Encoding", "gzip, deflate")
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                log.warn("[PUSH] status={} body={}", res.statusCode(), res.body());
            } else {
                log.debug("[PUSH] ok title={} token={}", title, token.substring(0, Math.min(20, token.length())));
            }
        } catch (Exception e) {
            log.warn("[PUSH] 발송 실패 token={} title={} err={}",
                    token == null ? "null" : token.substring(0, Math.min(10, token.length())),
                    title, e.getMessage());
        }
    }
}
