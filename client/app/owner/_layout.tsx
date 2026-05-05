import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import BrandMark from '@/components/BrandMark';
import HeaderLogout from '@/components/HeaderLogout';
import { Icon } from '@/components/Icon';
import NotificationBell from '@/components/NotificationBell';
import { api } from '@/lib/api';
import { OwnerShift } from '@/lib/types';
import { colors } from '@/lib/theme';

const isWeb = Platform.OS === 'web';

/** 활성 시프트 여부 — MATCHED 또는 IN_PROGRESS. 30초마다 폴링. */
function useHasActiveShift(): boolean {
  const [hasActive, setHasActive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const shifts = await api<OwnerShift[]>('/api/owner/shifts', { silentNetwork: true });
        if (cancelled) return;
        setHasActive(shifts.some((s) => s.status === 'MATCHED' || s.status === 'IN_PROGRESS'));
      } catch {
        // 조용히 실패
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
  name: 'list' | 'add-circle' | 'cafe' | 'wallet';
  /** true 면 unfocused 일 때 펄스 + 우상단 도트 */
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

export default function OwnerLayout() {
  const hasActiveShift = useHasActiveShift();
  return (
    <AuthGate role="OWNER">
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
              <NotificationBell role="owner" />
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
              <TabIconWithIndicator focused={focused} size={size} name="list" pulse={hasActiveShift} />
            ),
          }}
        />
        <Tabs.Screen
          name="new-shift"
          options={{
            title: '시프트 등록',
            tabBarIcon: ({ focused, size }) => (
              <TabIconWithIndicator focused={focused} size={size} name="add-circle" />
            ),
          }}
        />
        <Tabs.Screen
          name="cafes"
          options={{
            title: '내 매장',
            tabBarIcon: ({ focused, size }) => (
              <TabIconWithIndicator focused={focused} size={size} name="cafe" />
            ),
          }}
        />
        <Tabs.Screen
          name="payouts"
          options={{
            title: '정산',
            tabBarIcon: ({ focused, size }) => (
              <TabIconWithIndicator focused={focused} size={size} name="wallet" />
            ),
          }}
        />
        <Tabs.Screen name="statement" options={{ href: null, title: '월간명세' }} />
        <Tabs.Screen name="shift/[id]" options={{ href: null, title: '지원자' }} />
        <Tabs.Screen name="contract/[matchId]" options={{ href: null, title: '근로계약서' }} />
        <Tabs.Screen name="withholding/[matchId]" options={{ href: null, title: '원천징수영수증' }} />
        <Tabs.Screen name="dashboard/[status]" options={{ href: null, title: '대시보드 상세' }} />
        {/* 시프트 sub-section 들 — 상단 헤더 타이틀은 부모인 "시프트" 로 고정. 내부 화면이 자체 H2 로 구분 */}
        <Tabs.Screen name="history" options={{ href: null, title: '시프트' }} />
        <Tabs.Screen name="worker-pool" options={{ href: null, title: '시프트' }} />
        <Tabs.Screen name="shift-templates" options={{ href: null, title: '시프트' }} />
        <Tabs.Screen name="disputes" options={{ href: null, title: '이의 제기 내역' }} />
      </Tabs>
    </AuthGate>
  );
}
