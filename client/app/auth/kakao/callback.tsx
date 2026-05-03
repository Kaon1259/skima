import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { colors, spacing, styles } from '@/lib/theme';

/**
 * Kakao OAuth 콜백 — 카카오에서 ?code=... 또는 ?error=... 으로 리다이렉트.
 * 코드를 받아 백엔드에 전달하여 워커 계정 upsert + basicHeader 발급.
 */
export default function KakaoCallback() {
  const { loginWithKakao } = useAuth();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState<'busy' | 'error'>('busy');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 카카오 콘솔에서 사용자가 거부하거나 동의 화면 자체에서 에러
      if (params.error || !params.code) {
        if (!cancelled) {
          setErrorMsg(params.error_description || params.error || '인가 코드가 없습니다');
          setStatus('error');
        }
        return;
      }
      try {
        const auth = await loginWithKakao(String(params.code));
        if (cancelled) return;
        if (auth.role === 'WORKER') router.replace('/worker/shifts');
        else router.replace('/');
      } catch (e) {
        if (cancelled) return;
        setErrorMsg((e as Error).message);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [params.code, params.error, params.error_description, loginWithKakao]);

  return (
    <View style={{ flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      {status === 'busy' ? (
        <>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>💬</Text>
          <Text style={[styles.h2, { textAlign: 'center' }]}>카카오 로그인 중...</Text>
          <Text style={[styles.subtitle, { marginTop: 6, textAlign: 'center' }]}>
            잠시만 기다려주세요
          </Text>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
          <Text style={[styles.h2, { textAlign: 'center', color: colors.danger }]}>로그인 실패</Text>
          <Text style={[styles.subtitle, { marginTop: 6, textAlign: 'center', maxWidth: 320 }]}>
            {errorMsg || '알 수 없는 오류가 발생했습니다'}
          </Text>
          <Pressable
            style={[styles.buttonPrimary, { marginTop: 20, paddingHorizontal: 28 }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.buttonPrimaryText}>로그인 화면으로</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

