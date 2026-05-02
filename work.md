# Skima Byte 작업 기록

작업 내용을 시간 순으로 누적 기록합니다. 각 세션 시작 시 본 파일을 확인하면 어디까지 진행됐는지 파악할 수 있습니다.

---

## 2026-05-02 — GitHub 최초 push (https://github.com/Kaon1259/skima)

### 결정사항 (사용자 확정)
- 저장소 가시성: **public**
- 카카오 시크릿 처리: `KAKAO_CLIENT_SECRET` 환경변수로만 주입, 디폴트값 제거 (A안)
- saju 프로젝트 같은 키 노출 여부 점검 요청 받음 → 별도 보고

### 진행 상황
1. **시크릿 디폴트값 제거** — `server/src/main/resources/application.yml:52-53`
   - `kakao.rest-api-key`, `kakao.client-secret` 둘 다 디폴트값 제거 → `${KAKAO_REST_API_KEY:}` / `${KAKAO_CLIENT_SECRET:}`
   - 로컬 실행 시 환경변수로 주입 필요. 카카오 로그인 동작시키려면 셸에서 `export KAKAO_REST_API_KEY=... KAKAO_CLIENT_SECRET=...` 또는 `application-local.yml` (gitignore 처리됨) 사용
2. **.gitignore 작성** — node_modules, target, .idea, .vscode, *.log, application-local.yml, .env*, build artifacts 등
3. **git init + 최초 commit + remote 등록 + push**

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

### 추가 결정 — Railway 배포 (예정)
- 백엔드는 Railway에 연결 예정. 다음 작업 시 필요한 변경:
  - `application.yml` datasource URL/username/password 도 환경변수화 (`${DB_URL}`, `${DB_USERNAME}`, `${DB_PASSWORD}`)
  - `ddl-auto: create` → 운영은 `validate` 또는 `none` + Flyway 마이그레이션 도입 검토
  - `seed.refresh-on-start` Railway 운영에서는 false 강제
  - Railway 환경변수 셋업: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`, DB 정보, `PORT` (Railway가 주입)
  - `server.port: 8090` → `${PORT:8090}` 으로 변경 (Railway는 PORT env로 주입)
  - 카카오 redirect URI: 운영 도메인용 추가 등록 필요 (`https://<railway-domain>/auth/kakao/callback`)
  - 클라이언트 `lib/config.ts` API_BASE_URL 도 Railway 도메인 가리키도록 환경 분기
