# Skima Byte 작업 기록

작업 내용을 시간 순으로 누적 기록합니다. 각 세션 시작 시 본 파일을 확인하면 어디까지 진행됐는지 파악할 수 있습니다.

---

## 2026-05-02 — GitHub 최초 push (https://github.com/Kaon1259/skima)

### 결정사항 (사용자 확정)
- 저장소 가시성: **public**
- 카카오 시크릿 처리: `KAKAO_CLIENT_SECRET` 환경변수로만 주입, 디폴트값 제거 (A안)
- saju 프로젝트 같은 키 노출 여부 점검 요청 받음 → 별도 보고

### 진행 상황 — 완료 ✅
1. **시크릿 디폴트값 제거** — `server/src/main/resources/application.yml:52-53`
   - `kakao.rest-api-key`, `kakao.client-secret` 둘 다 디폴트값 제거 → `${KAKAO_REST_API_KEY:}` / `${KAKAO_CLIENT_SECRET:}`
   - 로컬 실행 시 환경변수로 주입 필요. 카카오 로그인 동작시키려면 셸에서 `export KAKAO_REST_API_KEY=... KAKAO_CLIENT_SECRET=...` 또는 `application-local.yml` (gitignore 처리됨) 사용
2. **.gitignore 작성** — node_modules, target, .idea, .vscode, *.log, application-local.yml, .env*, build artifacts 등
3. **client/.git embedded repo 제거** — expo init 자동 생성된 더미 git 디렉토리 삭제
4. **git init → commit → remote 등록 → push 완료**
   - 커밋: `58e05e8 Initial commit: Skima Byte MVP (server + client)`
   - 브랜치: `main`
   - remote: `https://github.com/Kaon1259/skima.git`
   - staged: 180 파일 (client 74 + server 97 + root 9)

### 보류/제안
- `client/lib/config.ts:15` 의 `KAKAO_REST_API_KEY` 는 그대로 둠 (REST API 키는 클라이언트에서 어차피 브라우저 노출되는 값이고 saju 패턴과 일치). 깔끔하게 가려면 추후 Expo `EXPO_PUBLIC_KAKAO_REST_API_KEY` 환경변수로 분리 가능.
- saju 프로젝트 점검 결과:
  - `C:\Programs\MOBILE\saju\server\src\main\resources\application.yml:28` 에 동일 시크릿 디폴트값 박혀있음
  - 그러나 saju `.gitignore` 에 `server/src/main/resources/application.yml` 명시적 제외 → GitHub에는 안 올라간 상태로 추정 (커밋 히스토리 별도 확인 필요)
  - `client/.env.development`, `.env.production` 에 REST API 키 박혀있음 — `.gitignore` 에 `client/.env` 만 있어 `.env.development`/`.env.production` 은 매칭 안 될 가능성. 별도 검증 필요.

### 파일 변경 요약
- 수정: `server/src/main/resources/application.yml` (시크릿 디폴트값 제거)
- 신규: `.gitignore`, `work.md`
- 삭제: `client/.git/` (expo init 자동 생성, embedded repo 충돌 방지 — 의미있는 히스토리 없었음)

---

## 2026-05-02 (이어서) — 점주 UX/UI 고도화 #1: 능력 시스템 B 스코프

### 목표
어제 만든 능력 시스템(JobRole / SkillLevel / requirements 자기신고)의 가시성을 점주 측까지 닫는다.
- 지원자 카드에 매칭율 표시 (워커 자기신고 vs 시프트 요구 자동 비교)
- 시프트 카드 직무/등급 뱃지를 detail / dashboard 화면에까지 확장 (현재 메인 카드만)

### 사전 분석 (현재 상태)
- `ShiftSkillBadges` 컴포넌트는 이미 워커 비교 모드 (myLevel/myRoles/myCertifications) 보유 → 재사용
- 적용된 곳: `owner/shifts.tsx` (메인 카드), `worker/shifts.tsx`. **미적용**: `owner/shift/[id].tsx` (시프트 상세 + 지원자 카드), `owner/dashboard/[status].tsx`
- 백엔드 `OwnerShiftView` 에는 jobRole/minSkill/requirements 모두 들어감 ✓
- 백엔드 `ApplicationResponse` 에는 워커 능력 정보 없음 → **필드 추가 필요** (selfReportedLevel / capableRoles / certifications)
- 클라이언트 `ShiftApplication` 타입도 동일하게 확장 필요

### 진행 계획
1. **백엔드 `ApplicationResponse`** 에 `workerLevel`, `workerRoles`, `workerCertifications` 필드 추가
2. **클라이언트 `ShiftApplication`** 타입에도 동일 필드 추가
3. **`owner/shift/[id].tsx` ShiftTimeline** — 시프트 헤더 영역에 `ShiftSkillBadges` (compact) 추가
4. **`owner/shift/[id].tsx` 지원자 카드** — "매칭 요약 한 줄" 추가 (예: "✅ 모두 충족" / "⚠️ L2 (요구 L3) · 보건증 미보유")
5. **`owner/dashboard/[status].tsx` DashboardShiftCard** — 카드 본문에 `ShiftSkillBadges` (compact) 추가

### 진행 상황 — 완료 ✅
1. ✅ **백엔드 `ApplicationResponse`** 에 `workerLevel`, `workerRoles`, `workerCertifications` 필드 추가 (`ApplicationResponse.java`). `mvnw -q compile` 성공.
2. ✅ **클라이언트 `ShiftApplication` 타입** 동일 필드 확장 (`lib/types.ts`)
3. ✅ **`owner/shift/[id].tsx` ShiftTimeline** — 시프트 헤더 직후에 `ShiftSkillBadges` (compact) 추가
4. ✅ **`owner/shift/[id].tsx` 지원자 카드** — `SkillMatchSummary` 신설 후 매칭 한 줄 요약 (✅ 충족 / ⚠️ 미달 항목 나열 / ℹ️ 미신고)
5. ✅ **`owner/dashboard/[status].tsx` DashboardShiftCard** — 카드 본문에 `ShiftSkillBadges` (compact) 추가

### 새 컴포넌트
- `client/components/SkillMatchSummary.tsx` — 시프트 요구 vs 워커 자기신고 한 줄 매칭 요약. 등급/직무 미달은 critical(빨강), 자격만 미달은 warning(노랑), 모두 충족은 success(초록), 워커 미신고는 muted(회색).

### 검증
- 백엔드 컴파일 ✅ (`./mvnw -q compile` exit 0)
- 클라이언트 `tsc --noEmit` — 내가 건드린 파일에 신규 에러 없음. 기존 잔불(`worker/shifts.tsx` 의 `WorkerProfile` 미정의, Pressable style RN 타입 이슈) 은 별건 — 작업 후보로 별도 정리 필요
- 브라우저/모바일 실제 동작 검증 — 사용자 측에서 확인 필요 (Expo 띄우고 시드된 worker1~4 의 다른 능력 vs 시드 시프트 매칭 보기). DataSeeder 가 worker1=L2 / worker2=L3 / worker3=L1 / worker4=L4 + worker1만 HEALTH_CERT 보유로 셋업되어 있어 시프트별 매칭/미달 케이스 자연 발생.

### 잔불 정리 — 완료 ✅
- `worker/shifts.tsx`: `WorkerProfile` → `MyProfile` 로 교체 (api `/api/me` 응답형은 MyProfile)
- `owner/statement.tsx:121`, `worker/matches.tsx:141`, `worker/payouts.tsx:61` Pressable style — `pressed && id && {...}` 패턴을 `pressed && id ? {...} : null` ternary로 변경 (number 0 falsy가 ViewStyle 자리에 들어가는 RN strict 타입 이슈 회피)
- `tsc --noEmit` 0 errors

---

## 2026-05-02 (3라운드) — UX/UI 고도화 Top 3 일괄 진행

### E. 워커 능력 매칭 마무리 — 완료 ✅
- `worker/shifts.tsx` 정렬 칩 3종: ⏰ 시작순 / ★ 별점순 / 💰 시급순
- `worker/shifts.tsx` "내 능력 매칭만" 토글 — 워커 자기신고가 있을 때만 노출
- 능력 자기신고 누락 워커 onboarding 배너 (selfReportedLevel null 또는 capableRoles 비어있을 때) → /worker/profile 진입
- empty state 분기: fitOnly 일 때 "내 능력에 맞는 시프트가 없어요 + 전체 보기" 버튼

### A. 점주 마이크로 개선 — 완료 ✅
1. **`cafes.tsx` 미니 통계** — 카드 본문에 이번달 매칭 N건 / ★ 평점 / 노쇼율 막대 (`/api/owner/dashboard/by-cafe` 호출, statsMap 으로 cafeId 매칭)
2. **`cafes.tsx` 검색 박스** — 매장명·주소·브랜드명 substring 매칭, 결과 카운트 표시
3. **`new-shift.tsx` 시급 빠른 칩** — 10k/11k/12k/13k/15k 칩 클릭 시 hourlyWage 즉시 셋
4. **`shift/[id].tsx` 채팅 unread 뱃지** — "워커 채팅" 버튼 옆 빨간 카운트 (99+ 캡)
   - 백엔드: `ShiftMatch` 에 `ownerChatSeenAt` / `workerChatSeenAt` 필드 + `markOwnerChatSeen`/`markWorkerChatSeen` 메서드
   - `ChatMessageRepository` 에 `countByMatchIdAndSenderRole`, `countByMatchIdAndSenderRoleAndCreatedAtAfter` 추가
   - `ChatService.markSeen(user, matchId)`, `ChatService.unreadCountFor(user, match)` 추가
   - `POST /api/matches/{matchId}/messages/seen` 신규 엔드포인트
   - `OwnerShiftView` 에 `chatUnreadCount` 필드 추가, OwnerController shifts enrich 에서 채움
   - `ChatSheet` 마운트 시 자동 mark-seen 호출

### C + G. 단골/재고용 핵심 — 완료 ✅
**백엔드 (도메인 신설):**
- `OwnerFavoriteWorker` (점주 → 워커 단골) — uk(owner_id, worker_id) unique
- `WorkerFavoriteCafe` (워커 → 매장 즐겨찾기) — uk(worker_id, cafe_id) unique
- `OwnerFavoriteWorkerRepository` / `WorkerFavoriteCafeRepository`
- `FavoriteService` — add/remove/list/exists, `workerIdsFavoriting(cafeId)` (단골 알림용 역색인)

**백엔드 (엔드포인트):**
- `GET/POST/DELETE /api/owner/favorites/workers[/{workerId}]`
- `GET/POST/DELETE /api/worker/favorites/cafes[/{cafeId}]`

**알림:**
- `NotificationItem.type` 에 `FAVORITE_CAFE_NEW_SHIFT` 추가
- `NotificationService.forWorker` 에 5번 섹션 추가: 즐겨찾기 매장의 OPEN 시프트 (최근 24h, 이미 지원한 건 제외) → "★ 매장명 새 시프트" success 알림
- `NotificationBell` TYPE_ICON 매핑 확장

**클라이언트 UI:**
- `worker-pool.tsx` — 카드 우측 ⭐/☆ 토글 버튼, '⭐ 단골' 정렬 옵션 (디폴트로 변경), 단골 배지 + 황금 borderLeft
- `cafe/[id].tsx` 워커 모드 — 헤더 직후 단골 등록 토글 (큰 버튼 + on/off 라벨)
- 즐겨찾기 토글은 optimistic update + 실패 시 롤백

### 검증
- 백엔드 컴파일 ✅ (`./mvnw -q compile` exit 0)
- 클라이언트 `tsc --noEmit` **0 errors**
- 시각 검증은 사용자가 Expo 띄워서 진행

---

## 2026-05-02 (4라운드) — 적극적 알림 + 자동 갱신

### 트리거
사용자가 "매칭 등록·체크인 같은 상태 변화가 화면에 자동 반영 안 됨, 새로고침해야 보임. 적극적 알림 원함" 요청.

### 결정
- **A 인앱 폴링 강화** 채택 (B SSE / C EAS 푸시는 다음 라운드)
- 폴링 주기: 알림 30s → **15s** / 워커 매칭 10s / 점주 시프트 상세 10s / 메인 시프트 15s

### 진행 — 완료 ✅
1. **글로벌 토스트 시스템** — `lib/toast.tsx` 신설
   - `ToastProvider` + `useToast` hook + `ToastHost` 컴포넌트
   - severity 4종 (info/warn/success/danger), TTL 4.5s, 페이드+슬라이드 애니메이션
   - 탭하면 라우트로 이동, × 버튼으로 즉시 닫기
   - web: position fixed 로 viewport 상단 고정, native: absolute top:56
   - `app/_layout.tsx` 최상위에 ToastProvider 마운트
2. **NotificationBell 새 알림 감지** — 이전 알림 키 set ref 보관, 새 unread 항목만 toast.push. 첫 로드는 baseline 으로 처리해 스팸 방지. 사라진 알림 키도 GC.
3. **`useFocusPolling` hook 신설** — `lib/useFocusPolling.ts` — useFocusEffect + setInterval 결합. 화면 unfocus 시 자동 stop. 모든 화면이 같은 패턴 반복 회피.
4. **핵심 5개 화면에 폴링 적용**:
   - `worker/shifts.tsx` 15s
   - `worker/matches.tsx` 10s
   - `owner/shifts.tsx` 15s
   - `owner/shift/[id].tsx` 10s
   - `owner/dashboard/[status].tsx` 15s

### 효과
- 점주가 "매칭 확정" 누르면 워커 화면이 10초 안에 매칭 상태로 자동 전환 + 워커 화면 상단에 "매장명 · 매칭 확정" 토스트
- 워커가 체크인/체크아웃하면 점주 시프트 상세가 10초 안에 갱신 + 점주 알림 인박스에 새 알림 → 토스트 동시 노출
- 채팅은 ChatSheet 자체에서 5초 폴링 (기존)
- 알림 종은 15초 폴링이라 새 알림 도착이 토스트로 들어옴 (인박스 카운트도 함께 갱신)

### 비핵심 화면 (폴링 미적용 — 그대로 둠)
`cafe/[id]`, `u/[id]`, `admin/kpi`, `worker/payouts`, `worker/stats`, `owner/cafes`, `owner/statement`, `owner/history`, `owner/worker-pool` — 통계/이력성, 자주 변하지 않음

### 검증
- `tsc --noEmit` 0 errors
- Expo hot-reload 로 즉시 적용. 사용자 시각 검증 진행

### 다음 라운드 후보
- **B. SSE (서버 push)** — 진짜 즉시 (1~3초). `react-native-sse` 또는 `react-native-event-source` 도입. 백엔드 `SseEmitter`. 1일 분량.
- **C. EAS Push** — 앱이 백그라운드여도 알림. EAS 프로젝트/키 셋업 필요. 수일.
- **포커스 시 immediate refetch** — 화면 진입 첫 폴링은 이미 즉시 호출되지만, 백그라운드→포그라운드 시 (예: 폰 잠금해제 후) 추가 즉시 호출은 아직 미구현. AppState 리스너로 추가 가능.

---

## 2026-05-02 — 배포 전략 결정

### 사용자 확정 — 빌드 타겟 분기
- **점주**: 웹 (PWA) + Native 앱 — 둘 다 제공
- **워커**: Native 앱만 (web 진입 시 "모바일 앱 다운로드" 안내로 redirect)
- 같은 RN 코드베이스에서 `Platform.OS === 'web'` + role 가드로 분기. 추가 코드베이스 없음.

### Capacitor 검토 — 도입 안 함
- 현재 Expo (RN + react-native-web) 가 이미 web/native 양쪽을 처리 중
- Capacitor 도입은 RN → React(DOM) 리팩터를 의미해 손해. **Expo 유지**.

### 우선순위 결정 — 앱 우선
- 사용자 확정: "우선은 앱 버전에 집중. 웹은 나중에 `expo export --platform web` 한 번이면 됨."
- 추가 리팩터 0 — web 분기 작업은 모두 보류

### 앱 우선 라운드 후보 (다음 진행)
1. **EAS 빌드 셋업** — Expo Go 졸업, internal distribution / TestFlight / Play Console 내부 테스트 트랙. Apple Developer 계정 + Google Play Console 필요 (internal 배포만이면 Apple 만)
2. **카카오 native deep-link 로그인** — 현재 web만. Expo Linking + intent-filter 셋업
3. **Expo Notifications 푸시** — 매칭/노쇼/즐겨찾기 매장 새 시프트 등 인박스 항목을 진짜 푸시로 (4라운드 폴링 위에 추가)
4. **GPS 출근 인증** (Phase 2 핵심) — Expo Location, 매장 반경 100m 게이트
5. **모바일 한정 UI** — `worker/matches` 채팅 unread, 빈 상태 CTA, 월별 수입 차트

**임팩트 순:** EAS 셋업 → 카카오 native → 푸시 → GPS 출근

---

---

## 2026-05-02 (5라운드) — W1 + W7 가벼운 워커 UX

### 사용자 결정
- EAS 빌드 셋업은 **제외**
- **W1 워커 홈/대시보드** + **W7 워커 마이크로 (채팅 unread + 빈 상태 CTA)** 부터 시작
- 나머지 후보는 아래 작업 목록 (TODO) 섹션 그대로 유지

### 진행 계획
**W7 (먼저, 1~2시간):**
1. 백엔드 `MatchResponse` 에 `chatUnreadCount` 필드 추가
2. `WorkerController.myMatches` enrich 시 채움 (점주 측 OwnerShiftView 와 동일 패턴, 워커 입장에서 OWNER 가 보낸 메시지 unread)
3. 클라 `ShiftMatch` 타입에 `chatUnreadCount` 추가
4. `worker/matches.tsx` 채팅 버튼 옆 unread 뱃지
5. `worker/shifts.tsx` 빈 상태 — 능력 미신고/즐겨찾기 매장 없음 등 상황별 CTA 강화

**W1 (다음, 반나절):**
1. `app/worker/home.tsx` 신규 라우트 추가 (워커 첫 진입 화면)
2. `worker/_layout.tsx` 탭 순서 재구성 — 홈 → 시프트 → 매칭 → 정산 → 통계
3. 위젯 4개:
   - 오늘 매칭 (오늘 시작 또는 근무중)
   - 다음 매칭 (가장 가까운 미래 MATCHED)
   - 이번주 받을 돈 (이번주 PAYOUT REQUESTED+SCHEDULED+COMPLETED 합)
   - 누적 평점 + 단골 매장 N개
4. 빈 상태 — "★ 즐겨찾기 매장 새 시프트 N건" 가로 스크롤 (G 후속 일부)

### 진행 상황 — 완료 ✅
**W7 (채팅 unread + 빈 상태 CTA):**
- 백엔드 `MatchResponse` 에 `chatUnreadCount` 필드 추가, `WorkerController.myMatches` enrich 시 채움
- 클라 `ShiftMatch` 타입 확장
- `worker/matches.tsx` "점주와 채팅" 버튼 옆 unread 뱃지 (99+ cap)
- `worker/shifts.tsx` 빈 상태 — 능력 미신고 + 단골 매장 안내 CTA 카드 추가, 시각적 구조 강화

**W1 (워커 홈/대시보드):**
- `app/worker/home.tsx` 신규 라우트 — 위젯 4개 + 빠른 진입 + 즐겨찾기 매장 새 시프트 가로 스크롤
- `worker/_layout.tsx` 첫 탭으로 "🏠 홈" 추가
- `Icon.tsx` home 매핑 추가
- 로그인 후 워커 redirect 3곳 (`index.tsx`, `login.tsx`, `auth/kakao/callback.tsx`) 모두 `/worker/home` 으로 변경

**위젯 구성:**
1. 오늘의 매칭 (오늘 시작 또는 CHECKED_IN) — primary 색 큰 카드, 탭하면 해당 매칭 진입
2. 다음 매칭 (가장 가까운 미래 MATCHED) — 일정·시급 표시
3. 이번주 받을 돈 (월~일 기준 payouts.netAmount 합)
4. 평점 · 단골 (avgRating + 단골 매장 N곳)
5. ⭐ 단골 매장 새 시프트 가로 스크롤 (FAVORITE_CAFE_NEW_SHIFT 알림에서 도출)
6. 빠른 진입 3개 (시프트 / 매칭 / 정산)
7. 능력 미신고 시 상단 배너 (⚙️ 자기신고 안내)

**검증:**
- 백엔드 `mvnw compile` ✅ (재시작 필요 — chatUnreadCount 응답)
- 클라 `tsc --noEmit` 0 errors

---

## 2026-05-02 (6라운드) — 점주 가벼운 묶음 (A6 + A2 + A5)

### 사용자 결정
- 일괄 진행. 질문 없이 완료 후 서버 재시작.

### 진행 계획
**A6 메인 대시보드 위젯 재배치 + ⭐ 매장 pin** (3시간)
- `owner/shifts.tsx` 상단에 "오늘 시프트" / "SLA 임박" 위젯 카드 추가 (W1 워커 홈과 대칭)
- 매장별 카드 가로 스크롤 — ⭐ pin 한 매장 상단 우선
- ⭐ pin 은 점주 본인 디바이스 로컬 저장 (AsyncStorage). 백엔드 도메인 신설은 다음 라운드.

**A2 시프트 등록 워크플로** (3~4시간)
- 시급 검증 — 2026 최저시급 10,030원 미만 시 경고 배너 (등록 가능, 단 경고)
- 중복 시프트 검증 — 같은 매장·시간 겹치는 시프트 등록 시 경고
- 등록 후 토스트 — "단골 워커 N명이 알림을 받게 됩니다"
- 백엔드: `GET /api/owner/cafes/{cafeId}/favoriting-count` 신규 엔드포인트 (FavoriteService 재사용)

**A5 노쇼 후속 가이드** (2시간)
- 현재는 `notify(msg)` 만 띄우고 끝 — 이를 결과 모달로 강화
- 성공: 백업 워커 정보(이름/평점) 카드
- 실패 (재모집): 재모집 안내 + "단골 알림" 빠른 액션
- 무한 빈 상태: 백업 후보가 없을 때

### 진행 상황 — 완료 ✅

**A6 — 메인 대시보드 위젯 + 매장 정렬**
- `owner/shifts.tsx` `TodayWidgets` 추가 — "오늘 · 근무중" / "⏱️ SLA 임박" 가로 2-카드. 위젯이 0건이면 자체 숨김 (시각적 노이즈 회피)
- 매장별 가로 스크롤 정렬 — 이번달 매칭 많은 순으로 (점주가 자주 쓰는 매장 자연 우선)
- ⭐ pin 은 보류 — AsyncStorage 미설치 + 백엔드 도메인 필요. work.md TODO 에 잔존

**A2 — 시프트 등록 워크플로 강화**
- 백엔드: `GET /api/owner/cafes/{cafeId}/favoriting-count` 신규 — 단골 워커 수 반환
- `new-shift.tsx` 시급 입력 영역 실시간 경고 (10,030원 미만 시 노란 배너)
- 등록 시 confirm 단계 — 최저시급 미만이면 한 번 더 확인
- 등록 성공 후 단골 워커 N명 안내 토스트 (6초)

**A5 — 노쇼 후속 가이드 강화**
- 백엔드 `NoShowService.ManualNoShowOutcome` 확장 — `backupWorkerName`, `backupMatchId`, `favoritingWorkerCount` 추가
- `tryBackupMatchWithResult` 신설 — 백업 매칭 시 워커 이름·matchId 추출
- `WorkerFavoriteCafeRepository` 주입 — 재모집 시 단골 워커 수 같이 응답
- `owner/shift/[id].tsx` reportNoShow 결과를 토스트 3종 분기:
  - 백업 성공: ✅ "백업 워커 자동 매칭 — {워커명}"
  - 재모집: 🔄 "시프트 재모집 시작 — 단골 N명이 알림을 받습니다"
  - 일반 노쇼: "노쇼 등록 완료 — ★1 평가 자동 등록"

### 검증
- 백엔드 `mvnw compile` ✅
- 클라 `tsc --noEmit` 0 errors

### 보류 / 다음 라운드
- A6 ⭐ 매장 pin (AsyncStorage 또는 백엔드 OwnerPinnedCafe 도메인)
- A2 중복 시프트 검증 (백엔드: 같은 매장·시간 겹침 검증 endpoint)
- A5 결과 모달 (지금은 토스트만 — 자세한 후속 액션이 필요하면 모달로)

---

## 2026-05-02 (7라운드) — 인프라 3종: 카카오 native + 푸시 + GPS

### 사용자 결정
- 카카오 native deep-link / Expo Notifications 푸시 / GPS 출근 인증 한 세션에서 일괄
- 질문 없이 끝까지

### 진행 계획
**1. 카카오 native deep-link 로그인** (3~6h)
- `app.json` scheme 변경 (`client` → `skima`)
- `expo-web-browser` `openAuthSessionAsync` 로 OAuth 흐름
- 클라 native 분기 — Platform.OS !== 'web' 일 때 deep-link 흐름
- 카카오 콘솔 redirect URI 추가 등록 (사용자 액션 필요)

**2. Expo Notifications 푸시** (4~8h)
- `expo-notifications` 설치
- 권한 요청 + Expo push token 발급
- 백엔드: User 엔티티에 `expoPushToken` 필드 추가
- `POST /api/me/push-token` 엔드포인트
- `PushNotificationService` 신설 — Expo Push API 호출 (HTTP)
- 핵심 이벤트에 push 트리거: 매칭 확정 / 노쇼 / 즐겨찾기 매장 새 시프트 / 정산 완료 / 새 지원자 (점주)

**3. GPS 출근 인증** (3~5h)
- `expo-location` 설치
- Cafe 도메인에 `latitude`, `longitude` 필드 추가
- 매장 등록 시 좌표 입력 UI (수동 입력 또는 expo-location 의 `geocodeAsync` 사용)
- 워커 체크인 시 현재 GPS 위치 + 매장 좌표 거리 계산 (Haversine)
- 반경 100m 게이트 — 초과 시 차단 (점주 강제 승인 옵션은 Phase 2)

### 외부 의존 (사용자 액션)
- 카카오 콘솔 redirect URI 추가 등록: `skima://auth/kakao/callback`
- 카카오 콘솔 Android 키 해시 / iOS bundle id 등록 (EAS 빌드 시)
- 푸시는 Expo Go 환경에서도 development 토큰으로 동작. EAS 빌드 시 EAS Project ID 필요.

### 진행 상황 — 완료 ✅

**1. 카카오 native deep-link 로그인**
- `app.json` scheme `client` → `skima`, bundleId `io.skima.byte` 등록
- iOS `LSApplicationQueriesSchemes` (kakao 스킴 4종)
- `lib/config.ts` — KAKAO_REDIRECT_URI native 시 `skima://auth/kakao/callback`
- `login.tsx` — `expo-web-browser.openAuthSessionAsync` 로 native OAuth 흐름
- 콜백 URL 에서 code 파싱 후 `loginWithKakao` 호출

**2. Expo Notifications 푸시**
- 패키지 설치: expo-notifications, expo-location, expo-device
- 백엔드 `User.expoPushToken` + `setExpoPushToken`
- `POST /api/me/push-token` 신규
- `PushNotificationService` 신설 — Expo Push API 직접 HTTP 호출 (외부 라이브러리 X), `@Async` 백그라운드 처리
- `@EnableAsync` 활성화
- 푸시 트리거: 매칭 확정 (워커), 새 지원자 (점주), 즐겨찾기 매장 새 시프트 (단골 워커들)
- 클라 `lib/push.ts` — setupPushHandler / usePushRegistration / usePushTapNavigation
- `_layout.tsx` PushBridge 컴포넌트로 auth 변경 시 토큰 등록
- 푸시 탭 시 `data.route` 로 자동 네비게이션

**3. GPS 출근 인증**
- 백엔드 `Cafe.latitude`, `longitude` + `updateLocation`
- `CheckInOutService.checkIn` 오버로드 — 워커 GPS 좌표 받으면 매장 반경 100m 게이트 (Haversine), 매장 좌표 미입력 시 게이트 스킵
- `WorkerController` /check-in body 로 lat/lon 받음
- `CafeCreateRequest`/`CafeResponse` 좌표 필드 추가
- 클라 `lib/geolocation.ts` — Web (navigator.geolocation) + Native (expo-location) 통합 hook
- `worker/matches.tsx` checkIn 시 좌표 자동 첨부 (실패 시 좌표 없이 진행)
- `owner/cafes.tsx` 매장 등록/편집 모달에 좌표 영역 — "📍 현재 위치로 채우기" 버튼 + 좌표 표시 + ✕ 제거

### 외부 의존 (사용자 액션 필요)
1. **카카오 콘솔에 native redirect URI 추가 등록**: `skima://auth/kakao/callback`
   - https://developers.kakao.com → 본인 앱 → 카카오 로그인 → Redirect URI
2. **EAS 빌드 시** Apple Developer / Google Play Console 계정 필요. Expo Go 환경에서는 푸시 development 토큰으로 동작 (테스트 가능).
3. **GPS 권한** 첫 호출 시 OS 권한 다이얼로그 — 사용자 허용 필요
4. **시드 매장은 좌표 null** — 점주가 직접 등록한 매장만 GPS 게이트 발동. 시드 매장은 어디서나 체크인 가능.

### 검증
- 백엔드 `mvnw compile` ✅
- 클라 `tsc --noEmit` 0 errors

---

## 📋 워커/점주 UX/UI 작업 목록 (TODO — 2026-05-02 기준)

### 👔 점주 측 — 추가 후보

**A1. 매출/세무 화면 강화** (B 묶음, 반나절~1일)
- statement 워커별/매장별 집계 토글
- 매출 추세 미니 차트 (3개월)
- Native PDF 출력 (expo-print)

**A2. 시프트 등록 워크플로 강화** (3~4시간)
- 시프트 등록 후 결과 페이지 — "단골 워커 N명에게 알림 발송됨" 안내
- 시급 검증 — 최저시급(2026: 10,030원) 미만 시 경고
- 같은 매장·같은 시각 중복 시프트 경고
- "단골에게만 우선 노출" 토글 (단골만 N분 우선, 그 후 공개)

**A3. 시프트 템플릿 + 자동 반복 등록** (1일, C 후속)
- 매주 X요일 자동 등록 (cron job)
- 템플릿 저장/불러오기 — 자주 쓰는 시프트 패턴 1탭 등록

**A4. 단골 워커 그룹별 분류** (반나절)
- VIP / 일반 단골 / 신규 워커 — 색상 구분
- 그룹별 일괄 메시지 발송 (인박스 알림)

**A5. 점주 노쇼 후속 가이드** (2시간)
- 노쇼 등록 후 백업 매칭 성공/실패 결과 친절한 안내 화면
- 백업 매칭 실패 시 "재모집 / 시프트 취소" 빠른 액션

**A6. 점주 메인 대시보드 위젯 재배치** (3시간)
- "오늘 시프트" / "1시간 SLA 임박" / "근무중" 강조 카드
- 매장별 ⭐ pin 기능 (자주 보는 매장 상단 고정)

**A7. 매장 프로필 강화** (D, 2~3일, 스토리지 의존)
- 손님 유형 / POS 종류 / 식사·휴게 / **매장 사진**
- *Railway/S3 셋업 후 권장*

### 👤 워커 측 — 추가 후보

**W1. 워커 홈/대시보드 신설** (반나절~1일)
- 첫 화면을 "오늘 매칭 / 다음 매칭 / 이번주 받을 돈 / 누적 평점" 위젯으로 재구성
- 빈 상태 — "★ 즐겨찾기 매장 새 시프트 N건"

**W2. 시프트 알림 필터 설정** (1일)
- "내 등급에 맞는 시프트만 푸시" 토글
- "시급 12k 이상만"
- "5km 이내만" (위치 기반 필요 — H 묶음 의존)

**W3. 워커 실적 대시보드** (반나절)
- 월별 수입 미니 차트 (3개월) — F 묶음
- 누적 근무 시간 / 평균 평점 / 단골 매장 수
- "내 등급 vs 평균" 비교 (motivation)

**W4. 계약서/영수증 모음 화면** (3시간)
- `worker/documents.tsx` — 본인 모든 계약서·원천징수영수증 한 화면
- 월별 그룹화 + 검색

**W5. 워커 프로필 사진 업로드** (반나절, 스토리지 의존)
- 점주 측 지원자 카드에 사진 노출 → 신뢰도 ↑

**W6. 워커 G 후속 — 즐겨찾기 매장** (3시간)
- `worker/shifts.tsx` 상단 가로 스크롤 "★ 즐겨찾기 매장 새 시프트"
- WorkerShift DTO 에 isFavoriteCafe 필드 노출 → 카드 황금 borderLeft

**W7. 워커 마이크로 개선** (F, 2~3시간)
- `worker/matches` 채팅 unread 뱃지 (점주와 같은 패턴)
- `worker/shifts` 빈 상태 CTA ("새 시프트 알림 받기" → 푸시 토글)

### 🔐 신뢰·부정방지 (4축 - 축 2)

**S1. GPS 출근 인증** (Phase 2.1, 2~3일) — 매장 반경 100m 안에서만 체크인
**S2. 출퇴근 셀카 인증** (선택, 1일)
**S3. 분쟁 이의제기 흐름** (2~3일) — 24h 내 신고 + GPS·채팅·평점 자동판정 보조
**S4. 워커 등급제** (1일) — Verified Barista (시프트 N회 + 평점 4.5↑ + 노쇼 0)
**S5. 점주 등급제** (반나절) — 입금 신뢰도·재고용률 뱃지

### 📈 성장·UX 마감 (4축 - 축 4)

**X1. 온보딩 튜토리얼** (1일) — 첫 진입 시 3-step (가능시간대/동네 → 즉시 추천)
**X2. 빈 상태 + 스켈레톤 로딩** (반나절) — 모든 데이터 로딩 화면
**X3. 에러 재시도** (3시간) — 네트워크 실패 시 토스트 + 자동 재시도
**X4. 소셜 증명** (3시간) — "어제 N건 매칭" 라이브 카운터
**X5. 추천 코드/친구 초대** (1일) — K-factor 성장
**X6. KakaoTalk 시프트 공유** (반나절)
**X7. 알바 이력서 PDF 자동 생성** (1일) — 워커 lock-in

### 🛠️ 시스템·플랫폼

**P1. SSE 서버 push** — 4라운드 폴링 → 실시간(1~3초). `react-native-sse` + Spring SseEmitter. 1일.
**P2. EAS 푸시** — 앱 백그라운드여도 알림. 위 앱 우선 라운드의 #3.
**P3. 위치/지도** (H, 4~5일) — 카페 lat/lng + 카카오맵 SDK + 거리 정렬
**P4. Toss/오픈뱅킹 실연동** — 현재 mock. PG 키 필요.
**P5. Railway 배포** (Phase A 코드 사전 + Phase B 콘솔)
**P6. 점주 web/PWA** (앱 라운드 후) — `expo export --platform web` + PWA manifest

---

## 2026-05-02 (3라운드) 보류 / 다음 라운드
- **시프트 등록 시 단골 워커에게 우선 푸시** — 푸시 인프라(EAS) 의존, 인박스 알림은 이미 매칭됨
- **"지난번 워커 우선 알림" UX** — 시프트 등록 시 "단골 워커 N명에게 알림 발송됨" 안내 배너 (UI 한 줄 추가만 남음)
- **시프트 템플릿 + 자동 반복 등록** (매주 X요일) — 별도 도메인 (ShiftTemplate) 필요. 1일 분량.
- **WorkerShift 응답에 isFavoriteCafe 표시** — 워커 시프트 리스트에서 즐겨찾기 매장 색깔 구분
- **점주 시프트 등록 폼에 "단골에게만" 토글** — 단골 이외에는 N분 후 공개

---

## 📋 남은 UX/UI 고도화 후보 (참고용 — 다음 라운드)

### 점주 측
- **B. 매출/세무 화면** — statement 워커별/매장별 토글, 매출 추세 미니 차트(3개월), Native PDF 출력(expo-print) → 반나절~1일
- **C 후속** — 시프트 템플릿 + 자동 반복 등록 (매주 X요일) → 1일
- **D. 매장 프로필 강화** — 손님 유형/POS 종류/식사·휴게/매장 사진 (사진은 스토리지 의존, Railway 셋업 후 권장) → 2~3일
- 시프트 등록 시 "단골 워커 우선 알림" UX 한 줄 + 단골만 토글 → 1~2시간

### 워커 측
- **F. 워커 화면 마이크로** — `worker/matches` 채팅 unread 뱃지(점주처럼 동일 패턴, 30분 이내), `worker/stats` 월별 수입 미니 차트(3개월), `worker/shifts` 빈 상태 CTA → 2~3시간
- **G 후속** — `worker/shifts.tsx` 상단 가로 스크롤 "★ 즐겨찾기 매장 새 시프트" 영역, WorkerShift DTO 에 isFavoriteCafe 필드 노출 → 2~3시간
- **H. 거리/지도** — 카페 lat/lng + 카카오맵 SDK + 거리 정렬 (Local API 키 필요) → 4~5일

### 신뢰·부정방지 (4축 로드맵 - 축 2)
- GPS 출근 인증 (반경 100m) → 2~3일
- 분쟁 이의제기 흐름 (24h 내 신고 → CS 보조) → 2~3일
- 워커 등급제 (Verified Barista) → 1일

### 운영 인프라
- Railway 백엔드 배포 (Phase A 코드 사전 준비 + Phase B 콘솔 작업)
- 카카오 native deep-link 로그인
- EAS 푸시 알림

---

## 2026-05-02 — Railway 배포 (제안 — 보류)
*확정 안 됨. 사용자가 능력 시스템 #1 작업으로 우선순위 변경.*

목적: 백엔드 Railway 연결 → Expo 만 띄워도 어디서든 테스트 가능 (LAN 의존 제거).

**Phase A — 코드 사전 준비** (Railway 콘솔 작업 전):
- `application-prod.yml` 신설 — datasource URL/username/password 모두 `${DB_URL}` 등 env 참조 only
- `application.yml` 의 `server.port: 8090` → `${PORT:8090}` (Railway 가 PORT env 주입)
- `application-prod.yml` 에서 `ddl-auto: validate`, `seed.refresh-on-start: false`, Flyway 도입
- `client/lib/config.ts` 에 `EXPO_PUBLIC_API_BASE_URL` env 분기 추가 (없으면 기존 LAN/localhost 폴백)
- `SecurityConfig` CORS 허용 origin 확장 (Expo Web localhost:8081, `exp://`, Railway 도메인)

**Phase B — Railway 콘솔 작업** (사용자 액션):
- 프로젝트 생성 + GitHub `Kaon1259/skima` 연결 (root: `server/`)
- MySQL 플러그인 추가 → `DATABASE_URL` 자동 주입
- 환경변수 등록: `KAKAO_*`, `SPRING_PROFILES_ACTIVE=prod`
- 카카오 콘솔에 운영 redirect URI 추가 등록

**카카오 redirect URI 우회 옵션** — 콜백 페이지는 Expo Web 이 받고 코드 교환만 Railway 로 POST 하는 현재 흐름 유지하면 redirect URI 변경 없이 백엔드 URL만 바꿔도 됨
