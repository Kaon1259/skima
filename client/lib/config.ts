import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { storage } from './storage';

// 웹 미리보기는 같은 호스트(localhost)에서, 폰(Expo Go)은 PC LAN IP로 접근
// LAN IP가 바뀌면 여기만 수정
const LAN_HOST = '192.168.0.3';
const PORT = 8090;

export const LOCAL_API_BASE =
  Platform.OS === 'web'
    ? `http://localhost:${PORT}`
    : `http://${LAN_HOST}:${PORT}`;

/** Railway 배포 서버 — 운영 단계에 도메인 변경 시 여기만 수정 */
export const RAILWAY_API_BASE = 'https://skima-production.up.railway.app';

export type ApiBaseChoice = 'local' | 'railway';

const STORAGE_KEY = 'skima.apiBase';

// EXPO_PUBLIC_API_BASE env 가 빌드 시점에 박혀있으면 초기 기본값 (override 가능). 미설정 시 'local'.
const ENV_API_BASE = process.env.EXPO_PUBLIC_API_BASE;
const INITIAL_CHOICE: ApiBaseChoice =
  ENV_API_BASE && ENV_API_BASE.includes('railway') ? 'railway' : 'local';

let currentChoice: ApiBaseChoice = INITIAL_CHOICE;
const listeners = new Set<() => void>();

export function getApiBase(): string {
  return currentChoice === 'railway' ? RAILWAY_API_BASE : LOCAL_API_BASE;
}

export function getApiBaseChoice(): ApiBaseChoice {
  return currentChoice;
}

/** 토글 — 메모리 + storage 갱신 + 구독자 통보 */
export async function setApiBaseChoice(choice: ApiBaseChoice): Promise<void> {
  currentChoice = choice;
  await storage.set(STORAGE_KEY, choice);
  listeners.forEach((l) => l());
}

/** 앱 부팅 시 한 번 호출 — 저장된 선택을 메모리로 끌어옴 */
export async function hydrateApiBase(): Promise<void> {
  try {
    const stored = await storage.get(STORAGE_KEY);
    if (stored === 'local' || stored === 'railway') {
      currentChoice = stored;
      listeners.forEach((l) => l());
    }
  } catch {
    // 조용히 실패 — 기본값 그대로
  }
}

export function subscribeApiBase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 컴포넌트에서 API base 변경을 감지 + UI 리렌더 — 로그인 화면 토글에 사용 */
export function useApiBaseChoice(): [ApiBaseChoice, (c: ApiBaseChoice) => Promise<void>] {
  const [choice, setChoice] = useState<ApiBaseChoice>(getApiBaseChoice());
  useEffect(() => {
    return subscribeApiBase(() => setChoice(getApiBaseChoice()));
  }, []);
  return [choice, setApiBaseChoice];
}

/** 하위 호환 — 기존 import 처들 위해 유지. 단 토글 후 재import 안 됨, 새 코드는 getApiBase() 사용 */
export const API_BASE_URL = getApiBase();

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
