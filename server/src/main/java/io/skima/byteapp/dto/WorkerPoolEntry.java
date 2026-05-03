package io.skima.byteapp.dto;

import java.time.LocalDateTime;

/**
 * 점주의 워커 풀 — 내 매장에 일했던(또는 매칭된) 워커 1명에 대한 집계.
 * 단일 매장이 아니라 점주 전체 매장 기준 종합. 클라이언트에서 정렬/검색용.
 */
public record WorkerPoolEntry(
        Long workerId,
        String workerName,
        String profileImage,
        int totalMatches,           // 매칭 성립된 모든 시프트 수
        int completedMatches,        // 체크아웃까지 완료된 시프트 수
        int noShowCount,             // 노쇼 횟수
        Double avgRatingByOwner,     // 내가 이 워커에게 준 평균 별점
        Integer ratingsCountByOwner, // 내가 이 워커를 평가한 횟수
        Double rehireRateByOwner,    // 내가 willRehire=true 비율 (재고용 의향)
        LocalDateTime lastMatchAt,   // 가장 최근 매칭 시각
        String lastCafeName,         // 가장 최근 일한 매장명
        Long lastCafeId,
        Integer trustScore           // 글로벌 종합 신뢰도 점수 (0~100, null=신규)
) {
}
