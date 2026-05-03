package io.skima.byteapp.controller;

import io.skima.byteapp.dto.KakaoPlace;
import io.skima.byteapp.service.KakaoLocalService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 카카오 Local API 프록시 — 키 노출 없이 클라이언트가 검색 호출.
 * 인증 사용자만 호출 가능 (Spring Security 기본 chain).
 */
@RestController
@RequestMapping("/api/kakao")
@RequiredArgsConstructor
public class KakaoLocalController {

    private final KakaoLocalService kakaoLocalService;

    @GetMapping("/places")
    public List<KakaoPlace> places(
            @RequestParam("q") String q,
            @RequestParam(value = "lat", required = false) Double lat,
            @RequestParam(value = "lng", required = false) Double lng,
            @RequestParam(value = "size", required = false, defaultValue = "10") int size
    ) {
        return kakaoLocalService.searchKeyword(q, lat, lng, size);
    }
}
