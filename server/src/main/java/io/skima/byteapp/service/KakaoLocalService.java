package io.skima.byteapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.dto.KakaoPlace;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/**
 * 카카오 Local API — 키워드 검색 (매장 등록·주소 자동완성).
 * 무료 30만 호출/일, 비즈앱 등록 불요. REST API 키만 있으면 동작.
 */
@Service
@Slf4j
public class KakaoLocalService {

    @Value("${kakao.rest-api-key:}")
    private String restApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 키워드로 장소 검색. lat/lng 주면 해당 좌표 기준 거리순 정렬·반경 내 우선.
     * size 기본 15, 최대 15.
     */
    public List<KakaoPlace> searchKeyword(String query, Double lat, Double lng, int size) {
        if (restApiKey == null || restApiKey.isBlank()) {
            throw BusinessException.badRequest("카카오 REST API 키가 설정되지 않았습니다");
        }
        if (query == null || query.isBlank()) {
            return List.of();
        }
        int safeSize = Math.max(1, Math.min(size, 15));

        UriComponentsBuilder b = UriComponentsBuilder
                .fromHttpUrl("https://dapi.kakao.com/v2/local/search/keyword.json")
                .queryParam("query", query)
                .queryParam("size", safeSize);
        if (lat != null && lng != null) {
            b.queryParam("y", lat).queryParam("x", lng).queryParam("sort", "distance");
        }
        URI uri = b.build().encode().toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "KakaoAK " + restApiKey);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode docs = root.get("documents");
            List<KakaoPlace> out = new ArrayList<>();
            if (docs != null && docs.isArray()) {
                for (JsonNode d : docs) {
                    out.add(parseDocument(d));
                }
            }
            return out;
        } catch (HttpClientErrorException e) {
            log.error("[KAKAO_LOCAL] keyword search 실패 status={} body={}",
                    e.getStatusCode(), e.getResponseBodyAsString());
            throw BusinessException.badRequest("카카오 장소 검색 실패: " + e.getStatusCode());
        } catch (Exception e) {
            log.error("[KAKAO_LOCAL] keyword search 예외: {}", e.getMessage());
            throw BusinessException.badRequest("카카오 장소 검색 실패");
        }
    }

    private KakaoPlace parseDocument(JsonNode d) {
        return new KakaoPlace(
                text(d, "place_name"),
                text(d, "address_name"),
                text(d, "road_address_name"),
                text(d, "phone"),
                doubleOf(d, "y"),
                doubleOf(d, "x"),
                text(d, "category_name"),
                text(d, "place_url"),
                doubleOf(d, "distance")
        );
    }

    private static String text(JsonNode n, String f) {
        JsonNode v = n.get(f);
        return (v == null || v.isNull()) ? null : v.asText();
    }

    private static Double doubleOf(JsonNode n, String f) {
        JsonNode v = n.get(f);
        if (v == null || v.isNull()) return null;
        try { return Double.parseDouble(v.asText()); } catch (Exception e) { return null; }
    }
}
