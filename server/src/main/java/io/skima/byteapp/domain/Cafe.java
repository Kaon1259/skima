package io.skima.byteapp.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "cafes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Cafe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(nullable = false, length = 256)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name = "cafe_type", nullable = false, length = 32)
    private CafeType cafeType;

    @Column(name = "brand_key", length = 64)
    private String brandKey;

    /** 매장 좌표 — GPS 체크인 게이트용. null 이면 게이트 스킵 (좌표 미입력 매장은 검증 안 함) */
    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    /** 영업시간 자유 입력 — 예: "07:00-22:00" 또는 "평일 08-21 / 주말 09-22" */
    @Column(name = "open_hours", length = 128)
    private String openHours;

    /** 좌석 수 — 매장 규모/혼잡도 가늠용 */
    @Column(name = "seat_count")
    private Integer seatCount;

    /** 매장 대표 전화 (점주가 워커에게 공개) */
    @Column(name = "phone", length = 32)
    private String phone;

    /** 사장이 직접 작성한 매장 소개 — 손님유형/POS/식사휴게/유의사항 등 */
    @Column(name = "description", length = 1024)
    private String description;

    /** 매장 대표 사진 — base64 data URL 또는 외부 URL */
    @Column(name = "image_url", columnDefinition = "MEDIUMTEXT")
    private String imageUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public Cafe(User owner, String name, String address, CafeType cafeType, String brandKey,
                Double latitude, Double longitude,
                String openHours, Integer seatCount, String phone, String description) {
        this.owner = owner;
        this.name = name;
        this.address = address;
        this.cafeType = cafeType == null ? CafeType.INDIVIDUAL_CAFE : cafeType;
        this.brandKey = brandKey;
        this.latitude = latitude;
        this.longitude = longitude;
        this.openHours = openHours;
        this.seatCount = seatCount;
        this.phone = phone;
        this.description = description;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public void update(String name, String address, CafeType cafeType, String brandKey) {
        this.name = name;
        this.address = address;
        if (cafeType != null) this.cafeType = cafeType;
        this.brandKey = brandKey;
    }

    public void updateLocation(Double latitude, Double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public void updateProfile(String openHours, Integer seatCount, String phone, String description) {
        this.openHours = openHours;
        this.seatCount = seatCount;
        this.phone = phone;
        this.description = description;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = (imageUrl != null && !imageUrl.isBlank()) ? imageUrl : null;
    }
}
