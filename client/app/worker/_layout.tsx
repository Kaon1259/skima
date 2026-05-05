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
  name: 'flash' | 'checkmark-circle' | 'wallet' | 'user';
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

export default function WorkerLayout() {
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
            <TabIconWithIndicator focused={focused} size={size} name="checkmark-circle" />
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
