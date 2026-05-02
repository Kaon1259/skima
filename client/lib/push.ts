import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { api } from '@/lib/api';

let configured = false;

/** 앱 시작 시 1회 — 푸시 알림 표시 핸들러 셋업 */
export function setupPushHandler() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * 로그인된 사용자 디바이스에서 푸시 토큰 발급 + 백엔드 등록.
 * Web 에서는 동작 안 함. Expo Go 환경에서는 development 토큰 발급됨.
 */
export function usePushRegistration(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') return;
    if (!Device.isDevice) return; // 시뮬레이터/에뮬레이터 제외
    let cancelled = false;
    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== 'granted') {
          const r = await Notifications.requestPermissionsAsync();
          status = r.status;
        }
        if (status !== 'granted') return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FFA500',
          });
        }

        const projectId =
          (Constants.expoConfig as any)?.extra?.eas?.projectId
          ?? (Constants.easConfig as any)?.projectId;
        const tokenRes = projectId
          ? await Notifications.getExpoPushTokenAsync({ projectId })
          : await Notifications.getExpoPushTokenAsync();

        if (cancelled) return;
        const token = tokenRes.data;
        if (token) {
          await api('/api/me/push-token', { method: 'POST', body: { token } });
        }
      } catch (e) {
        if (__DEV__) console.warn('[push] 등록 실패:', (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}

/** 사용자가 푸시를 탭했을 때 라우트로 이동 */
export function usePushTapNavigation() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route as string | undefined;
      if (route) {
        try {
          router.push(route as never);
        } catch (e) {
          if (__DEV__) console.warn('[push] 네비게이션 실패:', e);
        }
      }
    });
    return () => sub.remove();
  }, []);
}
