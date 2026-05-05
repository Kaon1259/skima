import { Tabs } from 'expo-router';

import { Platform, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import BrandMark from '@/components/BrandMark';
import HeaderLogout from '@/components/HeaderLogout';
import { Icon } from '@/components/Icon';
import NotificationBell from '@/components/NotificationBell';
import { colors } from '@/lib/theme';

const isWeb = Platform.OS === 'web';

function TabIconWithIndicator({
  focused,
  size,
  name,
}: {
  focused: boolean;
  size?: number;
  name: 'list' | 'add-circle' | 'cafe' | 'wallet';
}) {
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
      <Icon name={name} size={size ?? 22} color={focused ? colors.primary : colors.textLight} />
    </View>
  );
}

export default function OwnerLayout() {
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
              <TabIconWithIndicator focused={focused} size={size} name="list" />
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
        <Tabs.Screen name="history" options={{ href: null, title: '시프트 히스토리' }} />
        <Tabs.Screen name="worker-pool" options={{ href: null, title: '워커 풀' }} />
        <Tabs.Screen name="shift-templates" options={{ href: null, title: '시프트 템플릿' }} />
      </Tabs>
    </AuthGate>
  );
}
