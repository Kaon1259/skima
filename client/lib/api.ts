import { getApiBase } from './config';
import { loadAuth } from './storage';
import { pushToastGlobal } from './toast';

// 브라우저용 base64 (네이티브에선 RN의 global btoa 사용)
function base64Encode(input: string): string {
  if (typeof btoa === 'function') return btoa(input);
  // Fallback (네이티브 환경)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Buffer = require('buffer').Buffer;
  return Buffer.from(input, 'utf-8').toString('base64');
}

export function makeBasicAuthHeader(username: string, password: string): string {
  return 'Basic ' + base64Encode(`${username}:${password}`);
}

type ReqOpts = {
  method?: string;
  body?: unknown;
  basicHeader?: string;
  /** 네트워크 실패 시 자동 재시도 횟수 (디폴트 1) — 0이면 재시도 안 함 */
  retries?: number;
  /** 네트워크 실패 시 토스트 노출 여부 (디폴트 true). false 면 조용히 throw */
  silentNetwork?: boolean;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export class NetworkError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

let _lastNetworkToastAt = 0;

async function fetchOnce(path: string, opts: ReqOpts): Promise<Response> {
  const { method = 'GET', body, basicHeader } = opts;

  let auth = basicHeader;
  if (!auth) {
    const stored = await loadAuth();
    auth = stored?.basicHeader;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth) headers['Authorization'] = auth;

  return fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function api<T = unknown>(path: string, opts: ReqOpts = {}): Promise<T> {
  const retries = opts.retries ?? 1;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchOnce(path, opts);

      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'message' in data
            ? String((data as { message: unknown }).message)
            : `HTTP ${res.status}`;
        throw new ApiError(res.status, msg, data);
      }
      return data as T;
    } catch (e) {
      // ApiError(서버가 응답한 4xx/5xx)는 재시도 안 함, 즉시 throw
      if (e instanceof ApiError) throw e;

      // 네트워크 실패 — TypeError, AbortError, fetch 실패 등
      lastErr = e;
      if (attempt < retries) {
        // 짧은 백오프 후 한 번 재시도
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
    }
  }

  // 재시도 다 실패 — 토스트 + throw
  if (!opts.silentNetwork) {
    const now = Date.now();
    if (now - _lastNetworkToastAt > 3000) {
      _lastNetworkToastAt = now;
      pushToastGlobal({
        title: '⚠️ 네트워크 오류',
        subtitle: '서버에 연결할 수 없어요. 잠시 후 자동으로 다시 시도합니다',
        severity: 'warn',
        ttl: 4000,
      });
    }
  }
  throw new NetworkError('Network request failed', lastErr);
}
