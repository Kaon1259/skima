import { API_BASE_URL } from './config';
import { loadAuth } from './storage';

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

export async function api<T = unknown>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = 'GET', body, basicHeader } = opts;

  // basicHeader 직접 받거나 저장된 거 사용
  let auth = basicHeader;
  if (!auth) {
    const stored = await loadAuth();
    auth = stored?.basicHeader;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth) headers['Authorization'] = auth;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
}
