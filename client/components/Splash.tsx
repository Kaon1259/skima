import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

export function Splash({ message }: { message?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 38 }}>⚡</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>
        스키마 바이트
      </Text>
      <Text style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
        {message ?? '1시간 매칭 · 30분 입금'}
      </Text>
      <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
    </View>
  );
}
