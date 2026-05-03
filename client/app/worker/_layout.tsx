import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import HeaderLogout from '@/components/HeaderLogout';
import { Icon } from '@/components/Icon';
import NotificationBell from '@/components/NotificationBell';
import { colors } from '@/lib/theme';

const isWeb = Platform.OS === 'web';

export default function WorkerLayout() {
  return (
    <AuthGate role="WORKER">
      <Tabs
      {...(isWeb && { safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 } })}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell role="worker" />
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
          tabBarIcon: ({ size }) => <Icon name="flash" size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: '내 매칭',
          tabBarIcon: ({ size }) => <Icon name="checkmark-circle" size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="payouts"
        options={{
          title: '내 정산',
          tabBarIcon: ({ size }) => <Icon name="wallet" size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '마이',
          tabBarIcon: ({ size }) => <Icon name="user" size={size ?? 22} />,
        }}
      />
      <Tabs.Screen name="home" options={{ href: null, title: '홈' }} />
      <Tabs.Screen name="stats" options={{ href: null, title: '내 통계' }} />
      <Tabs.Screen name="profile" options={{ href: null, title: '내 프로필' }} />
      <Tabs.Screen name="documents" options={{ href: null, title: '내 문서' }} />
      <Tabs.Screen name="invitations" options={{ href: null, title: '점주 직접 호출' }} />
      </Tabs>
    </AuthGate>
  );
}
