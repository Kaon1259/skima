import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/auth';
import { setupPushHandler, usePushRegistration, usePushTapNavigation } from '@/lib/push';
import { ToastProvider } from '@/lib/toast';
import { colors } from '@/lib/theme';

setupPushHandler();

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.surfaceAlt,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.primary,
  },
};

const initialMetrics = {
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

function PushBridge() {
  const { auth } = useAuth();
  usePushRegistration(!!auth);
  usePushTapNavigation();
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={Platform.OS === 'web' ? initialMetrics : undefined}>
      <AuthProvider>
        <PushBridge />
        <ToastProvider>
        <ThemeProvider value={NavTheme}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700', fontSize: 17 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.surfaceAlt },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="auth/kakao/callback" options={{ headerShown: false, title: '카카오 로그인' }} />
            <Stack.Screen name="worker" options={{ headerShown: false }} />
            <Stack.Screen name="owner" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="cafe/[id]" options={{ title: '매장 상세' }} />
            <Stack.Screen name="u/[id]" options={{ title: '워커 프로필' }} />
            <Stack.Screen name="contract/[matchId]" options={{ title: '근로계약서' }} />
            <Stack.Screen name="withholding/[matchId]" options={{ title: '원천징수영수증' }} />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
