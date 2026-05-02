import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// 웹은 localStorage, 네이티브는 SecureStore — 동일 인터페이스
export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const AUTH_KEY = 'skima.auth';

export type StoredAuth = {
  username: string;
  basicHeader: string;
  role: 'OWNER' | 'WORKER' | 'ADMIN';
  name: string;
  id: number;
};

export async function loadAuth(): Promise<StoredAuth | null> {
  const raw = await storage.get(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export async function saveAuth(auth: StoredAuth): Promise<void> {
  await storage.set(AUTH_KEY, JSON.stringify(auth));
}

export async function clearAuth(): Promise<void> {
  await storage.remove(AUTH_KEY);
}
