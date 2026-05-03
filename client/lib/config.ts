import { Platform } from 'react-native';

// 웹 미리보기는 같은 호스트(localhost)에서, 폰(Expo Go)은 PC LAN IP로 접근
// LAN IP가 바뀌면 여기만 수정
const LAN_HOST = '192.168.0.3';
const PORT = 8090;

export const API_BASE_URL =
  Platform.OS === 'web'
    ? `http://localhost:${PORT}`
    : `http://${LAN_HOST}:${PORT}`;

// Kakao OAuth & Maps — 단바-Test 앱 (kaon1259@naver.com).
// 운영 전환 시 별도 앱 등록 + 여기 키 교체.
export const KAKAO_REST_API_KEY = '9894a16c6ba7e3fb64b86d40faba3602';
// Maps JS SDK 용 — 웹 카카오맵 임베드 (도메인 화이트리스트에 localhost:8081 등록 필요)
export const KAKAO_JS_KEY = '6503eacf18397d4ed687900cfc61bf6c';

// 콜백 URL — Kakao Developers 콘솔의 redirect URI 에 반드시 등록되어 있어야 함
// Web: http://localhost:8081/auth/kakao/callback (개발) — 운영은 도메인 등록 필요
// Native: skima://auth/kakao/callback (Expo deep-link)
export const KAKAO_REDIRECT_URI =
  Platform.OS === 'web'
    ? 'http://localhost:8081/auth/kakao/callback'
    : 'skima://auth/kakao/callback';

export function buildKakaoAuthorizeUrl(redirectUri?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: redirectUri ?? KAKAO_REDIRECT_URI,
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}
