import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { buildKakaoAuthorizeUrl, KAKAO_REDIRECT_URI } from '@/lib/config';
import { colors, radius, spacing, styles } from '@/lib/theme';

const SEED_ACCOUNTS: { id: string; label: string; sub: string; tag: string }[] = [
  { id: 'worker1', label: '워커1', sub: '단기 알바 (4명 더)', tag: 'WORKER' },
  { id: 'owner1', label: '점주김씨', sub: '메가커피 강남역점', tag: 'OWNER' },
  { id: 'admin', label: '관리자', sub: 'KPI 대시보드', tag: 'ADMIN' },
];

export default function LoginScreen() {
  const { login, loginWithKakao } = useAuth();
  const [username, setUsername] = useState('worker1');
  const [password, setPassword] = useState('pw1234');
  const [busy, setBusy] = useState(false);

  /** Native 카카오 로그인 — expo-web-browser 인증 세션 + skima:// deep-link */
  async function handleKakaoNative() {
    setBusy(true);
    try {
      const authUrl = buildKakaoAuthorizeUrl();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, KAKAO_REDIRECT_URI);
      if (result.type !== 'success' || !result.url) {
        return; // 사용자 취소
      }
      const parsed = Linking.parse(result.url);
      const code = (parsed.queryParams?.code as string | undefined) ?? null;
      if (!code) {
        showError('카카오 응답에서 code 를 받지 못했습니다');
        return;
      }
      const auth = await loginWithKakao(code);
      if (auth.role === 'OWNER') router.replace('/owner/shifts');
      else if (auth.role === 'WORKER') router.replace('/worker/home');
      else router.replace('/admin/kpi');
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(u?: string, p?: string) {
    const usr = (u ?? username).trim();
    const pwd = p ?? password;
    if (!usr || !pwd) {
      showError('아이디와 비밀번호를 입력해주세요');
      return;
    }
    setBusy(true);
    try {
      const auth = await login(usr, pwd);
      if (auth.role === 'OWNER') router.replace('/owner/shifts');
      else if (auth.role === 'WORKER') router.replace('/worker/home');
      else router.replace('/admin/kpi');
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? '아이디 또는 비밀번호가 올바르지 않습니다'
          : (e as Error).message;
      showError(msg);
    } finally {
      setBusy(false);
    }
  }

  function showError(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('로그인 실패', msg);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 80, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 36 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 32 }}>⚡</Text>
          </View>
          <Text style={styles.h1}>스키마 바이트</Text>
          <Text style={[styles.subtitle, { marginTop: 6, fontSize: 14 }]}>
            1시간 매칭 · 30분 입금
          </Text>
        </View>

        <Text style={[styles.subtitle, { marginBottom: 6 }]}>아이디</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="username"
          placeholderTextColor={colors.textLight}
        />

        <Text style={[styles.subtitle, { marginBottom: 6 }]}>비밀번호</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••"
          placeholderTextColor={colors.textLight}
        />

        <Pressable
          style={({ pressed }) => [
            styles.buttonPrimary,
            { marginTop: 8 },
            (busy || pressed) && { opacity: 0.85 },
          ]}
          onPress={() => handleLogin()}
          disabled={busy}
        >
          <Text style={styles.buttonPrimaryText}>{busy ? '로그인 중...' : '로그인'}</Text>
        </Pressable>

        {/* 카카오 로그인 (워커 전용) */}
        <Pressable
          style={({ pressed }) => [
            {
              marginTop: 10,
              backgroundColor: '#FEE500',
              borderRadius: radius.md,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            },
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.location.href = buildKakaoAuthorizeUrl();
            } else {
              handleKakaoNative();
            }
          }}
          disabled={busy}
        >
          <Text style={{ fontSize: 16 }}>💬</Text>
          <Text style={{ color: '#191919', fontSize: 14, fontWeight: '800' }}>
            카카오로 시작하기 (워커)
          </Text>
        </Pressable>
        <Text style={{ marginTop: 6, fontSize: 11, color: colors.textLight, textAlign: 'center' }}>
          첫 로그인 시 자동으로 워커 계정이 생성됩니다
        </Text>

        <View style={{ marginTop: 36 }}>
          <Text style={[styles.subtitle, { marginBottom: 12 }]}>빠른 로그인 (시드 계정)</Text>
          <View style={{ gap: 10 }}>
            {SEED_ACCOUNTS.map((acc) => (
              <Pressable
                key={acc.id}
                onPress={() => handleLogin(acc.id, 'pw1234')}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.lg,
                  },
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>
                    {acc.tag === 'WORKER' ? 'W' : acc.tag === 'OWNER' ? 'O' : 'A'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }}>{acc.label}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{acc.sub}</Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{acc.tag}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ marginTop: 12, fontSize: 11, color: colors.textLight, textAlign: 'center' }}>
            모든 시드 계정 비밀번호: pw1234
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
