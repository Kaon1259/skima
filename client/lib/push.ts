import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { api } from '@/lib/api';

// Expo Go (SDK 53+) 부터 expo-notifications 의 푸시 토큰 API 가 throw —
// 모듈 자체를 import 하기만 해도 자동 등록 fx 가 ERROR 를 던져 앱 부팅이 막힘.
// → Expo Go 환경에서는 모듈 자체를 require 하지 않고, native dev build / standalone 에서만 활성화.
const isExpoGo = Constants.appOwnership === 'expo';
const supportsPush = !isExpoGo && Platform.OS !== 'web';

// dynamic require — Expo Go 분기에서는 init 코드가 실행되지 않아 ERROR 도 나오지 않음
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
if (supportsPush) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Device = require('expo-device');
}

let configured = false;

/** 앱 시작 시 1회 — 푸시 알림 표시 핸들러 셋업. Expo Go / web 에서는 no-op. */
export function setupPushHandler() {
  if (!Notifications) return;
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
 * Web / Expo Go 에서는 no-op — native dev build / production 빌드에서만 토큰 발급.
 */
export function usePushRegistration(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!Notifications || !Device) return;
    if (!Device.isDevice) return;
    let cancelled = false;
    (async () => {
      try {
        const { status: existing } = await Notifications!.getPermissionsAsync();
        let status = existing;
        if (existing !== 'granted') {
          const r = await Notifications!.requestPermissionsAsync();
          status = r.status;
        }
        if (status !== 'granted') return;

        if (Platform.OS === 'android') {
          await Notifications!.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications!.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FFA500',
          });
        }

        const projectId =
          (Constants.expoConfig as any)?.extra?.eas?.projectId
          ?? (Constants.easConfig as any)?.projectId;
        const tokenRes = projectId
          ? await Notifications!.getExpoPushTokenAsync({ projectId })
          : await Notifications!.getExpoPushTokenAsync();

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

/** 사용자가 푸시를 탭했을 때 라우트로 이동. Expo Go / web 에서는 no-op. */
export function usePushTapNavigation() {
  useEffect(() => {
    if (!Notifications) return;
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
