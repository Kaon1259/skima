import { Tabs } from 'expo-router';

import { Platform, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import HeaderLogout from '@/components/HeaderLogout';
import { Icon } from '@/components/Icon';
import NotificationBell from '@/components/NotificationBell';
import { colors } from '@/lib/theme';

const isWeb = Platform.OS === 'web';

export default function OwnerLayout() {
  return (
    <AuthGate role="OWNER">
      <Tabs
        {...(isWeb && { safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 } })}
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800', fontSize: 18 },
          headerShadowVisible: false,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <NotificationBell role="owner" />
              <HeaderLogout />
            </View>
          ),
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            ...(isWeb ? { height: 60, paddingTop: 6, paddingBottom: 6 } : { paddingTop: 6 }),
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textLight,
        }}
      >
        <Tabs.Screen
          name="shifts"
          options={{
            title: '시프트',
            tabBarIcon: ({ size }) => <Icon name="list" size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="new-shift"
          options={{
            title: '시프트 등록',
            tabBarIcon: ({ size }) => <Icon name="add-circle" size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="cafes"
          options={{
            title: '내 매장',
            tabBarIcon: ({ size }) => <Icon name="cafe" size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="statement"
          options={{
            title: '월간명세',
            tabBarIcon: ({ size }) => <Icon name="document" size={size ?? 22} />,
          }}
        />
        <Tabs.Screen name="shift/[id]" options={{ href: null, title: '지원자' }} />
        <Tabs.Screen name="contract/[matchId]" options={{ href: null, title: '근로계약서' }} />
        <Tabs.Screen name="withholding/[matchId]" options={{ href: null, title: '원천징수영수증' }} />
        <Tabs.Screen name="dashboard/[status]" options={{ href: null, title: '대시보드 상세' }} />
        <Tabs.Screen name="history" options={{ href: null, title: '시프트 히스토리' }} />
        <Tabs.Screen name="worker-pool" options={{ href: null, title: '워커 풀' }} />
      </Tabs>
    </AuthGate>
  );
}
