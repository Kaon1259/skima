# Skima Byte 작업 기록

작업 내용을 시간 순으로 누적 기록합니다. 각 세션 시작 시 본 파일을 확인하면 어디까지 진행됐는지 파악할 수 있습니다.

---

## 2026-05-05 (13차) — 점주 분쟁 신고 UI + 자동 판정 cron + 매장 사진 변경 UX 픽스

### 동기 (사용자 요청)
1. (C) 분쟁: 워커는 신고 가능 / 점주는 미가능 — 양측 대칭 비대칭 해소
2. (사용자 발견 — B 검증 중) 점주 매장 카드의 사진 버튼이 "추가/삭제" 토글이라 변경 동선이 없음. 사진 바꾸려면 삭제 → 재업로드 2번 필요. 즉시 삭제는 confirm 없이 위험

### 1. 분쟁 — DisputeScheduler 신설
- `DisputeScheduler.java` (scheduler 패키지)
  - 매시간 5분에 PENDING 분쟁 자동 판정 (cron `0 5 * * * *`)
  - 생성 후 60분 경과한 것만 처리 — 양측 진술/관리자 개입 여유
  - `DisputeService.autoResolve()` 재사용 (NO_SHOW_DISPUTE / LATE_CHECKIN / EARLY_CHECKOUT 휴리스틱)
- 도메인/Controller/Service/Repository는 9~K 라운드에 이미 구축된 상태였음 — 스케줄러만 누락이었음

### 2. 분쟁 — 점주 UI 통합 (`owner/shift/[id].tsx`)
- `DisputeModal` 신규 import + `disputeTarget` state
- `ShiftTimeline` 에 `onReportDispute` prop 추가 — 부모에서 setDisputeTarget 호출
- "이의 제기 (24h 내)" 버튼: matchStatus = `CHECKED_OUT` 또는 `NO_SHOW` 일 때 노출
- DisputeModal mount: role="OWNER" 로 호출 — DISPUTE_REASON_LABEL.allowedRoles 가 자동 필터 (LATE_CHECKIN / EARLY_CHECKOUT / RUDE_BEHAVIOR / OTHER)

### 3. 매장 사진 UX 픽스 (`owner/cafes.tsx`)
- 카드 인라인 버튼: 삭제 → **변경(덮어쓰기)** 으로 통합
  - 사진 없음: `📸 사진 추가`
  - 사진 있음: `🖼️ 사진 변경` (= `pickAndUploadImage` 동일 호출, 백엔드가 기존 S3 객체 자동 삭제 후 새 업로드)
- 사진 단독 제거는 → 매장 편집 모달 안에 작은 "🗑️ 매장 사진 제거" 링크 (confirm 다이얼로그 + danger 톤). 실수 방지.
- 한 번 탭으로 사진 사라지던 위험 동선 제거

### 검증
- `tsc --noEmit` exit 0
- 백엔드 재기동: DisputeScheduler bean 등록 확인
- API: 분쟁 생성/자동판정은 9~K 라운드에서 이미 동작 검증됨
- 사진 UX: 카드 라벨 변경 + 편집 모달 제거 링크 (시각적 회귀만)

### 다음 라운드 후보
- (D) 워커 시프트 카드 추천 점수 노출 — 투명성
- (E) 카카오 native 로그인
- 점주 분쟁 신고 본인 화면 (`/owner/disputes` — 신고 내역 + 판정 결과 조회)
- 알림 type 추가: `DISPUTE_RESOLVED` (자동 판정 결과 양측에 알림)

---

## 2026-05-05 (12차) — 매장 사진 워커 시프트 카드 썸네일

### 동기 (사용자 합의)
- 11차까지 기능/동선 강화 위주 — 워커 첫인상은 텍스트만이라 시각적 hook 부족
- 매장 사진 도메인은 이미 있음 (`Cafe.imageUrl` MEDIUMTEXT, S3 업로드 가능)
- 시프트 카드는 워커가 가장 먼저 보는 화면 → ROI 높음

### 변경 내용

#### 1. 백엔드 — `WorkerShiftView` DTO 에 `cafeImageUrl` 추가
- `WorkerShiftView.from()` 안에서 `s.getCafe().getImageUrl()` 자동 채움 (Controller callsite 시그너처 변경 없음)

#### 2. 백엔드 — DataSeeder 데모 사진 2개
- cafe1 (메가 강남) / cafe3 (컴포즈 홍대) — Unsplash 카페 사진 URL 시드 (240x240)
- cafe2 (메가 역삼) / cafe4 (파리바게뜨 신촌) — null (letter 폴백 검증용)
- @Transactional 안의 setImageUrl → dirty checking 으로 flush

#### 3. 클라 — `WorkerShift.cafeImageUrl` 추가 (types.ts)

#### 4. 클라 — `worker/shifts.tsx` 카드 헤더 분기
- `cafeImageUrl` 있음 → `Image` (40x40, surfaceAlt 폴백 bg)
- 없음 → 기존 brandColor + brandLetter 아바타 (변경 없음)
- `react-native` 에서 `Image` import 추가

### 검증
- `tsc --noEmit` exit 0
- API: `GET /api/worker/shifts` 응답에 `cafeImageUrl` 필드 노출
- 시각: cafe1·3 카드 = 사진 / cafe2·4 카드 = letter (A/B 비교 가능)

### 다음 라운드 후보
- (C) 점주 분쟁 신고 UI + 자동 판정 cron
- (D) 워커 시프트 카드 추천 점수 노출
- (E) 카카오 native 로그인

---

## 2026-05-05 (11차) — 매칭 확정 시 워커 알림 "근로계약서 확인 요청" (대칭 동선 완성)

### 동기 (사용자 합의)
- 10차에서 "워커 ack → 점주 알림" (`WORKER_CONTRACT_ACK`) 만 만들어 한쪽만 비대칭이었음
- 워커는 매칭 카드 자체 배너로만 ack 필요성 인지 → 알림함에서 명시적 알림으로 보강 (대칭 완성)

### 변경 내용

#### 1. 백엔드 — `NotificationService.forWorker` 새 type 추가
- `CONTRACT_ACK_REQUIRED`
- 조건: `match.status == MATCHED && workerAck == null && matchedAt > weekAgo`
- 라우트: `/contract/{matchId}?focus=ack` (워커 routing 으로 직행 → 강조 모드 자동 진입)
- 제목: "{매장명} · 근로계약서 확인 필요"
- 부제: "출근 전 필수 단계 — {시작시각} 시작"
- severity: `warn` (필수 동작)
- NEW_MATCH 와 공존 — NEW_MATCH 는 매칭 사실 알림(/worker/matches), CONTRACT_ACK_REQUIRED 는 ack 필요 알림(/contract/...)

#### 2. 클라 동기화
- `lib/types.ts NotificationItem.type` 에 `'CONTRACT_ACK_REQUIRED'` 추가
- `components/NotificationBell.tsx TYPE_ICON` 에 `'document-text'` 매핑 (점주측 `WORKER_CONTRACT_ACK` 와 동일 아이콘)

### 양측 ack 동선 완성도 (11차 후)

**워커 측 — 진입 4가지 (대칭 완성):**
- 자발적 1: `worker/matches.tsx` 매칭 카드 → "📄 근로계약서 확인 필요" 배너
- 자발적 2 (NEW): 워커 알림함 → "{매장} · 근로계약서 확인 필요" → 클릭 → 계약서 화면 강조 모드
- 강제: 출근 체크인 클릭 → ack 없으면 alert + 자동 라우팅
- 자동 토스트: 알림 도착 시 토스트 노출 (NotificationBell 기존 로직)

**점주 측 — 진입 4가지 (10차 정착):**
- 자발적 1: 메인 시프트 카드 → ack 배너
- 자발적 2: 시프트 상세 hero → ack 배너
- 자발적 3: 점주 알림함 → "{워커} 워커가 근로계약서 확인" → 클릭
- 강제: 정산 승인 + 평가 → ack 없으면 alert + 자동 라우팅

### 검증
- `tsc --noEmit` exit 0
- 백엔드 재시작 후 시나리오:
  1. owner1 매칭 확정 → worker1 알림함에 "{매장} · 근로계약서 확인 필요" 도착
  2. 클릭 → /contract/{matchId}?focus=ack → 자동 스크롤 + warn 강조 모드
  3. ack 등록 후 매칭으로 복귀 → 알림 자동 사라짐 (workerAck != null 이라 조건 미충족)

### 잔여
- AWS IAM 키 폐기 (P0 — 사용자 보류)
- 카카오 redirect URI 등록 (P1)
- 다음 라운드 후보: 매장 사진 시프트 카드 썸네일 / 점주 분쟁 신고 UI / 카카오 native 로그인

---

## 2026-05-04 (10차) — 점주 정산 강제 게이트 + 워커 ack 알림 + 계좌 등록

### 동기 (사용자 요청)
1. "워커가 근로계약서 확인하면 점주도 확인하고 동의하는 동선이 있어야"
2. "수동 정산 시 선 동의 후 정산이 되어야"
3. "워커의 계좌가 필요할 거 같긴 한데. 그건 워커의 프로필에 등록하게 되는 건가요?"

### 진단 결과
- 9차에서 **점주 정산 자동 ack** 였음 — 명시적 동의 부족 → 강제 게이트로 전환
- 워커 계좌: 백엔드(`User.bankAccount`) 컬럼 + 시드 OK + `ContractResponse` 채워줌. **클라 me 응답·요청 DTO·프로필 UI 모두 누락** → 워커가 등록할 곳 없음

### 1. 백엔드 — 정산 강제 게이트 (자동 ack 제거)
- `OwnerController.approvePayout()`:
  - 매칭 본인 매장 검증 + `match.getOwnerAcknowledgedContractAt() == null` → BusinessException
  - 메시지: "정산 승인 전 근로계약서 확인이 필요합니다. ..."
- 자동 ack 1줄 삭제
- 클라 우회 방지

### 2. 백엔드 — Payout 응답에 ack 시각 노출
- `PayoutResponse` 에 `LocalDateTime ownerContractAckAt` 필드 추가
- 정산 카드에서 정산 승인 누르기 전 클라가 검사 가능
- types.ts `Payout` 동기화

### 3. 클라 — 정산 승인 모달 ack 게이트 (3 호출처)
- `owner/shift/[id].tsx` GradientButton: ack 검사 → 없으면 alert + `/owner/contract/{matchId}?focus=ack` 라우팅. 라벨 동적 (`'정산 승인 + 평가'` ↔ `'📄 계약서 확인 후 정산'`)
- `owner/shift/[id].tsx` 알림 라우팅 useEffect: `?action=approve` 진입 시 ack 검사 → 없으면 모달 자동 오픈 대신 계약서 화면으로 라우팅
- `owner/payouts.tsx` 정산 카드 GradientButton: 동일 패턴
- 점주 메인 카드 ack 배너 문구: "정산 승인 시 자동 등록" → "정산 전 필수"

### 4. 워커 ack → 점주 알림 (대칭 동선 완성)
- `NotificationService.forOwner()` 에 새 type `WORKER_CONTRACT_ACK` 추가
- 조건: `match.workerAck != null && match.ownerAck == null && status not in (NO_SHOW, CANCELED)`
- 라우트: `/owner/contract/{matchId}?focus=ack`
- title: "{워커명} 워커가 근로계약서 확인" / subtitle: "{매장명} · 점주 확인 필요 (정산 전 필수)"
- types.ts NotificationItem.type 에 `WORKER_CONTRACT_ACK` 추가
- NotificationBell TYPE_ICON에 `document-text` 매핑

### 5. 워커 계좌 등록 — 풀스택
- **백엔드**:
  - `MeController.me()` 응답에 `phone`, `bankAccount` 필드 추가
  - `WorkerProfileUpdateRequest` 에 `bankAccount`, `updateBankAccount` 필드 추가 (다른 토글 패턴과 동일)
  - `User.updateBankAccount(String)` 메서드 추가 — 빈 문자열은 null 처리
  - `MeController.updateWorkerProfile()` 에서 `updateBankAccount=true` 시 갱신
- **클라**:
  - `lib/types.ts MyProfile` 에 `phone`, `bankAccount` 추가
  - `worker/profile.tsx`:
    - state `bankAccount` 추가, `load()` 에서 채움
    - 가능 시간대 카드 다음에 **"💰 입금 계좌"** 신규 카드 — TextInput + 안내문 ("정산 입금 + 근로계약서·원천징수영수증 표기")
    - 비어있으면 warn 텍스트 "⚠️ 계좌 미입력 — 정산 입금 불가능"
    - save() body 에 `bankAccount + updateBankAccount: true` 포함

### 양측 동선 차트 (10차 라운드 정착 후)

**워커 ack 동선:**
- 자발적: 매칭 카드 → "📄 근로계약서 확인 필요" 배너 → 계약서 화면 → "근로자 확인 등록"
- 강제: 출근 체크인 클릭 → ack 없으면 alert + 계약서 화면 자동 라우팅 + 강조 모드

**점주 ack 동선 (4가지 진입):**
- 자발적 1: 메인 시프트 카드 → 매칭 워커 박스 아래 "📄 근로계약서 확인 필요 — 정산 전 필수" 한 줄 배너 → 계약서 화면
- 자발적 2: 시프트 상세 → 매칭 워커 hero 아래 큰 배너 → 계약서 화면
- **자발적 3 (NEW)**: 점주 알림함 → 워커가 ack 했으면 "{워커} 워커가 근로계약서 확인" 알림 → 클릭 → 계약서 화면
- 강제: 정산 승인 + 평가 클릭 → ack 없으면 alert + 계약서 화면 자동 라우팅

**워커 계좌 동선:**
- 마이 탭 → 내 프로필 편집 → "💰 입금 계좌" 카드 → 등록
- 계약서 화면에 자동 표기 ("입금계좌" 필드)
- 미등록 시 프로필에 warn 경고

### 검증
- `tsc --noEmit` exit 0
- 시드: `bankAccount("토스 1234-N")` 자동 채움 → 워커 4명 모두 데모 가능
- 시나리오:
  1. 워커가 ack 등록 → 점주 알림함에 알림 도착
  2. 점주가 ack 안 한 채로 정산 승인 누름 → alert + 계약서 화면 자동 이동 → ack → 매칭으로 복귀 → 다시 정산
  3. 워커 마이 → 프로필 편집 → 계좌 비우면 warn → 입력 후 저장 → 계약서 화면에 반영

### 잔여
- AWS IAM 키 폐기 (P0)
- 카카오 redirect URI 등록
- 점주 측 매칭 확정 시 워커 알림함에 "근로계약서 확인 요청" 발송 (대칭) — 현재는 워커는 자체 매칭 카드 배너로만 인지

---

## 2026-05-04 (9차) — 체크인 강제 게이트 + 점주 정산 시 자동 ack

### 동기 (사용자 요청)
"근로계약서 확인 전에 출근 체크인 하면 어떻게 되나요?"
"출근 체크인 시 근로계약서 확인 안 한 경우 → 계약서 확인 후 가도록, 확인된 경우라면 바로 출근. 점주도 동의해야 — 동선 체크"

### 8차 라운드 한계
- B 트랙은 ack 강제 X (1탭 정신). 결과: 워커가 ack 안 해도 체크인 정상 처리됨 → 분쟁 시 ack 시각 null 이라 입증 불가
- 점주 ack 동선이 시프트 상세 안에만 있음 → 메인 카드에선 강조 없음

### 변경 — 양측 ack 강제화 + 점주 자동 ack

#### 1. 백엔드 — `CheckInOutService.checkIn()` 게이트
- 매칭 ack 검사 추가: `match.getWorkerAcknowledgedContractAt() == null` 이면 BusinessException
- 메시지: "근로계약서를 먼저 확인해주세요. 매칭 카드의 '📄 근로계약서 확인' 배너를 탭해 동의하면 체크인 가능합니다."
- 클라 우회 호출도 차단

#### 2. 백엔드 — `OwnerController.approvePayout()` 자동 ack
- 정산 승인 시 점주 ack 가 null 이면 자동으로 채움 (`match.acknowledgeContractByOwner(now())`)
- 정산 승인 = 근무·체크아웃 다 보고 임금 인정 = 점주의 묵시적 동의로 충분
- 점주는 별도 ack 안 해도 정산 승인 시점에 자동 등록 → 분쟁 방어 자료 자동 확보

#### 3. 클라 — 워커 매칭 카드 출근 체크인 게이트
- "출근 체크인" 버튼 onPress → ack 검사
  - ack 없음: alert "근로계약서를 먼저 확인해주세요. 확인 화면으로 이동합니다." → `/contract/{matchId}?focus=ack` 라우팅
  - ack 있음: 정상 체크인
- 버튼 라벨도 동적: ack 없으면 "📄 계약서 확인 후 출근" / 있으면 "출근 체크인"

#### 4. 클라 — 계약서 화면 `?focus=ack` 강조
- URL query `focus=ack` 받으면:
  - 화면 헤더 sub: "👇 출근 전 마지막 단계 — 아래에서 확인 등록해주세요"
  - AcknowledgeCard 자동 스크롤 (200ms 딜레이 후 ScrollView.scrollTo)
  - AcknowledgeCard 본인 미확인이면 강조 모드: warn 톤 (warnSoft 바탕 + warn 보더 3px) + "⏳ 출근 전 필수 단계" 라벨 + 제목 색 warn

#### 5. 클라 — 점주 메인 시프트 카드 ack 강조
- `owner/shifts.tsx` ShiftCard 매칭 워커 박스 아래 한 줄 배너 추가 (warn 톤 컴팩트)
- 노출 조건: 매칭 있음 + ownerAck 없음 + payoutStatus !== 'COMPLETED'
- 클릭 → `/owner/contract/{matchId}?focus=ack` (점주도 강조 화면 진입)
- "근로계약서 확인 필요 — 정산 승인 시 자동 등록" — 점주가 까먹어도 자동 처리됨을 명시

### 점주 ack 동선 차트 (이번 라운드 정리 후)
- **수동 진입 1**: 점주 메인 `owner/shifts.tsx` 시프트 카드 → 매칭 워커 박스 아래 "📄 근로계약서 확인 필요" 한 줄 배너 → 클릭 → 계약서 화면
- **수동 진입 2**: `owner/shift/[id]` 상세 → 매칭 워커 hero 카드 아래 "📄 근로계약서 확인 필요" 큰 배너 → 클릭 → 계약서 화면
- **수동 진입 3**: 시프트 상세 ShiftTimeline 단계 "점주 계약서 확인 대기" 시각적 노출
- **자동 등록**: 정산 승인 시 (RatingModal "정산 승인 + 평가" 버튼) → ack 자동 채움
- **수동 ack 등록 시점**: 매칭 직후 ~ 정산 승인 직전 어디서든 가능

### 워커 ack 동선 차트
- **수동 진입 1**: `worker/matches.tsx` 매칭 카드 → "📄 근로계약서 확인 필요" 큰 배너 → 클릭 → 계약서 화면
- **강제 진입**: 출근 체크인 버튼 클릭 → ack 없으면 alert + 자동 라우팅 → 계약서 화면 강조 모드 → 확인 → 매칭 화면 복귀 → 다시 출근
- TimelineDot 에 "근로계약서 확인 대기 — 점주도 확인함" sub

### 검증
- `tsc --noEmit` exit 0
- 백엔드 재기동 — 시드 reseed (모든 매칭 ack null 초기화)
- 시나리오:
  1. 워커가 매칭 카드에서 "📄 계약서 확인 후 출근" 버튼 보임 (ack 없을 때)
  2. 클릭하면 alert + 계약서 화면 자동 라우팅 + 화면 자동 스크롤 + warn 강조 모드
  3. "✍️ 근로자 확인 등록" 클릭 → ack 등록
  4. 매칭 화면 복귀 (뒤로가기) → 버튼이 "출근 체크인" 으로 변경됨 → 클릭 → 정상 체크인
- 점주 시나리오:
  1. 점주가 매칭 후 시프트 메인 카드에서 ack 배너 보임
  2. 정산 승인 누르면 ack 자동 등록됨 (별도 클릭 불필요)
  3. 또는 매칭 직후 시프트 상세 진입 → "📄 근로계약서 확인 필요" 큰 배너 → 클릭 → 사업주 확인 등록

### 잔여
- 워커가 클라 우회로 직접 API 호출하면 백엔드도 막아 안전
- AWS IAM 키 폐기 (P0 잔여)
- 카카오 redirect URI 등록

---

## 2026-05-04 (8차) — 근로계약서 양측 확인 동의 흐름 (B 트랙)

### 동기 (사용자 요청)
"매칭이 되면 자동으로 근로계약서가 생성되어야 하는 거죠. 그럼 각각 확인을 해야 할 거 같긴한데. 그런 UX/UI가 있던가요?"

### 진단 결과
- **계약서 데이터 자동 생성**은 이미 됨 (매칭 시점에 모든 항목 확정, ComplianceService.buildContractFromMatch). 단 별도 엔티티 X — 매칭 데이터로부터 동적 응답
- **양측 확인/동의 흐름은 없었음**: ack 필드/엔드포인트/타임라인 단계 모두 누락. 매칭 직후 사용자가 계약서 봤는지 입증 불가

### 트랙 B 결정 사유
- A(UI 강조만)는 분쟁 시 입증 자료 못 됨
- C(체크인 강제 게이트)는 1탭 정신과 충돌. 일찍 도착한 워커가 막힘
- B(양측 ack 필드 + UI 강조 + 강제 X)가 균형. 근기법 17조 입증 + UX 친화

### 1. 백엔드 도메인 — `ShiftMatch.java`
- 컬럼 2개 추가: `worker_ack_contract_at`, `owner_ack_contract_at` (LocalDateTime)
- 메서드 2개: `acknowledgeContractByWorker(at)` / `acknowledgeContractByOwner(at)` — 1회만 기록 (이미 있으면 무시)
- ddl-auto: create 라 reseed 시 컬럼 자동 추가

### 2. 백엔드 엔드포인트 (각 역할별 본인 매칭만)
- `POST /api/worker/matches/{matchId}/contract/ack` — 워커 본인 매칭에 ack 등록
- `POST /api/owner/matches/{matchId}/contract/ack` — 점주 본인 매장 매칭에 ack 등록
- 응답: `{ workerAcknowledgedContractAt, ownerAcknowledgedContractAt }` (양측 시각)

### 3. 응답 DTO 동기화
- `ContractResponse` 에 `ownerAcknowledgedAt`, `workerAcknowledgedAt` 추가 (`ComplianceService.buildContractFromMatch` 채워줌)
- `MatchResponse` (워커 매칭 응답) 에 `ownerContractAckAt`, `workerContractAckAt` 추가 — `from()` 헬퍼에서 직접 채움
- `OwnerShiftView` 에 동일 필드 추가 — `OwnerController.shifts()` 에서 채움
- 클라 `lib/types.ts` ContractData / OwnerShift / ShiftMatch 모두 동기화

### 4. `contract/[matchId]` 화면 — 양측 확인 UX
- 화면 하단에 **AcknowledgeCard** 컴포넌트 신규
  - 양측 모두 확인 시: `successSoft` 바탕 + "✓ 양측 확인 완료"
  - 미확인 시: `primary50` 바탕 + "📄 근로계약서 양측 확인" + 안내문(근기법 17조)
  - 양측 상태 카드 2개 (사업주 / 근로자) — 확인 시각 + ✓ 표시
  - 본인 미확인이면 `GradientButton` "✍️ 사업주/근로자 확인 등록" — 호출 후 응답 시각으로 로컬 갱신
  - 본인 확인 완료면 + 상대방 미확인이면 "{상대}의 확인을 기다리는 중"

### 5. 점주 측 — `owner/shift/[id].tsx` ShiftTimeline
- stages 배열에 단계 2개 추가: "점주 계약서 확인" / "워커 계약서 확인" (매칭 확정 다음 단계, 출근 체크인 전)
- 매칭 워커 hero 카드 아래 — 점주 미확인 시 강조 배너 ("근로계약서 확인 필요" warn 톤) → `/owner/contract/{matchId}` 진입

### 6. 워커 측 — `worker/matches.tsx`
- 매칭 카드 헤더 직후 — 워커 미확인 시 강조 배너 ("근로계약서 확인 필요" warn 톤) → `/contract/{matchId}` 진입
- TimelineDot 매칭 확정 다음에 "근로계약서 확인" 단계 추가, sub 텍스트로 점주 확인 여부 노출

### 톤 정책 (이번 라운드 신규 결정)
- ack **미확인** = warn (노랑) — 액션 유도 (5/4 (5차) 라운드에서 "warn = 경고" 정의 정합)
- 양측 모두 ack 완료 = success (녹색)
- 본인 ack 완료 + 상대 대기 = surface + success border (반쯤 진행)

### 검증
- `tsc --noEmit` exit 0
- 백엔드 재기동 (DDL 변경 반영) — 새 컬럼 2개 자동 추가
- ddl-auto: create 로 시드 매번 reseed → 모든 매칭의 ack 시각 null 로 초기화
- 폰 reload 후 시나리오:
  1. 점주 owner1 로 시드 매칭 진입 → "근로계약서 확인 필요" 배너 노출 → 클릭 → 계약서 화면 → 사업주 확인 등록
  2. 워커 worker1 로 매칭 화면 → 같은 매칭에 미확인 배너 노출 → 워커 확인 등록
  3. 양측 확인 후 timeline 4단계 (등록·매칭·점주확인·워커확인) ✓

### 잔여 (다음 라운드)
- 워커가 출근 시 ack 안 했으면 가벼운 경고만 (강제 X) — 현재는 그냥 출근 가능
- AWS IAM 키 폐기 (P0 잔여)
- 카카오 redirect URI 등록

---

## 2026-05-04 (7차+) — 시프트 등록 디폴트 startAt 변경 (중복 경고 UX)

### 사용자 보고
- 점주 김씨(owner1)로 시프트 등록 시 "같은 매장·시간 시프트가 1건 있어요" 경고가 거의 항상 뜸

### 원인
- 시프트 등록 디폴트 startAt = `다음 정시` (오늘 + 30분~1시간) + 4시간
- 시드 reseed 시 owner1 매장(메가강남역점)에 `now+2시간`부터 시프트가 깔림
- → 디폴트 값이 시드 시프트와 시간 겹침 → 경고 정상 발생
- 동작은 맞지만 사용자는 "내가 안 등록했는데 왜?" 라고 느낌 (시드 데이터는 자동 생성된 것)

### 변경 — `client/components/DateTimePicker.tsx`
- `defaultStartLocal()` 반환값을 **다음 정시 → 내일 오전 9시**로 변경
- 시드 시프트(오늘 시간대)와 안 겹침
- 실 운영 관점: 점주가 1시간 안에 매칭 가능한 워커 모집은 드문 케이스. 보통 다음 날 / 며칠 후 시프트 등록이 자연스러움

### 검증
- `tsc --noEmit` exit 0
- Metro HMR 자동 적용 — 폰 reload 후 시프트 등록 화면 디폴트값 = 내일 오전 9시

---

## 2026-05-04 (7차) — 매장 상세 지도 보강 + 점주 매칭 워커 진입

### 동기 (사용자 요청)
1. 워커가 매장 상세 진입 시 위치가 텍스트로만 — 지도 노출 보강
2. 점주 시프트에서 매칭 워커명 클릭 → 워커 상세 진입 가능해야 함

### 진단
- **지도는 이미 있음** (5/4 4차 라운드 KakaoMapThumbnail). 단 `latitude && longitude` 있을 때만 노출. 시드 매장 4개에 좌표 비어있어 데모 시 빈약. 사용자가 카카오 검색으로 새 매장 등록하는 경우만 좌표 입력됨
- 점주 OwnerShiftView DTO 에 `matchedWorkerName` 만 있고 `matchedWorkerId` 없음 — 클라이언트에서 워커 상세 진입 불가능

### 1. OwnerShiftView DTO + Controller (백엔드)
- `OwnerShiftView` record 에 `Long matchedWorkerId` 필드 추가 (matchedWorkerName 앞)
- `OwnerShiftView.from(...)` 시그니처 + 호출자(`OwnerController.shifts()`) 동기화 — `m.getWorker().getId()` 채워줌
- 클라 `lib/types.ts OwnerShift` 에 `matchedWorkerId?: number | null` 추가

### 2. 점주 매칭 워커 박스 → 워커 상세 진입
- `owner/shifts.tsx` ShiftCard 매칭 워커 박스 — `View` → `Pressable + onPress + stopPropagation`. matchedWorkerId 있을 때만 활성. 헤더에 chevron-forward 추가. 평가하기 버튼도 stopPropagation 처리
- `owner/dashboard/[status].tsx` 매칭 워커 박스 3종 (matched / in-progress / completed) 모두 같은 패턴 적용
- `owner/shift/[id].tsx` ShiftTimeline 헤더 — 매칭 워커 hero 카드 신규 추가 (`primary50` 바탕 + 아바타 + "매칭 워커" 라벨 + 이름 + "상세 ›" CTA). 시프트 상세에 들어왔을 때 워커 진입 도구 누락된 갭 보완

### 3. 시드 매장 4개 좌표 추가 (DataSeeder)
- 메가MGC커피 강남역점: (37.4979, 127.0276)
- 메가MGC커피 역삼점: (37.5006, 127.0367)
- 컴포즈커피 홍대점: (37.5547, 126.9237)
- 파리바게뜨 신촌점: (37.5573, 126.9389)
- 시드 reseed 후 매장 상세에 KakaoMapThumbnail 자동 노출 ✓ + 워커 시프트 카드 88px 미니맵도 노출

### 4. 매장 상세 좌표 없을 때 placeholder (cafe/[id])
- AboutCard `hasAny` 가드 제거 — 매장 정보 카드는 항상 노출 (위치 안내 항상 보장)
- 좌표 없는 매장에 dashed border placeholder + "🗺 위치 좌표 정보 없음 — 카카오맵에서 검색" 외부 링크 (`https://map.kakao.com/?q={매장명+주소}` 로 Linking.openURL)
- `Linking` 정적 import 추가

### 5. 점주 측 진입 일관성 (이번 라운드 정착)
- 점주 시프트 메인 카드: 카드 외 영역 = 시프트 상세 / 매칭 워커 박스 = 워커 상세 / 채팅 unread 알약 = 시프트 상세 / 평가하기 = 평가 모달
- 점주 dashboard/[status]: 카드 외 영역 = 시프트 상세 / 매칭 워커 박스 = 워커 상세
- 점주 shift/[id]: ShiftTimeline 헤더 매칭 워커 hero = 워커 상세
- 워커 시프트 카드: 매장명·주소 영역 = 매장 상세 / 1탭 지원 버튼 = 지원
- 워커 매칭 카드: 매장명 영역 = 매장 상세 / 출근·퇴근 CTA = 액션

### 검증
- `tsc --noEmit` exit 0
- Spring Boot 재기동 (DTO + 시드 reseed 필요), Metro HMR 그대로

### 잔여 (다음 라운드)
- AWS IAM 키 폐기 (P0 — 여러 라운드 잔여)
- 카카오 redirect URI 등록 + 카카오 로그인 검증
- 분쟁 신고 UI / 자동 판정 cron
- saju 디자인 추가 참조

---

## 2026-05-04 (6차) — 점주 + 공유 화면 톤 통일 (트랙 A·B·C 일괄)

### 동기
- 5차 라운드(워커 톤업)에 이어 점주 화면도 같은 오렌지 컨셉 적용. 워커↔점주 첫인상 일관성 확보
- 사용자 요청: A→B→C 트랙 순서로 일괄 진행, 질문 없이 마무리되면 서버 기동 후 알림

### 톤 정책 (5차 라운드와 동일 — 점주에도 적용)
- **primary 오렌지**: 브랜드 / 단골 / 수입(점주 입장 = 지출 합계도 brand) / CTA / 활성 필터 / 자격 칩
- **success 녹색**: 작업 완료 의미만 (완료 시프트, 워커 수령 net, SLA OK)
- **warn 노랑**: 경고만 (모집 status, 프로필 미완성, SLA 임박, 평가 대기)
- **danger 빨강**: 노쇼 / unread / 거절 / 취소
- 별점 ★, 모집 상태색 등 의미색은 모두 유지

### 트랙 A — 점주 메인 4탭

#### A1. owner/_layout
- 헤더 `colors.surface` → `colors.primary50` 와시 (워커와 동일)
- 탭바 active indicator — 아이콘 위 4×22px 오렌지 알약 (focused 만)
- 라벨 fontWeight 600→700, 높이 60→64

#### A2. owner/shifts.tsx (`shifts.tsx`)
- 첫 시프트 등록 큰 CTA `colors.primary` solid → `GradientButton size lg`
- QuickLink 3개에 `highlight` prop 추가 — 워커풀(단골)만 `primary100` 바탕 + `primary300` 보더 + `primary700` 텍스트로 강조 (양쪽은 흰 바탕, 위계 살림)
- ShiftCard 평가하기 버튼 `warn` 노랑 → `primary` (브랜드 통일)
- DashPill 4알약(모집/매칭/근무/완료) 의미색은 그대로 유지 (warn/info/primary/success)

#### A3. owner/new-shift.tsx
- 시프트 등록 메인 CTA `styles.buttonPrimary` → `GradientButton size lg`
- 요구 자격 다중 칩 active `warn` → `primary100` + `primary` 보더 + `primary700` 텍스트
- 단골 우선 노출 토글 체크박스 + 분(分) 칩 active `warn` → `primary` (단골은 브랜드)
- 직무/등급/시급/요일/일괄 토글 등은 이미 primary 톤 — 유지

#### A4. owner/cafes.tsx
- Empty 상태 "첫 매장 등록" CTA → `GradientButton`
- FAB / 매장 카드 / 통계 등은 이미 primary 톤 — 유지

#### A5. owner/payouts.tsx
- 이번달 총 지출 큰 카드 — surface → `primary50` 바탕 + `primary200` 보더, 라벨 → `primary700`, 큰 숫자 → `primary` (수입/지출 = 브랜드 가치)
- "정산 승인 + 평가" CTA `colors.success` solid → `GradientButton size sm` (점주 핵심 액션)
- 워커 수령 net 색은 success 유지 (워커 입장 = 받는 돈)
- 30분 SLA / 승인 대기 borderLeft warn 의미색 유지

### 트랙 B — 점주 부속 화면

#### B1. owner/dashboard/[status]
- 변경 없음 — status별 의미색(warn/info/primary/success) 이미 정합. SLA 임박 표시도 명확.

#### B2. owner/history.tsx
- 변경 없음 — 의미색 정합. 월 셀렉터 primary, 노쇼 danger, 별점 warn 모두 OK.

#### B3. owner/worker-pool.tsx
- WorkerCard tone 'favorite' borderColor `warn` → `primary`, bg `warnSoft` → `primary50`
- 점주 단골 뱃지 `warnSoft` + `warn` → `primary100` + `primary700` (단골은 브랜드)
- VIP/단골/신규 tier 뱃지 (TIER_META) 는 자체 컬러 시스템 유지 — 별도 의미

#### B4. owner/shift/[id].tsx
- 매칭 확정 CTA `styles.buttonPrimary` → `GradientButton`
- 정산 승인 + 평가 CTA `colors.success` solid → `GradientButton`
- 노쇼 등록은 danger borderColor 유지 (의미색)
- 워커 평가만 등록은 buttonSecondary 유지 (보조 액션)

#### B5. owner/statement.tsx
- 변경 없음 — 의미색 정합. 정보 위주 화면.

### 트랙 C — 공유 + 워커 hidden 화면

#### C1. components/WorkerHomeWidgets.tsx (me.tsx 헤더로 이주된 위젯)
- 오늘 매칭 — solid primary → `GradientCard` (워커 home.tsx 동일 패턴)
- 이번주 받을 돈 — `successSoft` 녹색 → `primary50` + `primary` 숫자 + `primary200` 보더
- 내 평점·단골 — `warnSoft` 노랑 → `primary100` + `primaryDark` 숫자 + `primary300` 보더
- 단골 매장 새 시프트 — `successSoft` → `primary50` + `primary` 보더
- 점주 직접 호출 hero(solid primary) 유지

#### C1. worker/profile.tsx
- 보유 자격 다중 칩 active `success` 녹색 → `primary100` + `primary` 보더 + `primary700` 텍스트
- 보건증 업로드 안내 (warn) 등은 의미색 유지

#### C1. worker/invitations.tsx
- 수락 (1탭 매칭) CTA `colors.success` solid → `GradientButton` (브랜드 핵심 액션)
- 만료 시간 알약 warn 유지 (시간 경고)
- 카드 borderLeft + bg `primarySoft` 그대로 OK

#### C1. worker/stats.tsx, worker/documents.tsx
- 변경 없음 — 의미색 정합. 정보·통계 화면.

#### C2. cafe/[id].tsx (공유 매장 상세)
- 단골 매장 등록 버튼 `warn` + `warnSoft` → `primary` + `primary100` (브랜드)
- 단골 텍스트 색 `warn` → `primary700`
- 1탭 지원 CTA `styles.buttonPrimary` → `GradientButton`
- CountPill 모집중/별점 등 의미색 유지

#### C2. u/[id].tsx (공유 워커 프로필)
- 변경 없음 — 모든 warn 사용처가 별점·지각·평점분포 등 의미색

#### C2. contract/[matchId].tsx, withholding/[matchId].tsx
- 변경 없음 — 의미색 사용 0건. 신고용 깔끔한 문서 화면.

### 시각 검증
- `tsc --noEmit` exit 0 (컴파일 에러 0)
- 백엔드 8090 + Metro 8081 둘 다 살아있고 폰 연결 유지 — 코드 변경은 색·import만이라 Metro HMR로 자동 적용
- 폰에서 reload 후 워커/점주 양쪽 모든 핵심 화면 톤 일관성 확인 가능

### 잔여 (다음 라운드)
- **AWS IAM 키 `AKIAW7WYAVZMXZUV6MFB` 폐기** (보안 P0 — 여러 라운드 잔여)
- 카카오 로그인 redirect URI 등록 + 워커 카카오 로그인 검증
- saju 디자인 추가 참조 (BrandMark·하단 메뉴)
- 점주 분쟁 신고 UI / 분쟁 자동 판정 cron
- 매장 사진을 워커 시프트 카드 헤더에 작은 썸네일로 노출
- 시프트 추천 점수 디버그 (왜 이 시프트가 추천인지 score 표시)
- 카카오 native 로그인 (Expo Linking + intent-filter)
- EAS dev build (Expo Go 푸시 한계 우회)

### 라운드 사이즈
- 변경 파일 수: 13개 (theme/Gradient는 5차 라운드에 이미 셋업, 6차는 그 위에 화면별 적용)
  - owner: _layout / shifts / new-shift / cafes / payouts / shift\[id\] / worker-pool (7개)
  - worker: profile / invitations (2개)
  - components: WorkerHomeWidgets (1개)
  - shared: cafe\[id\] (1개)
- 톤 통일이 핵심. 기능·로직 변경 0.

---

## 2026-05-04 (5차) — 워커 UX 톤업: 단바 오렌지 컨셉 통일 (트랙 B)

### 동기
- 사용자 요청 "단바의 색을 주황색을 컨셉으로 UX/UI를 조금더 고도화 ... 워커부터, 조금더 세련되게"
- 진단: primary 정의는 됐으나 화면에선 점점이 박힌 액센트 → 면 70%가 흰색·회색. 위젯 4개가 오렌지/녹색/노랑/회색 분산 → "오렌지 브랜드" 정체성 약함
- 3개 트랙 제안 (A 색만 / B 색+카드 마감 / C 히어로 재설계) 중 **트랙 B 합의**

### 결정 사항 (사용자 확정)
- 그라디언트: `#FF6B35 → #E55A28` (hero 세로, CTA 가로)
- 헤더: 흰 유지 + `primary50` 미세 와시
- 단골 강조: warn(노랑) → **primary 오렌지**
- 수입 카드: 녹색 → primary 톤 흡수

### 1. 의존성 + theme 토큰 시스템
- `expo-linear-gradient` 설치 (Expo SDK 54 호환)
- `lib/theme.ts` 오렌지 9단계 추가 — `primary50/100/200/300/400/500/600/700/800/900`
  - 50 `#FFF7F2` (헤더 wash) / 100 `#FFEEE2` (soft 칩) / 500 `#FF6B35` (primary alias) / 600 `#E55A28` (primaryDark alias) / 700 `#C44619` (강조 텍스트)
  - 기존 `primary/primaryDark/primarySoft` alias 그대로 — 호환 유지
- `gradients` 헬퍼: `brand` / `brandWarm` / `brandSoft`

### 2. 신규 컴포넌트 — `components/Gradient.tsx`
- `GradientCard` — hero 카드용 (props: colors, vertical, withShadow, onPress)
- `GradientButton` — CTA 버튼용 (props: label, icon, size sm/md/lg)
- `HeaderWash` — 흰 위 살짝 깔리는 brand 톤

### 3. 워커 _layout 헤더 + 탭바
- 헤더 배경 `colors.surface` → `colors.primary50` (와시)
- 탭바 active indicator — 아이콘 위에 4×22px 오렌지 알약. focused 만 표시
- 탭바 라벨 fontWeight 600 → 700, 높이 60→64

### 4. 워커 홈 (`worker/home.tsx`)
- 오늘의 매칭 — solid primary 카드 → `GradientCard` (세로 그라디언트, 18px 패딩, 자간 -0.5)
- 이번주 받을 돈 — successSoft 녹색 → `primary50` 바탕 + `primary` 숫자 + `primary200` 보더
- 내 평점·단골 — warnSoft 노랑 → `primary100` 바탕 + `primaryDark` 숫자 + `primary300` 보더 (강도 변주)
- 단골 매장 새 시프트 칩 — successSoft → `primary50` + `primary` 보더 + `primaryDark` 텍스트
- 빠른 진입 4개 — primarySoft/infoSoft/successSoft/warnSoft 분산 → primary 톤 4단계 변주
  - 시프트 검색: solid `primary` (가장 강조, 흰 텍스트)
  - 내 매칭: `primary100` (bordered)
  - 정산: `primary50` (bordered)
  - 내 문서: `primary50` (bordered)

### 5. 워커 시프트 카드 (`worker/shifts.tsx`)
- 단골 카드 borderLeft `warn` → `primary`, `warnSoft` 배경 → `primary50`, ⭐ 색 → `primary`
- 매장 아바타 32→40px, radius 9→10, 아바타 글자 12→15
- 매장명 15→16px (위계 강화)
- 단골만 필터 칩 accent `warn` → `primary`
- 요일 필터 칩 accent `warn` → `primary` (모든 활성 필터를 brand 통일)
- 1탭 지원 버튼 — `Pressable + styles.buttonPrimary` → `GradientButton` size sm

### 6. 워커 매칭 (`worker/matches.tsx`)
- 출근 체크인 CTA — solid primary → `GradientButton` (size md)
- 매장 평가하기 CTA — solid `warn` 노랑 → `GradientButton` (브랜드 통일)
- 퇴근 체크아웃 CTA — `success` 녹색 유지 (= 작업 완료 의미 색)

### 7. 워커 정산 (`worker/payouts.tsx`)
- 큰 실수령 숫자 색 `success` → `primary` (수입 = 브랜드 가치)
- 30분 SLA success/danger 의미 색은 유지

### 8. 워커 마이 (`worker/me.tsx`)
- 프로필 헤더 — 평면 카드 → `GradientCard` hero (오렌지 세로 그라디언트, 흰 텍스트)
  - 아바타 56px + 흰 반투명 보더 ring
  - 이름 22px 900wt 흰색
  - WorkerTier · 등급뱃지 · 경력 모두 흰 톤으로
  - 로그아웃 버튼 — `rgba(255,255,255,0.12)` 반투명 + 흰 텍스트
- 누적 통계 4타일 — success/info/text 분산 → 누적 수입 1개만 brand 강조 (`primary50` 바탕 + `primary` 숫자 + `primary200` 보더), 나머지 3개는 흰 바탕 + text (위계 절제)
- 선호 조건 평점 칩 active `warn` → `primary` (브랜드 통일)
- PMF 시그널 (별점/재고용/노쇼) 의미 색은 유지

### 톤 정책 (이번 라운드 정착)
- **primary 오렌지**: 브랜드 액션 / 단골 / 수입 / 평점·등급 / CTA / 활성 필터
- **success 녹색**: 작업 완료 의미만 (퇴근 체크아웃, 평가 완료 표시, 30분 SLA OK)
- **warn 노랑**: 경고만 (프로필 미완성 안내, 모집중 status)
- **danger 빨강**: 노쇼 / unread 채팅 / 거절
- 별점 ★ 표시 자체는 노랑 유지 (직관적)

### 시각 검증 (사용자 작업)
- `cd /c/Programs/skima/server && ./mvnw spring-boot:run` (8090)
- `cd /c/Programs/skima/client && npm run start -- --clear` (Metro 새 모듈 추가됐으므로 --clear 권장)
- 워커 로그인(worker1/pw1234) → 홈/시프트/매칭/정산/마이 5개 화면 톤 확인
- Native (Expo Go) + Web 둘 다 그라디언트 동작 확인 — `expo-linear-gradient` 가 두 플랫폼 모두 지원

### 잔여 (다음 라운드)
- **점주 화면 같은 톤 통일** (사용자 합의 시 별도 라운드)
- 워커 stats/profile/documents/invitations hidden 화면도 톤 점검
- WorkerHomeWidgets 컴포넌트 (me.tsx 헤더로 이주된 위젯) 색 통일 점검
- saju 디자인 추가 참조 (BrandMark·하단 메뉴)
- 보더 vs 그림자 둘 중 하나 통일 정책은 카드 단위로 점진 적용 — 이번 라운드는 신규 GradientCard 만 그림자, 기존 카드는 그대로 유지

---

## 2026-05-04 (4차) — 카카오 매듭 + 매장 위치 수정 UX 보강

### 데이터 초기화
- 사용자 요청 — 점주 매장 등록 정보 다 초기화
- 백엔드 재시작 (`mvnw spring-boot:run`) → DataSeeder 의 `wipe + reseed` 실행 (19초)
- ddl-auto: create + DataSeeder 패턴 — 시드 점주 5 / 워커 4 / admin 1 만 남음

### 카카오 콘솔 도메인 등록 (사용자가 직접 처리)
- 정확한 경로: 앱 관리 페이지 → [앱] → **[플랫폼 키] → [JavaScript 키] → [JavaScript SDK 도메인]**
- 등록: `http://localhost:8081`
- IP 주소(`192.168.0.3:8081`) 는 카카오 정책상 등록 불가 — 도메인 이름만 받음
- 신규 등록 매장의 web 지도 정상 표시 확인

### KakaoMapThumbnail 인터랙티브 모드
- props 추가: `interactive`, `onCoordsChange`
- 인터랙티브 모드 동작 (web only):
  - iframe `pointerEvents: auto`, map `draggable/scrollwheel: true`, 마커 `draggable: true`
  - 마커 `dragend` + 지도 `click` 이벤트 → `postMessage({type:'kakao-map-coords', lat, lng})` 부모로 전달
  - 100m GPS 게이트 원도 좌표 따라 동기 이동 (`gateCircle.setPosition`)
- 부모 useEffect 가 message 수신 → `onCoordsChange` 호출
- 우상단 라벨 변경: `🖱 드래그·클릭으로 위치 수정` + borderColor primary 강조
- 인터랙티브 모드에서 외부 카카오맵 링크 비활성 (실수 클릭 방지)

### 매장 상세 → 편집 진입 흐름 (이전엔 없었음)
- `cafe/[id].tsx` OwnerView (점주 본인 매장) 에 **"✏️ 매장 정보 수정"** 버튼 추가 (워커 단골/차단 토글 위치와 대칭)
- 탭 시 `router.push('/owner/cafes?edit={cafeId}')`
- `owner/cafes.tsx` 가 `edit` query 받아 cafes 로드 후 자동으로 `openEdit(target)` 호출 (autoTriggered 가드)

### 매장 편집 폼 좌표 영역 보강 (Native 친화)
- 좌표 입력된 경우 영역에 **위치 변경 액션 3개** 추가 (Web + Native 공통):
  - 🔍 검색으로 변경 — `setKakaoOpen(true)` (카카오 매장 검색 모달)
  - 📍 현재 위치 — `fillCurrentLocation` (expo-location GPS)
  - 🗺 카카오맵 확인 — 외부 카카오맵 앱/web (`https://map.kakao.com/link/map/{name},{lat},{lng}`) — Native 에서 정확한 위치 검증용
- Web 인터랙티브 안내 텍스트 추가: "지도에서 마커를 드래그하거나 빈 곳을 탭해 위치를 미세조정하세요"
- `Linking` import 추가 (외부 카카오맵 열기)

### Native 좌표 수정 흐름
1. 매장 상세 → "매장 정보 수정" 탭
2. 편집 모달 자동 오픈 (좌표 prefill)
3. 좌표 영역에서 3개 액션:
   - 카카오 검색으로 매장명 재검색 → 좌표 자동 입력
   - GPS 현재 위치로 채우기 (점주가 매장에 있을 때)
   - 외부 카카오맵에서 정확 위치 확인 후 다시 검색
4. ×버튼으로 좌표 클리어 후 재입력 가능

### 알아두기
- 좌표 변경 시 React 가 iframe srcDoc 다시 빌드 → 1회 깜박임. 거슬리면 후속 useMemo 안정화 가능
- Native 는 placeholder + 외부 링크 + 액션 버튼이 한계 — 마커 드래그 같은 시각 인터랙션은 web 전용
- `cafe/[id].tsx` 매장 상세 OwnerView 의 편집 진입은 첫 라운드 인터랙션. 같은 매장 두 번째 진입은 autoTriggered 가드로 자동 모달 미오픈 — 다음 라운드 ref 패턴으로 픽스 가능

### 매장 상세 화면에 지도 추가 (사용자 요청)
- 사용자 보고: "매장 상세 누르면 지도는 안 보이네요... 편집일 때는 보입니다" → 매장 상세에도 지도 노출
- 백엔드: `CafeDetailResponse` 에 `latitude`, `longitude` 필드 추가, `CafeDetailService.buildDetail` 에서 `cafe.getLatitude/Longitude` enrich
- 클라이언트: `lib/types.ts CafeDetail` 에 좌표 필드 추가
- `cafe/[id].tsx AboutCard` 에 KakaoMapThumbnail 추가 (좌표 있을 때만, height 160, 인터랙티브 X) + "탭하면 카카오맵 길찾기" 라벨
- 좌표 없으면 (시드 매장) 미노출 — `hasAny` 조건에 hasCoords 포함

### Native 에서도 지도 표시 (사용자 요청 "앱에서도 확인 가능하게")
- 사용자 보고: "워커에서도 잘 보이고.. 앱에서도 확인 가능하게 해주세요" → Native placeholder 한계 해소
- `npx expo install react-native-webview` 로 WebView 추가 (Expo SDK 54 호환 버전 자동 선택)
- KakaoMapThumbnail Native 분기를 placeholder → **WebView** 로 교체
  - 같은 iframe HTML 재사용 (`buildIframeHtml(lat, lng, showGate, false)`)
  - `source={{ html, baseUrl: 'http://localhost:8081/' }}` — 카카오 콘솔 등록 도메인을 baseUrl 로 지정해 SDK 도메인 검증 통과 시도
  - `pointerEvents="none"` — WebView 자체 인터랙션 차단, 부모 Pressable 이 탭 처리 (외부 카카오맵 링크)
  - 인터랙티브 모드는 native 에서 비활성 (postMessage 브리지는 web 전용)
- 동일 라벨 "🗺 카카오맵 열기 →" 우상단 유지

### 잔여 (다음 세션)
- 카카오 로그인 Redirect URI 등록 (`http://localhost:8081/auth/kakao/callback`) — JavaScript 키 페이지 비어있음
- 매장 상세 편집 진입 두 번째 자동 모달 안 열림 픽스 (ref 패턴)
- 시드 매장 좌표 추가 여부 (의도 결정 필요 — 좌표 추가 시 GPS 게이트 자동 활성)
- Native WebView 도메인 검증 통과 여부 사용자 검증 필요 — baseUrl 만으로 충분한지 OS 별 (iOS WKWebView vs Android WebView)
- WebView 미설치 환경 fallback 처리 (현재는 require 실패 시 앱 크래시 위험 — 그러나 react-native-webview 가 dev 의존성에 추가됐으니 OK)

---

## 2026-05-04 (3차) — 추천 시프트 이유 노출 (축 1 매칭 품질)

### 동기
- 라운드 4 카카오 통합 시 추천 알고리즘 도입 — TrustScore 25% + 별점 20% + (1−노쇼)10% + 거리 15% + 시급 10% + 단골 +15 + 능력 +5
- 워커는 "왜 이 시프트가 1위인지" 모름 → 추천 신뢰성 ↓
- 4축 로드맵 축 1 (코어 매칭 품질) 후속, 한 라운드 사이즈로 안전 + 임팩트 명확

### 분석
- 점주/매장 등급제 (S5)는 사실상 이미 구축 — `CafeDetailService.cafeTrustScore` (라운드 12 G), `WorkerShiftView.cafeTrustScore`, `TrustScoreBadge` 컴포넌트 모두 존재. 워커 시프트 카드에 trustScore 뱃지 이미 노출 중 (`worker/shifts.tsx` 라인 775~777)
- 진짜 갭: 추천 점수 산출 로직은 있으나 사용자에게 이유가 보이지 않음

### 변경 — `worker/shifts.tsx` 클라이언트만 (백엔드 무변경)
- `recommendReasons(s)` 헬퍼 신규 (useCallback) — 시프트 속성에서 추천 이유 추출, 최대 3개
  - ⭐ 단골 매장 / 💪 능력 적합 / 🛡️ 신뢰 매장 (trustScore≥75) / 📍 N km (≤2km) / ★ 4.5+ / 💰 시급 15k+
- 추천 정렬 모드일 때만 카드에 칩 라인 표시
  - 위치: 카드 헤더 직후, 핵심 정보(시간/가격) 라인 위
  - 디자인: 강조 알약 "🎯 추천" (primary 배경) + 이유 칩들 (primarySoft 배경)
- 모든 시그널 이미 `WorkerShiftView` 응답에 포함 (cafeTrustScore, cafeAvgRating, cafeLatitude/Longitude, isFavoriteCafe 등)

### 결과
- 워커 추천순 정렬 시 "왜 이 시프트가 추천인지" 한눈에 → 결정 신뢰도 ↑
- 추천 외 정렬(시간/별점/시급/거리)에서는 칩 미노출 (혼란 방지)

### 잔여 (다음 라운드 후보)
- 워커/카페 프로필 강화 (축 1 후속) — 매칭 정확도 추가 향상
- 노쇼 자동 보상 (축 2) — 백업 매칭 실패 시 점주 환불 + 쿠폰
- 알바 이력서 PDF (축 4) — 워커 lock-in
- 추천 코드 / 카톡 공유 (축 4) — K-factor 성장
- 점주 다중 매장 종합 등급 (S5 후속)

---

## 2026-05-04 (이어서) — 코드 검토 · 죽은코드 정리 · Expo Go 픽스 · 채팅 unread 강화

### 1. 점주/워커 홈 코드 검토 (사용자 요청 "어제 마지막에 점주/워커 홈 UX/UI 정리한 코드 체크")
- `owner/shifts.tsx` 1231줄에서 죽은 코드 발견:
  - 함수 6개: `FilterChip`, `StatCard`, `TodayWidgets`, `CafeStatsRow`, `Pill`, `Bar` (호출처 0)
  - import 2개: `EmptyState`, `ScrollView` (위 죽은 코드에서만 사용)
  - `CafeStats` 타입 import 누락 (죽은 코드 내부에서만 사용 — TS strict 미비활성으로 통과 중)
- 인라인 아바타 폴백 `slice(-1)` 4곳 발견 (어제 라운드 "Avatar 폴백 첫 글자 통일" 의도와 충돌):
  - `cafe/[id].tsx:484`, `owner/history.tsx:291`, `owner/dashboard/[status].tsx:280`, `owner/shifts.tsx:1155`
- 1차 분석에서 부정확한 부분 자체 정정: 처음 1곳만 짚었으나 실제 4곳 + EmptyState import 누락 추가 발견

### 2. 죽은 코드 정리 (`owner/shifts.tsx`)
- sed 로 477~508 + 687~1017 라인 범위 삭제 (363줄)
- import 2개 제거 (`EmptyState`, `ScrollView`)
- 결과: **1231 → 867줄 (364줄, ≈ −29%)**

### 3. 인라인 아바타 폴백 통일
- `components/Avatar.tsx` 의 `initialFor` 함수 export 추가 (한글 첫 글자 + 영문 대문자 처리)
- 4곳 인라인 아바타: `slice(-1)` → `initialFor(name)` 호출로 교체
- 색상·크기 그대로 유지 (Avatar 컴포넌트 통째 교체는 색상이 바뀌어 보류) — 폴백 글자 로직만 통일

### 4. Expo Go 부팅 ERROR 픽스 (`lib/push.ts`) — 사용자 보고 "expo go에서 앱 접근 안됨"
- 증상: Expo Go SDK 53+ 에서 `expo-notifications` 모듈을 import 만 해도 `DevicePushTokenAutoRegistration.fx.js` 가 ERROR throw → 앱이 `_layout.tsx` 도달 전 죽음
- 우리는 SDK 54
- 픽스: `expo-notifications` / `expo-device` 정적 import 제거 → `Constants.appOwnership === 'expo'` 로 Expo Go 감지 후 conditional `require`
- Expo Go 에서는 모듈 자체를 안 불러옴 → ERROR 안 나감 → 앱 정상 부팅
- Native dev build / production 빌드 에서는 그대로 푸시 토큰 발급 + 등록 작동
- HMR graph traverse 충돌로 `--clear` 옵션으로 Metro 재기동 필요했음

### 5. 채팅 unread 인식 강화 — 사용자 피드백 "채팅이 오면 잘 인식 못 함"
**진단**: 진짜 원인은 진입 동선상 노출 부족. 워커는 홈에서 채팅 왔는지 알 길이 없고, 점주는 시프트 메인 카드에 unread 표시가 없어 시프트 상세를 열어야만 보임.

**워커 `home.tsx`**
- "오늘의 매칭" 위젯 안에 흰 배경 빨간 텍스트 칩 `💬 점주 새 메시지 N건` (오렌지 카드 위에 강하게 띔)
- 빠른 진입 "내 매칭" ✅ 버튼 우상단에 빨간 N 뱃지 (`totalChatUnread = 모든 matches 합산`)

**점주 `owner/shifts.tsx` ShiftCard (메인 리스트)**
- `hasUnread` 변수 추가
- 카드 borderColor 우선순위: `hasPending(primary)` > `hasUnread(danger)` > 없음 — 지원자 처리가 채팅보다 더 시급
- 매칭된 워커 정보 박스 우측에 빨간 `💬 N` 알약 — 탭 → 시프트 상세로 라우팅 (매칭 박스는 부모 Pressable 바깥이라 자체 onPress 필요)

**점주 `owner/shifts.tsx` DashPill (4 알약)**
- 알약 아래 작은 회색 텍스트 (accent 색) → 빨간 배경 흰 글씨 작은 알약으로 통일
- 🔥 N (지원도착) / 💬 N (채팅) / ⭐ N (평가대기) 모두 동일하게 강조

### 6. 백엔드 + Metro 기동 운영 메모
- Spring Boot: `mvnw spring-boot:run` 16.2초, 8090 포트, 클린 부팅
- Metro 첫 시작 시 PowerShell ExecutionPolicy 가 `npm.ps1` 차단 → Bash 로 우회 (PowerShell 에서는 `npm.cmd` 또는 ExecutionPolicy 변경 필요)
- conditional require 후 HMR graph traverse `Got unexpected undefined` 에러 → `npm run start -- --clear` 로 cold rebuild

### 잔여 (다음 세션)
- Phone reload 후 채팅 unread 시각화 실제 동작 확인 (백엔드 chatUnreadCount 응답이 0이 아닐 때만 의미 있음)
- 워커/점주 빠른 진입 카드 스타일 일관성 — 워커 4버튼(이모지+라벨) vs 점주 QuickLink 세로 카드(이모지+라벨+서브). 의도 여부 사용자 확인 후 통일 결정
- AWS IAM 키 로테이션 (이전 라운드 잔여)
- 카카오 도메인 화이트리스트 등록 (이전 라운드 잔여)
- EAS development build 검토 — Expo Go 한계(푸시) 우회용

---

## 2026-05-04 — 카카오 통합 + 점주/워커 첫 화면 다듬기 + UI 정돈

### 1. 카카오 Local API 통합
- 백엔드 신규: `KakaoLocalService` (RestTemplate + dapi.kakao.com keyword search), `KakaoLocalController` (`GET /api/kakao/places?q&lat&lng&size`), `KakaoPlace` DTO
- 무료 30만/일, 비즈앱 등록 불요 — REST API 키만 있으면 됨
- 검증: 강남역 좌표로 호출 → 78m/80m/107m 거리순 정렬 OK
- 클라이언트 신규: `KakaoPlaceSearchModal` — 점주 매장 등록/수정 폼에서 매장명·주소·좌표·전화 자동 입력
- 클라이언트 신규: `KakaoMapThumbnail` — Web은 Maps JS SDK iframe, Native는 placeholder. 워커 시프트 카드(88px), 점주 매장 폼 출근 게이트 100m 원형 시각화(180px)
- ⚠️ 카카오 콘솔 등록 필요: 플랫폼키 → JavaScript 키 → 사이트 도메인에 `http://localhost:8081` 등록해야 Maps SDK 작동

### 2. 시프트 추천 알고리즘
- 워커 시프트 화면에 `🎯 추천순` 정렬 모드 추가, 기본값으로 설정
- 점수 = 매장 TrustScore 25% + 별점 20% + (1−노쇼율) 10% + 거리 15% + 시급 10% + 단골 보너스 +15 + 능력적합 보너스 +5

### 3. 점주 첫 화면 정돈 (DashboardHeader → DashPill)
- 큰 4 StatCard + 1시간 매칭률 게이지 → **컴팩트 1줄 4 알약 (모집/매칭/근무/완료)** + 매칭률 작은 텍스트
- 알약 자체가 필터 토글 겸함 (탭 → 해당 상태 필터, 다시 탭 → ALL)
- 액션 배지 (🔥 지원도착 / 💬 채팅 / ⭐ 평가대기) 알약 아래 표시
- **시프트 긴급도 자동 정렬**: OPEN+지원자 > IN_PROGRESS > MATCHED > COMPLETED+평가대기 > OPEN(빈) > 그 외 (정산 완료까지 매칭 시프트가 첫 화면 상단에 유지됨)
- **빈 상태 CTA**: 매장≥1 + 시프트=0 → "📋 첫 시프트 등록하기" 큰 버튼 (헤더 비움)
- 매장 0 → OnboardingSteps (변경 없음)

### 4. 빠른 진입 3버튼 — 세로 카드 재설계
- 가로 (이모지+긴 텍스트) 겹침 → **세로 (이모지 위 / 라벨 / 서브라벨)** 균등 너비 + numberOfLines={1}
- 라벨 단축: 시프트 히스토리→히스토리, 워커 풀, 템플릿. 서브: 지난 시프트/단골 워커/반복 시프트
- 신규 컴포넌트: `QuickLink` (in `owner/shifts.tsx`)

### 5. 타이포 체계 다듬기 (`lib/theme.ts` — 전역)
- 자간 강화: h1 -0.5→-0.8, h2 -0.3→-0.6, title -0→-0.4, body -0→-0.2 (한글 더 또박)
- 행간 명시: 모든 텍스트 스타일에 lineHeight (h2 26, body 20, subtitle 18 등)
- 사이즈 슬림: h1 28→26, h2 22→20, title 17→16, bigNumber 56→48
- 타이틀 weight 700→800
- 워커도 동일 적용 (전역 theme이라 자동)

### 6. 헤더·아이콘 시스템 업그레이드
- `Icon.tsx` → 이모지 매핑 → **Ionicons SVG** (이미 설치된 `@expo/vector-icons`, outline 스타일로 통일)
- 영향: 워커/점주 탭바, 헤더 종, 모든 화면 아이콘 자동 정돈
- `HeaderLogout` 재설계: 작은 아바타 + 이름 + ▾ → 탭하면 우측 상단 드롭다운 (큰 아바타·역할 표시 + 마이페이지/내매장 + 로그아웃)
- 프로필 사진 헤더 연동: HeaderLogout이 `/api/me` 호출해 profileImage 캐시 → Avatar에 imageUrl 전달
- `Avatar` 폴백 수정: 마지막 글자 → **첫 글자** (slice(0, 1)) — "점주김씨" → "점", "김민준" → "김" (영문은 대문자)

### 7. 워커 시프트 카드 컴팩트화
- padding 16→14, 마진 16→10, 아바타 38→32, 매장명 17→15px
- 시간/근무/모집 3 알약 → **한 줄 텍스트** "🕐 5/4 14:00 / 4시간 근무 · 1명 모집"
- "예상 보수" 라벨 박스 + 28px 큰 가격 → **인라인 우측** 20px 가격 + 시급 작게 아래
- 지도 130px → **88px**
- 능력 배지 → compact 모드
- 1탭 지원 버튼 padding 14→11
- 단골 테두리 4px → 3px
- 결과: 카드 높이 약 30~35% 감소

### 8. S3 업로드 500 픽스
- 원인: Spring 재시작 후 `AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY` env 사라짐 → `DefaultCredentialsProvider`가 자격증명 못 찾아 `SdkClientException`
- 픽스: `S3Service`에 `cloud.aws.credentials.access-key/secret-key` properties 주입 추가. 값 있으면 `StaticCredentialsProvider`, 없으면 기존 Default 폴백
- `application-local.yml` (gitignored)에 키 등록 → 재시작에도 유지

### 9. 단바 리브랜딩 잔여 (워커 + 점주 양쪽)
- `+html.tsx` title: "스키마 바이트" → "단바 — 단기 알바 30분 매칭"
- `index.tsx` 인트로 스플래시: 흰사각+⚡ → **icon.png 180px** (배경 크림 #FFF7ED), "스키마 바이트" → "단바"
- `login.tsx` 로고: 오렌지박스+⚡ → icon.png 88px
- `Splash.tsx` (로딩): icon.png 140px
- 모든 화면이 실제 앱 아이콘(오렌지+노란번개+단바) 그대로 사용

### 10. 사이드 작업
- 아이콘 안전 마진 재렌더 (60% bolt, 20% top/left) — 라운드 코너로 잘림 방지
- 워커/점주 헤더에 BrandMark (⚡단바 작은 칩) 추가
- KakaoPlaceSearchModal에 카카오맵 미리보기 (web only, iframe) — 검색 결과 마커 + 내 위치 파란점

### 잔여 (다음 세션)
- 카카오 도메인 화이트리스트 등록 후 Map iframe 동작 검증
- AWS IAM 키 로테이션 (보안)
- saju에 있는 BrandMark/하단 메뉴 디자인 추가 참조

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

## 2026-05-02 — GitHub push (라운드 1~7 일괄 저장)
- 커밋 `13ec1a1` "Skima Byte 2026-05-02 라운드 1~7 일괄 저장"
- 59 파일 변경 (12개 신규, 47개 수정)
- 시크릿 노출 없음 — `application.yml` 디폴트값 비어있음 그대로 유지

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

---

## 2026-05-03 — 8라운드: 잔불 정리 + 프로필 정보 강화 + 자동화

### 사용자 결정
- 추천 순서대로 일괄 진행, 질문 없이 끝까지
- 모바일에서 테스트 — 백엔드/Expo 백그라운드 실행
- 카카오 native deep-link 콘솔 등록은 다음 라운드로 미룸 (Kakao 콘솔이 custom scheme `skima://` 거부 — http(s) 브리지 페이지 필요)
- **사용자 피드백 (작업 도중)**: "매장 정보·평판이 부족, 워커 정보도 부족" → 라운드 중간에 새 작업으로 슬롯 추가

### 진행 상황 — 완료 ✅

**A6 — ⭐ 매장 pin (점주 메인 매장 가로 스크롤)**
- `lib/pinnedCafes.ts` 신설 — `usePinnedCafes` hook (storage.ts 위에 + Set 백킹)
- `owner/shifts.tsx` `CafeStatsRow` — pin한 매장 우선, ⭐/☆ 토글 버튼, 헤더 라벨 분기 ("⭐ 우선 · 활동 많은 순")

**매장 프로필 정보 강화 (사용자 피드백)**
- 백엔드 `Cafe` 엔티티 + 필드 4개: `openHours` / `seatCount` / `phone` / `description` (+ `updateProfile` 메서드)
- `CafeCreateRequest` / `CafeResponse` 동기화
- `OwnerController` createCafe / updateCafe 새 필드 처리
- `CafeDetailResponse` 확장: 매장 정보 4개 + 평판 시그널 3개 (`rehireRate`, `avgWageGross`, `regularsCount`, `totalMatches`)
- `CafeDetailService` — 재고용률(2회+ 워커 비율), 최근 30일 평균 일급, 단골 워커 수 계산
- 클라 `Cafe` / `CafeDetail` 타입 동기화
- `owner/cafes.tsx` 등록·편집 모달에 새 필드 입력 영역 (영업시간 / 좌석수 / 매장 전화 / 매장 소개 멀티라인)
- `cafe/[id].tsx` — `AboutCard` (매장 정보) 신설 + `SignalsCard` 2행 확장 (재고용률·단골 워커·평균 일급)

**워커 프로필 정보 강화 (사용자 피드백)**
- 백엔드 `User` 엔티티 + 필드 3개: `bio` / `experienceYears` / `availableHours` (+ `updateWorkerBio` 메서드)
- `WorkerProfileUpdateRequest` 확장 (+ `updateBio` 토글 — bio/availableHours null=clear 의미 명확화)
- `MeController` — `/api/me` 응답 확장, `/api/me/worker-profile` updateBio=true 면 bio도 갱신
- `WorkerProfileResponse` 확장 — 자기신고(level/roles/certs/bio/exp/availableHours) + 평판 시그널 5개 (`rehireRate`, `favoriteCafeCount`, `onTimeCount`, `lateCount`, `avgWorkMinutes`)
- `WorkerProfileService` — 매장별 재고용률, 정시·지각 카운트 (시작-5분 이내 정시), 평균 실 근무 분, 즐겨찾기 매장 수 계산
- 클라 `MyProfile` / `WorkerProfile` 타입 동기화
- `worker/profile.tsx` 자기 편집 — 자기소개 / 경력년수 / 가능시간대 카드 추가
- `u/[id].tsx` 외부 보기 — 헤더에 등급·경력 뱃지, 자기소개+직무+자격 카드, 평판 시그널 카드(정시·평균근무·단골매장·재방문)

**A5 — 노쇼 결과 모달**
- `components/NoShowResultModal.tsx` 신설 — 결과 3종 분기:
  - 백업 매칭 성공 → ✅ 백업 워커 카드 + 자동 알림 안내
  - 재모집 → 🔄 단골 N명 푸시 + "워커풀 열기" 빠른 액션
  - 일반 → 📋 노쇼 등록 완료
- `owner/shift/[id].tsx` reportNoShow → 토스트 분기 제거 → 모달 호출
- toast import 정리

**A2 — 중복 시프트 검증 + 단골 우선 토글**
- 백엔드 `ShiftRepository.findOverlapping` — 같은 매장에서 [start, end] 와 겹치는 시프트 (CANCELED 제외)
- `OwnerController.checkOverlap` — `GET /api/owner/shifts/check-overlap?cafeId=X&startAt=Y&endAt=Z`
- `Shift` 엔티티 + `favoritesOnlyUntil` 필드 + builder 인자
- `ShiftCreateRequest` + `favoritesOnlyMinutes` 필드 (null/0 = 모두 공개)
- `ShiftService.create` — favoritesOnlyMinutes>0 이면 favoritesOnlyUntil=now+min
- `WorkerController.openShifts` — favoritesOnlyUntil>now 인 시프트는 즐겨찾기 한 워커에게만 노출
- `ShiftResponse` favoritesOnlyUntil 노출 / 클라 Shift 타입 동기화
- `owner/new-shift.tsx`:
  - 디바운스 350ms 중복 검증 → 인라인 빨간 경고 카드 (최대 3건 노출)
  - submit 시 한 번 더 confirm 다이얼로그
  - 단골 우선 노출 토글 (체크박스) + 분 칩 4종 (10/30/60/120)
  - 등록 성공 토스트 분기 (단골 우선 노출 안내)

**W3 — 워커 월별 수입 미니 차트**
- `worker/stats.tsx` `MonthlyIncomeChart` 컴포넌트 신설
- `/api/worker/payouts` 추가 fetch
- 최근 3개월 슬롯 / COMPLETED payout 만 집계 / 막대 그래프 + 이번달 강조 색
- 데이터 0이면 자체 숨김

**W4 — 워커 계약서/영수증 모음 화면**
- 신규 라우트 `app/worker/documents.tsx` (href:null 등록)
- `/api/worker/matches` fetch → 월별 그룹화 + 검색 (매장명/날짜)
- 각 카드에 "근로계약서"·"원천징수영수증" 빠른 액션 (기존 `/contract/{id}`·`/withholding/{id}` 라우트 재사용)
- `worker/home.tsx` 빠른 진입에 "📄 내 문서" 버튼 추가

**X2 — 빈 상태 + 스켈레톤 로딩 일괄**
- `components/EmptyState.tsx` 신설 — emoji+title+subtitle+actions(primary/secondary)
- `components/Skeleton.tsx` 신설 — `Skeleton` (애니메이션 박스) + `SkeletonCard` + `SkeletonList`
- 적용:
  - `worker/matches.tsx` → 로딩 시 스켈레톤 / 빈 상태 시 EmptyState ("시프트 검색" CTA)
  - `owner/shifts.tsx` → 로딩 시 스켈레톤 / 빈 상태 시 EmptyState ("첫 시프트 등록하기" CTA)
  - `cafe/[id].tsx` → 로딩 시 스켈레톤 카드 3개

**X3 — 에러 재시도 토스트**
- `lib/toast.tsx` `pushToastGlobal` 신설 — Provider 외부에서 imperative push (singleton 등록)
- ToastProvider mount 시 `_globalPush` 등록, unmount 시 해제
- `lib/api.ts` 리팩터:
  - `NetworkError` 클래스 신설 (ApiError 와 분리)
  - `retries` 파라미터 (기본 1) — 네트워크 실패 시 600ms 백오프 후 재시도
  - 재시도 다 실패하면 글로벌 토스트 (3초 디바운스로 스팸 방지) + throw
  - `silentNetwork: true` 로 토스트 끌 수 있음

**A3 — 시프트 템플릿 + 자동 반복 등록**
- 백엔드 신규 도메인 `ShiftTemplate` (owner+cafe+name+daysOfWeek+startHour/Minute+durationHours+wage+headcount+description+jobRole+minSkill+requirements+active)
- `ShiftTemplateRepository`
- `ShiftTemplateService`:
  - CRUD (create/list/setActive/delete)
  - `materialize(id, days)` — 단일 템플릿 즉시 적용
  - `generateForActiveTemplates()` — 모든 active 템플릿 다음 14일 자동 생성
  - 같은 매장·시작·종료 정확히 일치 시 중복 생성 스킵
  - 시작 시각이 이미 지났으면 스킵
- `ShiftTemplateScheduler` `@Scheduled(cron = "0 5 0 * * *")` — 매일 자정 5분
- `OwnerController` 5개 endpoint (GET/POST/active/DELETE/materialize)
- 클라 `app/owner/shift-templates.tsx` 신규 — 리스트 + 활성 토글 + 즉시 적용 + 삭제 + 신규 모달 (요일·시간·근무·시급·인원·직무·등급·자격 풀스펙)
- `owner/_layout.tsx` 라우트 등록 (href: null)
- `owner/shifts.tsx` 빠른 진입 영역에 "🗓️ 템플릿" 버튼 추가

**A4 — 단골 워커 그룹별 분류**
- `owner/worker-pool.tsx`:
  - 자동 분류 함수 `classifyTier`: VIP (5+ 매칭 + ★4.5+) / REGULAR (2~4) / NEW (0~1)
  - `TIER_META` 색상 매핑 (VIP=골드, REGULAR=오렌지, NEW=블루)
  - 헤더 통계 → 총/VIP/단골/신규/노쇼 5분할
  - 그룹 필터 chips (전체/VIP/단골/신규)
  - WorkerCard 헤더에 자동 그룹 뱃지 + 기존 점주 단골 뱃지 라벨 분리

### 검증
- 백엔드 `mvnw compile` ✅ (신규 100 source files)
- 클라 `tsc --noEmit` 0 errors
- 백엔드 재시작 — 모바일 테스트 가능

### 사용자 액션 필요
- 카카오 콘솔 native redirect URI: 작업 보류 (브리지 페이지 필요 — A 옵션 미진행)
- 시드 매장은 새 컬럼이 null — 등록·편집해서 채우면 매장 상세에 노출됨
- 단골 우선 토글은 즐겨찾기 워커가 있어야 의미 있음 (그 전에는 모두 차단됨)

### 다음 라운드 후보
- A1 매출/세무 강화 (statement 토글·추세 차트·PDF)
- A7 매장 사진 업로드 (스토리지 의존)
- W5 워커 프로필 사진 업로드 (스토리지 의존)
- S4 워커 등급제 (Verified Barista) — 자동 등급 부여
- S3 분쟁 이의제기 흐름
- 카카오 native deep-link 브리지 페이지 (GitHub Pages 1분)

---

## 2026-05-03 — 9~K 라운드 (큰 작업 누적)

### 추가/변경 핵심
- `application.yml`: AWS S3 (`cloud.aws.s3`) + multipart + 시드 5점주 + 보건증/등급/Trust Score 등
- 사용자 자격증명 노출됨 (AKIAW7WYAVZMXZUV6MFB) — **운영 가기 전 무효화 필요** ⚠️
- DB 신규 컬럼 (모두 ddl-auto: create로 자동 적용):
  - User: bio/experienceYears/availableHours, prefMin/Max*, profileImage(MEDIUMTEXT), healthCert*, trustScore (계산값)
  - Cafe: openHours/seatCount/phone/description/imageUrl(MEDIUMTEXT)
  - Shift: favoritesOnlyUntil
  - 신규 도메인 6개: ShiftTemplate, OwnerFavoriteWorker, WorkerFavoriteCafe, WorkerBlockedCafe, Dispute, ShiftInvitation

### 9라운드 — A/B 점주·워커 동선 구조 개편
**점주 P0 — 매장 등록 자동 흐름**
- OnboardingSteps 1단계 → `/owner/cafes?autoCreate=1` → 모달 자동 오픈
- 등록 성공 시 `router.replace('/owner/shifts')` 자동 복귀

**점주 P1 — 첫 시프트 등록 후 안내**
- new-shift submit 시 첫 시프트면 `/owner/shift/[id]?firstTime=1` 진입 + 🎉 안내 배너

**워커 시프트 첫 탭 흡수**
- 모든 redirect (login/index/auth) → `/worker/shifts`
- `WorkerHomeWidgets` 컴포넌트로 시프트 화면 상단에 위젯 통합
- 4탭으로 (시프트/매칭/정산/마이)

**워커 마이 탭 통합**
- 신규 `worker/me.tsx` — 프로필 편집 진입 + 통계 + 평가 + 월별 차트
- 통계+프로필+문서 → 마이로 흡수

**워커 빠른 필터 칩**
- 시프트 탭 헤더에 시간대(오전/오후/저녁/심야), 요일(오늘/이번주/주말), 시급(12k/15k+), 단골만, 능력매칭만 칩
- AsyncStorage 영구 저장

**워커 영구 필터 (마이 탭 선호 조건)**
- `lib/workerPrefs.ts` — 최소 시급/매장 평점/노쇼율 임계치/거리
- 시프트 화면에서 항상 적용 (단골 매장은 면제)

**owner4·owner5 시드** — 신규 점주 (매장 0) 테스트 계정

### 10라운드 — C/D 라운드 (알림 통합 / 거리 / 분쟁 / 온보딩 / 사진)
**C 알림+필터 백엔드 통합**
- User에 prefMinWage/prefMinCafeRating/prefMaxCafeNoShowRate
- prefsAcceptShift() 메서드 — 단골 면제 + 그 외 모두 통과 체크
- ShiftService.create 단골 푸시 시 prefs 적용

**C 단골 매장 황금 강조**
- WorkerShiftView.isFavoriteCafe enrich
- 워커 시프트 카드: 황금 borderLeft + ⭐ 단골 뱃지

**D1 워커 등급제 (Verified Barista)**
- WorkerStatsResponse.WorkerTier: NEW/REGULAR/VERIFIED/ELITE
- 자동 분류 — 완료 횟수 + 평점 + 노쇼 + 재고용률
- WorkerTierBadge 컴포넌트 4곳 노출

**D2 거리 기반 필터**
- WorkerShiftView.cafeLatitude/Longitude
- lib/geolocation.distanceKm (Haversine)
- 거리 칩 5/10/30km + 가까운순 정렬 + 카드 거리 표시
- 단골 매장 거리 면제

**D3 분쟁 이의제기**
- Dispute 도메인 + DisputeReason/Status/Verdict
- 자동 판정 휴리스틱: NO_SHOW_DISPUTE는 체크인 기록, LATE_CHECKIN/EARLY_CHECKOUT은 ±10분
- 클라 DisputeModal — worker/matches CHECKED_OUT/NO_SHOW 카드에 "⚠️ 이의 제기" 버튼

**D4 워커 온보딩 튜토리얼**
- WorkerOnboardingTutorial 4-step 모달 (환영→프로필→선호 조건→단골)
- AsyncStorage 플래그로 첫 진입 시만

**D5 프로필 사진 업로드 (S3 전환)**
- pom.xml AWS SDK v2 (s3:2.25.16)
- S3Service (springdeveloper 참고)
- application.yml cloud.aws.s3.bucket/region (env vars)
- POST/DELETE /api/me/profile-image (multipart) + cafe/{id}/image
- expo-image-picker ~17.0.11 설치
- lib/imageUpload.ts 헬퍼 (web/native 분기)
- 사용자가 AWS 셋업 (skimabyte-profile 버킷 + IAM + bucket policy public read)

### 11라운드 — E (사진 노출 4곳 + 매장 사진 UI)
- WorkerProfileResponse.profileImage / ApplicationResponse.workerProfileImage
- 신규 `Avatar` 컴포넌트 (사진/이니셜 분기, 4 사이즈)
- 노출: worker/me 헤더 / u/[id] 헤더 / shift/[id] 지원자 / worker-pool 카드
- owner/cafes 카드에 매장 사진 + 사진 추가/삭제 버튼
- cafe/[id] 헤더에 매장 사진 (180px)

### 12라운드 — G (Trust Score + 평가 history + 차단)
**G5 워커 Trust Score**
- WorkerStatsResponse.trustScore (0~100, null=신규<3건)
- 공식: 별점/5*40 + 재고용*30 + (1-노쇼)*20 + min(완료/10,1)*10
- TrustScoreBadge 컴포넌트 (색상 분기)
- 노출: u/[id] 헤더, 지원자 카드, 워커풀 카드

**G6 매장 Trust Score**
- CafeDetailResponse.trustScore + payoutManualRate
- 공식: 별점/5*35 + 재고용*25 + (1-노쇼)*15 + 정산빠른승인*15 + min(매칭/20,1)*10
- 점주 명시 승인 비율을 "정산 신뢰도"로 정량화
- cafe/[id] 헤더 매장명 옆 노출

**G1 워커가 매장에 준 평가 history**
- worker/me에 "내가 매장에 남긴 평가" 카드 (받은 평가 위)
- /api/worker/me/ratings/given 재사용

**G2 워커 차단 매장**
- WorkerBlockedCafe 도메인 + 엔드포인트
- WorkerController.openShifts에서 차단 매장 자동 제외
- cafe/[id]에 단골/차단 토글 (양립 불가)

**G3 평가 모달에 차단 동시 처리**
- ★≤2 또는 willRehire=false 일 때 "🚫 차단" 체크박스 자동 노출
- 평가+차단 한 흐름

### 13라운드 — H (보건증 인증)
- HealthCertStatus enum: NOT_UPLOADED/PENDING/VERIFIED/REJECTED/EXPIRED
- User 보건증 6개 필드 (image/status/uploadedAt/verifiedAt/expiresAt/rejectReason)
- 1년 만료 + cron 자동 EXPIRED
- POST /api/me/health-cert (multipart S3) — 운영은 PENDING 유지 (admin 검토)
- ApplicationService.apply 보건증 필수 체크 — requirements에 HEALTH_CERT 있으면 VERIFIED만 지원 가능
- 클라: HealthCertBadge 컴포넌트, worker/profile 업로드 카드, u/[id]·지원자 카드 status 뱃지
- 점주는 status만 봄 (이미지는 admin 전용 — 개인정보)

### 14라운드 — I (자동 이동 / 알림 그룹화 / 매장 trust score)
**I1 워커 매칭 자동 이동**
- NotificationBell가 NEW_MATCH 새 알림 감지 → 800ms 후 router.push
- 워커만, 입력 포커스 중이면 차단

**I2 점주 알림 정리**
- NEW_MATCH retention 7일 → 1일
- WORKER_RATING retention 7일 → 3일
- hard limit 30건

**I3 매장 trust score 시프트 카드**
- WorkerShiftView.cafeTrustScore enrich
- 워커 시프트 카드: 작은 뱃지 (null이면 숨김)

### 15라운드 — J (1탭 재고용 + admin 보건증)
**J1 ShiftInvitation 도메인**
- shift × worker × owner × message × status × expiresAt
- InvitationStatus: PENDING/ACCEPTED/REJECTED/EXPIRED/CANCELED
- ShiftInvitationService — create/accept/reject + @Scheduled 만료 처리
- accept 시 ShiftMatch 자동 생성 + Shift MATCHED 전이 + 양측 푸시
- POST /api/owner/shift-invitations + /api/worker/invitations + accept/reject

**J2 점주 초대 UI**
- worker-pool 카드에 "📨 시프트 직접 제안" 버튼
- InviteModal — OPEN 시프트 픽 + 메시지 + 마감 (30/60/120/240분)

**J3 워커 초대 응답**
- 신규 `worker/invitations.tsx` — PENDING 초대 + 1탭 수락/거절
- 수락 시 `/worker/matches?focus=...` 자동 진입
- WorkerHomeWidgets 상단 큰 파란 배너

**J4/J5 admin 보건증 리뷰**
- 자동 VERIFY 끄고 PENDING 유지
- /api/admin/health-certs 리스트 + verify/reject 엔드포인트
- HealthCertReviewItem DTO
- 신규 `app/admin/health-certs.tsx` — 보건증 이미지 + 인증/거부 인라인
- admin/kpi 화면에서 진입 버튼

### 16라운드 — K (점주 정산 탭)
- PayoutRepository.findAllByOwnerId
- PayoutResponse.workerName 추가
- GET /api/owner/payouts
- 신규 `app/owner/payouts.tsx`:
  - 헤더 KPI: 이번달 총 지출 + 승인 대기 건수 + 30분 입금 SLA 충족률
  - 상태 필터 칩 (전체/승인 대기/진행중/완료)
  - 카드: 임금/수수료/순수령액 분해 + 자동/명시 승인 + elapsed
  - REQUESTED 상태에 황금 borderLeft + "정산 승인 + 평가" 큰 버튼
  - 우상단 "📄 월간 명세" 빠른 진입
- 탭바: 시프트/등록/매장/정산 (4개), 월간명세는 hidden
- ⚠️ **버그 수정**: RatingModal.notify가 native에서 silent였음 → Alert.alert 추가. 이전엔 모바일에서 에러 시 화면 변화 없어서 "안 됨" 으로 보였을 가능성 큼

### 진단된 잠재 이슈 (점주 정산 승인 + 평가)
- RatingModal native silent notify (수정 완료)
- PushNotificationService @Async 후 ResultSet closed 에러 (응답엔 영향 없음, 푸시만 실패)
- gross=0 — 워커가 체크인 직후 즉시 체크아웃하면 분 단위로 0 (실 운영 시 문제 없음)

### 검증
- 백엔드 mvnw compile ✅ (122 source files, J 라운드 기준)
- 클라 tsc --noEmit 0 errors
- 백엔드 K 라운드 컴파일 통과 (122 + 알파)

### 외부 의존 (미해결)
- AWS S3 IAM 키 무효화 (채팅에 노출됨)
- 카카오 native deep-link 콘솔 등록 — http(s) 전용이라 브리지 페이지 필요
- Toss/오픈뱅킹 PG (현재 mock COMPLETED)
- EAS 빌드 셋업 (Expo Go에선 푸시 토큰 unavailable)
- application-prod.yml + Flyway (운영 마이그레이션)

---

## 📋 남은 작업 항목 (우선순위 순)

### P0 — 검증·테스트 (인프라 완성)
- [ ] **점주 정산 승인 + 평가 동작 검증** — Alert 노출되어 진짜 에러 메시지 확인
- [ ] AWS S3 IAM 키 폐기 + 새 키 발급 (보안)
- [ ] 시드 데이터 다양화 — 시프트·매칭·체크인/아웃·정산·평가·분쟁 다양한 케이스 (skima.seed.create-shifts-and-apps=true 활용)
- [ ] 모바일 실 단말 검증 (현재 Expo Go LAN)

### P1 — 사용자 가치 큰 미구현
- [ ] **카카오 Local API 매장 검색** — 옵션 A (검색+자동채움) 1~2시간
- [ ] 카카오 지도 시각화 — 옵션 B (3~5시간)
- [ ] **점주 측 분쟁 신고 UI** — 현재 워커만 가능 (owner/shift/[id] 카드에 "이의 제기" 버튼)
- [ ] **분쟁 자동 판정 cron** — DisputeService.autoResolve를 매시간 실행 (현재 admin 수동 호출만)
- [ ] **매장 사진을 워커 시프트 카드에 노출** — 현재 cafe/[id] 진입해야 보임
- [ ] **시프트 추천 알고리즘** — 거리+시급+평점+이력 종합 점수로 정렬

### P2 — 운영 인프라
- [ ] EAS 빌드 셋업 (Expo Go 졸업)
- [ ] Apple Developer + Google Play Console 계정
- [ ] 카카오 콘솔 native redirect URI (브리지 페이지 호스팅 또는 SDK 전환)
- [ ] Toss/오픈뱅킹 실 연동 (PG 키 + 송금 API)
- [ ] application-prod.yml + Flyway
- [ ] Railway 배포 (서버) + 도메인
- [ ] CDN 또는 R2 마이그레이션 (S3 비용)

### P3 — 폴리시·완성도
- [ ] 매출/세무 화면 강화 (statement 토글·추세 차트·PDF)
- [ ] 시프트 템플릿 추가 기능 (1탭 빠른 적용 vs 자동 cron)
- [ ] 스켈레톤 로딩 화면 더 많은 곳에 적용
- [ ] 추천 코드/친구 초대 (K-factor)
- [ ] KakaoTalk 시프트 공유
- [ ] 알바 이력서 PDF 자동 생성

### P4 — 알려진 버그·잔불
- [ ] PushNotificationService @Async ResultSet closed 에러 (lazy load 후 transaction 종료)
- [ ] gross=0 정산 발생 시 안내 (체크인 직후 체크아웃 케이스 — 운영 영향 적음)
- [ ] 카카오 로그인 콘솔 등록 미완 (saju 키 공유 dev only)

### 🔒 보안 액션 (즉시)
- [ ] **AWS IAM 사용자 `skimabyte-profile-s3-user` 액세스 키 비활성화 + 삭제**
  - AKIAW7WYAVZMXZUV6MFB 키가 채팅에 노출됨
  - AWS 콘솔 → IAM → 사용자 → 보안 자격증명 → 삭제 후 새 키 발급
  - PowerShell `$env:AWS_ACCESS_KEY_ID` 로 다시 설정 후 백엔드 재시작
