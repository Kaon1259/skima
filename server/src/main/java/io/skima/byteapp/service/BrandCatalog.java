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
            new BrandResponse("ibagel",     "아이엠베이글",      CafeType.FRANCHISE_BAKERY, "베이",  "#D4A24C", "베이글 전문"),

            // Phase 2 — 바 (펍·이자카야·와인바 통합)
            new BrandResponse("wabar",      "WaBar",             CafeType.FRANCHISE_BAR, "와바",  "#D4A24C", "1세대 호프 프렌차이즈"),
            new BrandResponse("100hop",     "100호프",           CafeType.FRANCHISE_BAR, "100",   "#FFD400", "저가 호프, 야간 피크"),
            new BrandResponse("hofbabe",    "호프베이브",         CafeType.FRANCHISE_BAR, "호프",  "#7A1F2B", "이태원·홍대 강세"),
            new BrandResponse("birra",      "비라",               CafeType.FRANCHISE_BAR, "비라",  "#3A2A1A", "수제맥주 프렌차이즈"),
            new BrandResponse("moru",       "모루이자카야",       CafeType.FRANCHISE_BAR, "모루",  "#1A1A1A", "이자카야 — 사케·꼬치"),
            new BrandResponse("torien",     "토리엔",             CafeType.FRANCHISE_BAR, "토리",  "#7A1F2B", "야키토리 전문 이자카야"),
            new BrandResponse("winenmore",  "와인앤모어",         CafeType.FRANCHISE_BAR, "와인",  "#5C1F3A", "와인 다이닝, 페어링"),
            new BrandResponse("vinit",      "비니트",             CafeType.FRANCHISE_BAR, "비니",  "#8B1A1A", "내추럴 와인 바"),

            // Phase 2 — 음식점 (한식·양식·중식·분식·치킨 등 통합. 세부는 브랜드명으로 식별)
            new BrandResponse("bbq",        "BBQ",               CafeType.FRANCHISE_RESTAURANT, "BBQ",   "#B71C1C", "치킨 1위 프렌차이즈"),
            new BrandResponse("kyochon",    "교촌치킨",           CafeType.FRANCHISE_RESTAURANT, "교촌",  "#C8102E", "치킨, 간장·허니"),
            new BrandResponse("bonjuk",     "본죽",               CafeType.FRANCHISE_RESTAURANT, "본죽",  "#8B5A2B", "한식 죽 전문"),
            new BrandResponse("gimbabch",   "김밥천국",           CafeType.FRANCHISE_RESTAURANT, "김밥",  "#4CAF50", "분식 종합"),
            new BrandResponse("hongkongban","홍콩반점",           CafeType.FRANCHISE_RESTAURANT, "홍콩",  "#C8102E", "중식 — 짬뽕·짜장 전문"),
            new BrandResponse("hansot",     "한솥도시락",         CafeType.FRANCHISE_RESTAURANT, "한솥",  "#E55A28", "한식 도시락 프렌차이즈"),
            new BrandResponse("sinsun",     "신선설농탕",         CafeType.FRANCHISE_RESTAURANT, "설농",  "#B71C1C", "한식 설렁탕"),
            new BrandResponse("outback",    "아웃백 스테이크하우스", CafeType.FRANCHISE_RESTAURANT, "아웃",  "#5C3A21", "양식 — 스테이크")
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
