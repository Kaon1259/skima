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

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public Cafe(User owner, String name, String address, CafeType cafeType, String brandKey,
                Double latitude, Double longitude) {
        this.owner = owner;
        this.name = name;
        this.address = address;
        this.cafeType = cafeType == null ? CafeType.INDIVIDUAL_CAFE : cafeType;
        this.brandKey = brandKey;
        this.latitude = latitude;
        this.longitude = longitude;
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
}
