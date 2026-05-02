package io.skima.byteapp.service;

import io.skima.byteapp.domain.CafeType;
import io.skima.byteapp.dto.BrandResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class BrandCatalog {

    /** 한국 주요 카페·베이커리 프렌차이즈. 로고는 저작권 이슈로 letter+color 대체. */
    private static final List<BrandResponse> ALL = List.of(
            // 카페 프렌차이즈
            new BrandResponse("mega",       "메가MGC커피",      CafeType.FRANCHISE_CAFE, "메가",  "#FFD400", "저가 1위, 3,400+ 매장"),
            new BrandResponse("compose",    "컴포즈커피",        CafeType.FRANCHISE_CAFE, "컴포즈", "#FF5A1F", "졸리비 인수, 2,600+ 매장"),
            new BrandResponse("paiks",      "빽다방",           CafeType.FRANCHISE_CAFE, "빽",    "#FFE600", "더본코리아, 1,500+ 매장"),
            new BrandResponse("theventi",   "더벤티",           CafeType.FRANCHISE_CAFE, "벤티",  "#1A1A1A", "대용량 저가, 빠른 확장"),
            new BrandResponse("mammoth",    "매머드커피",        CafeType.FRANCHISE_CAFE, "매머",  "#3A2A1A", "지하철역 강세"),
            new BrandResponse("ediya",      "이디야커피",        CafeType.FRANCHISE_CAFE, "이디",  "#0072B5", "동네 거점, 점포 수 2위"),
            new BrandResponse("twosome",    "투썸플레이스",      CafeType.FRANCHISE_CAFE, "투썸",  "#7A1F2B", "디저트 강점"),
            new BrandResponse("starbucks",  "스타벅스",          CafeType.FRANCHISE_CAFE, "스벅",  "#006241", "프리미엄 1위"),
            new BrandResponse("hollys",     "할리스커피",        CafeType.FRANCHISE_CAFE, "할리",  "#C8102E", "스터디카페 친화"),
            new BrandResponse("paulbassett","폴바셋",           CafeType.FRANCHISE_CAFE, "폴바",  "#222222", "스페셜티 커피"),
            new BrandResponse("pascucci",   "파스쿠찌",          CafeType.FRANCHISE_CAFE, "파스",  "#C8102E", "이태리 커피"),
            new BrandResponse("coffeebean", "커피빈",           CafeType.FRANCHISE_CAFE, "빈",    "#5C3A21", "프리미엄 비교 강자"),
            new BrandResponse("angelinus",  "엔젤리너스",        CafeType.FRANCHISE_CAFE, "엔젤",  "#C8A94B", "롯데 계열"),
            new BrandResponse("liter",      "더리터",           CafeType.FRANCHISE_CAFE, "리터",  "#7A4A2A", "대용량 저가"),
            new BrandResponse("paikboy",    "빽보이커피",        CafeType.FRANCHISE_CAFE, "빽보",  "#FFD400", "더본코리아 신생"),
            new BrandResponse("bbang",      "빵빵카페",          CafeType.FRANCHISE_CAFE, "빵빵",  "#E97451", "베이커리 결합 카페"),

            // 베이커리 프렌차이즈
            new BrandResponse("parisbaguette","파리바게뜨",      CafeType.FRANCHISE_BAKERY, "파바",  "#003DA5", "SPC, 3,400+ 매장"),
            new BrandResponse("touslesjours","뚜레쥬르",         CafeType.FRANCHISE_BAKERY, "뚜레",  "#7AB800", "CJ푸드빌, 1,300+"),
            new BrandResponse("artisee",    "아띠제",           CafeType.FRANCHISE_BAKERY, "아띠",  "#1A1A1A", "신세계, 프리미엄 베이커리"),
            new BrandResponse("dunkin",     "던킨",             CafeType.FRANCHISE_BAKERY, "던킨",  "#FF6B1A", "도넛+커피"),
            new BrandResponse("breadnco",   "브레댄코",         CafeType.FRANCHISE_BAKERY, "브레",  "#8B5A2B", "베이커리 카페 콘셉트"),
            new BrandResponse("paingdefranc","뺑드프랑스",       CafeType.FRANCHISE_BAKERY, "뺑드",  "#7A1F2B", "프랑스풍 빵집"),
            new BrandResponse("ibagel",     "아이엠베이글",      CafeType.FRANCHISE_BAKERY, "베이",  "#D4A24C", "베이글 전문")
    );

    public List<BrandResponse> findByType(CafeType type) {
        return ALL.stream().filter(b -> b.type() == type).toList();
    }

    public List<BrandResponse> all() {
        return ALL;
    }

    public Optional<BrandResponse> findByKey(String key) {
        if (key == null || key.isBlank()) return Optional.empty();
        return ALL.stream().filter(b -> b.key().equals(key)).findFirst();
    }
}
