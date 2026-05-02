import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, makeBasicAuthHeader } from './api';
import { KAKAO_REDIRECT_URI } from './config';
import { clearAuth, loadAuth, saveAuth, StoredAuth } from './storage';

type AuthContextValue = {
  auth: StoredAuth | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<StoredAuth>;
  loginWithKakao: (code: string) => Promise<StoredAuth>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type MeResponse = {
  id: number;
  username: string;
  name: string;
  role: 'OWNER' | 'WORKER' | 'ADMIN';
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await loadAuth();
      setAuth(stored);
      setLoading(false);
    })();
  }, []);

  async function login(username: string, password: string): Promise<StoredAuth> {
    const basicHeader = makeBasicAuthHeader(username, password);
    const me = await api<MeResponse>('/api/me', { basicHeader });
    const next: StoredAuth = {
      username: me.username,
      name: me.name,
      role: me.role,
      id: me.id,
      basicHeader,
    };
    await saveAuth(next);
    setAuth(next);
    return next;
  }

  async function loginWithKakao(code: string): Promise<StoredAuth> {
    type KakaoLoginResponse = {
      basicHeader: string;
      user: { id: number; username: string; name: string; role: 'OWNER' | 'WORKER' | 'ADMIN' };
    };
    const res = await api<KakaoLoginResponse>('/api/auth/kakao/login', {
      method: 'POST',
      body: { code, redirectUri: KAKAO_REDIRECT_URI },
    });
    const next: StoredAuth = {
      username: res.user.username,
      name: res.user.name,
      role: res.user.role,
      id: res.user.id,
      basicHeader: res.basicHeader,
    };
    await saveAuth(next);
    setAuth(next);
    return next;
  }

  async function logout() {
    await clearAuth();
    setAuth(null);
  }

  return (
    <AuthContext.Provider value={{ auth, loading, login, loginWithKakao, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
