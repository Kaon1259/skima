import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function HeaderLogout() {
  const { auth, logout } = useAuth();
  return (
    <Pressable
      onPress={async () => {
        await logout();
        // '/'로 보내면 인트로 스플래시가 다시 재생되고 → /login 으로 자동 라우팅
        router.replace('/');
      }}
      style={({ pressed }) => [
        { paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{auth?.name ?? ''}</Text>
        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600', marginTop: 1 }}>로그아웃</Text>
      </View>
    </Pressable>
  );
}
