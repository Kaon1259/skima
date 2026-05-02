import { Stack } from 'expo-router';

import { AuthGate } from '@/components/AuthGate';
import HeaderLogout from '@/components/HeaderLogout';
import { colors } from '@/lib/theme';

export default function AdminLayout() {
  return (
    <AuthGate role="ADMIN">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800', fontSize: 18 },
          headerShadowVisible: false,
          headerRight: () => <HeaderLogout />,
        }}
      >
        <Stack.Screen name="kpi" options={{ title: '북극성 KPI' }} />
      </Stack>
    </AuthGate>
  );
}
