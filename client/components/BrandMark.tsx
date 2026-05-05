import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, gradients } from '@/lib/theme';

/**
 * 단바 브랜드 마크 — 코드 기반 wordmark + 번개 accent.
 * 기존 icon.png 썸네일 방식은 헤더 박스 안에서 하단 잘림/배경 box 갇힘 문제가 있어 폐기.
 * 그라디언트 타일(번개) + "단바" wordmark 조합으로 자유롭게 떠 있어 잘림 없음.
 */
export default function BrandMark({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const isMd = size === 'md';
  const tile = isMd ? 32 : 26;
  const tileRadius = isMd ? 9 : 7;
  const boltSize = isMd ? 17 : 14;
  const fontSize = isMd ? 18 : 15;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, gap: 7 }}>
      {/* 그라디언트 타일 + 번개 — 작은 앱 아이콘 느낌 */}
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: tile,
          height: tile,
          borderRadius: tileRadius,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.primary600,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Icon name="flash" size={boltSize} color="#FFFFFF" />
      </LinearGradient>

      {/* Wordmark "단바" — 자간 타이트 + 굵게 */}
      <Text
        style={{
          fontSize,
          fontWeight: '900',
          color: colors.primary700,
          letterSpacing: -0.6,
          // 기준선이 깔끔하게 떨어지도록 lineHeight 명시 (헤더 잘림 방지)
          lineHeight: fontSize + 2,
        }}
      >
        단바
      </Text>
    </View>
  );
}
