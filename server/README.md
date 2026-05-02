# Skima Byte — MVP 서버

킥("1시간 매칭, 30분 입금")을 정량 측정 가능한 형태로 구현한 백엔드 MVP.

## 스택
- Spring Boot 3.5 / Java 17 / Maven Wrapper
- Spring Web, Data JPA, Validation, Security (HTTP Basic)
- MySQL 8 (`localhost:3306/skima_byte`, root/1111)
- Lombok

## 실행
```bash
cd C:/Programs/skima/server
./mvnw spring-boot:run
```
포트 `8090`. 첫 실행 시 JPA가 테이블 자동 생성 + 시드 데이터 주입.

## 시드 계정 (모두 비번 `pw1234`)
- `admin` (ADMIN) / `owner1`, `owner2` (OWNER) / `worker1`~`worker5` (WORKER)

## 핵심 흐름 (curl)

```bash
B=http://localhost:8090

# 1) 워커 1탭 지원
curl -u worker1:pw1234 -X POST $B/api/worker/shifts/1/apply

# 2) 점주 ACCEPT (= 매칭 SLA 측정 종료점)
curl -u owner1:pw1234 $B/api/owner/shifts/1/applications
curl -u owner1:pw1234 -X POST $B/api/owner/applications/1/accept

# 3) 워커 출/퇴근 — 체크아웃 시 Payout 자동 SCHEDULED
curl -u worker1:pw1234 -X POST $B/api/worker/matches/1/check-in
curl -u worker1:pw1234 -X POST $B/api/worker/matches/1/check-out

# 4) 스케줄러는 매분 자동 처리. 즉시 실행:
curl -u admin:pw1234 -X POST $B/api/admin/payouts/run

# 5) 북극성 KPI
curl -u admin:pw1234 "$B/api/admin/kpi?sinceDays=30"
```

## 비즈니스 룰 (`application.yml`의 `skima.*`)
- 매칭 SLA: **60분** (= shift.created_at ~ shift.matched_at)
- 입금 SLA: **30분** (= payout.trigger_at(=check_out_at) ~ payout.completed_at)
- 점주 수수료: 임금의 **12%**
- 일용근로 원천징수: 일급 **15만원 미만 0원, 이상 6.6%**

## 도메인 모델
```
User(role=OWNER/WORKER/ADMIN) → Cafe(owner=User) → Shift(cafe)
                                                      ↓
                                              ShiftApplication(worker)
                                                      ↓ accept
                                                 ShiftMatch
                                                      ↓ checkOut
                                                   Payout
```

## 패키지 구조
- `domain/` — JPA 엔티티 + 상태 enum 5종
- `repository/` — Spring Data JPA + KPI 집계 native query
- `service/` — Shift/Application/CheckInOut/Payout/Kpi
- `controller/` — Owner/Worker/Admin/Me
- `security/` — Basic Auth + UserDetails
- `scheduler/` — 매분 정산 트리거
- `config/` — Security, SkimaProperties, DataSeeder
- `common/` — BusinessException, GlobalExceptionHandler
