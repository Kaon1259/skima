# Skima Byte client — Expo Router (web.output=static) → static SPA on Railway.
# 1) Node 20 빌더에서 `npx expo export -p web` 으로 dist/ 생성
# 2) Node 20 alpine 에 `serve` 만 깔아 dist/ 정적 서빙. Railway PORT env 사용.

FROM node:20-alpine AS builder
WORKDIR /workspace

# 의존성 캐시 — package*.json 변경 없으면 install 스킵
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# 소스 복사 + 빌드
COPY . .

# 빌드 시점에 API base 를 Railway 서버로 고정 (config.ts 의 INITIAL_CHOICE 가 'railway' 로 박힘)
# 운영 시 별도 도메인이 생기면 Railway Variables 에서 override.
ARG EXPO_PUBLIC_API_BASE=https://skima-production.up.railway.app
ENV EXPO_PUBLIC_API_BASE=$EXPO_PUBLIC_API_BASE

RUN npx expo export -p web

# 런타임 — 정적 서빙만 필요
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=builder /workspace/dist ./dist

# Railway 가 PORT env 주입. -s = SPA fallback (동적 라우트 지원).
ENV PORT=8081
EXPOSE 8081
CMD ["sh","-c","serve -s dist -l ${PORT}"]
