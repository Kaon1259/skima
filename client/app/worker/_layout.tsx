import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import BrandMark from '@/components/BrandMark';
import HeaderLogout from '@/components/HeaderLogout';
import { Icon } from '@/components/Icon';
import NotificationBell from '@/components/NotificationBell';
import { api } from '@/lib/api';
import { ShiftMatch } from '@/lib/types';
import { colors } from '@/lib/theme';

const isWeb = Platform.OS === 'web';

/** 활성 매칭 여부 — MATCHED 또는 CHECKED_IN. 30초마다 폴링. */
function useHasActiveMatch(): boolean {
  const [hasActive, setHasActive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const matches = await api<ShiftMatch[]>('/api/worker/matches', { silentNetwork: true });
        if (cancelled) return;
        setHasActive(matches.some((m) => m.status === 'MATCHED' || m.status === 'CHECKED_IN'));
      } catch {
        // 조용히 실패 — 다음 polling 에서 재시도
      }
    }
    check();
    const t = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  return hasActive;
}

function TabIconWithIndicator({
  focused,
  size,
  name,
  pulse,
}: {
  focused: boolean;
  size?: number;
  name: 'flash' | 'checkmark-circle' | 'wallet' | 'user';
  /** true 면 unfocused 상태일 때 펄스 애니메이션 + 우상단 도트 노출 */
  pulse?: boolean;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const shouldPulse = !!pulse && !focused;

  useEffect(() => {
    if (!shouldPulse) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => { loop.stop(); };
  }, [shouldPulse, opacity, scale]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'flex-start', height: 28 }}>
      <View
        style={{
          height: 3,
          width: 22,
          borderRadius: 999,
          backgroundColor: focused ? colors.primary : 'transparent',
          marginBottom: 4,
        }}
      />
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Icon
          name={name}
          size={size ?? 22}
          color={focused ? colors.primary : shouldPulse ? colors.primary : colors.textLight}
        />
        {shouldPulse ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.danger,
              borderWidth: 1,
              borderColor: '#fff',
            }}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

export default function WorkerLayout() {
  const hasActiveMatch = useHasActiveMatch();
  return (
    <AuthGate role="WORKER">
      <Tabs
      {...(isWeb && { safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 } })}
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary50 },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerShadowVisible: false,
        headerLeft: () => <BrandMark />,
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell role="worker" />
            <HeaderLogout />
          </View>
        ),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(isWeb ? { height: 64, paddingTop: 4, paddingBottom: 6 } : { paddingTop: 4 }),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
      }}
    >
      <Tabs.Screen
        name="shifts"
        options={{
          title: '시프트',
          tabBarIcon: ({ focused, size }) => (
            <TabIconWithIndicator focused={focused} size={size} name="flash" />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: '내 매칭',
          tabBarIcon: ({ focused, size }) => (
            <TabIconWithIndicator focused={focused} size={size} name="checkmark-circle" pulse={hasActiveMatch} />
          ),
        }}
      />
      <Tabs.Screen
        name="payouts"
        options={{
          title: '내 정산',
          tabBarIcon: ({ focused, size }) => (
            <TabIconWithIndicator focused={focused} size={size} name="wallet" />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '마이',
          tabBarIcon: ({ focused, size }) => (
            <TabIconWithIndicator focused={focused} size={size} name="user" />
          ),
        }}
      />
      <Tabs.Screen name="home" options={{ href: null, title: '홈' }} />
      <Tabs.Screen name="stats" options={{ href: null, title: '내 통계' }} />
      <Tabs.Screen name="profile" options={{ href: null, title: '내 프로필' }} />
      <Tabs.Screen name="documents" options={{ href: null, title: '내 문서' }} />
      <Tabs.Screen name="invitations" options={{ href: null, title: '점주 직접 호출' }} />
      <Tabs.Screen name="disputes" options={{ href: null, title: '이의 제기 내역' }} />
      </Tabs>
    </AuthGate>
  );
}
