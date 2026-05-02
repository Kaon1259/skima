import { useEffect, type ReactNode } from 'react';
import { router } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { Splash } from './Splash';

type Props = {
  role?: 'OWNER' | 'WORKER' | 'ADMIN';
  children: ReactNode;
};

export function AuthGate({ role, children }: Props) {
  const { auth, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!auth) {
      router.replace('/');
      return;
    }
    if (role && auth.role !== role) {
      // 역할 불일치 — 본인 영역으로
      if (auth.role === 'OWNER') router.replace('/owner/shifts');
      else if (auth.role === 'WORKER') router.replace('/worker/shifts');
      else router.replace('/admin/kpi');
    }
  }, [auth, loading, role]);

  if (loading) return <Splash message="불러오는 중..." />;
  if (!auth) return <Splash message="로그인 화면으로 이동" />;
  if (role && auth.role !== role) return <Splash message="권한 확인 중..." />;
  return <>{children}</>;
}
