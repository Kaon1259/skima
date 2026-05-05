import { ActivityIndicator, View } from 'react-native';

import { BrandHero } from '@/components/BrandHero';
import { colors } from '@/lib/theme';

export function Splash({ message }: { message?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.primary50,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <BrandHero size="lg" tagline={message ?? '1시간 매칭 · 30분 입금'} />
      <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
    </View>
  );
}
