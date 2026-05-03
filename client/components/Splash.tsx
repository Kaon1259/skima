import { ActivityIndicator, Image, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

export function Splash({ message }: { message?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={require('@/assets/images/icon.png')}
        style={{ width: 140, height: 140, borderRadius: 32, marginBottom: 18 }}
        resizeMode="cover"
      />
      <Text style={{ marginTop: 4, fontSize: 14, color: colors.textMuted, fontWeight: '700' }}>
        {message ?? '1시간 매칭 · 30분 입금'}
      </Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
    </View>
  );
}
