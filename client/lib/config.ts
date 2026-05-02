import { Platform } from 'react-native';

// 웹 미리보기는 같은 호스트(localhost)에서, 폰(Expo Go)은 PC LAN IP로 접근
// LAN IP가 바뀌면 여기만 수정
const LAN_HOST = '192.168.0.3';
const PORT = 8090;

export const API_BASE_URL =
  Platform.OS === 'web'
    ? `http://localhost:${PORT}`
    : `http://${LAN_HOST}:${PORT}`;

// Kakao OAuth — saju 프로젝트와 동일 앱 키 공유.
// 운영 시에는 Skima 전용 Kakao 앱을 새로 만들고 여기 키만 교체.
export const KAKAO_REST_API_KEY = '08895d0f24c6adbdff9c85ee84469e88';

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
