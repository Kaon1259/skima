import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, gradients } from '@/lib/theme';

/**
 * 큰 단바 브랜드 hero — splash · 인트로 · 로그인 화면 상단에서 사용.
 * 그라디언트 타일(번개) + "단바" wordmark + 태그라인 수직 배치.
 * BrandMark (헤더용 작은 가로 버전) 와 별도 — hero 는 큰 화면 강조용.
 */
export type BrandHeroSize = 'sm' | 'md' | 'lg' | 'xl';
export type BrandHeroAlign = 'center' | 'start';

const SIZES: Record<BrandHeroSize, { tile: number; tileRadius: number; bolt: number; wordmark: number; gap: number }> = {
  sm: { tile: 64,  tileRadius: 18, bolt: 32, wordmark: 22, gap: 10 },
  md: { tile: 88,  tileRadius: 24, bolt: 44, wordmark: 28, gap: 14 },
  lg: { tile: 120, tileRadius: 30, bolt: 60, wordmark: 34, gap: 18 },
  xl: { tile: 152, tileRadius: 36, bolt: 78, wordmark: 40, gap: 20 },
};

export function BrandHero({
  size = 'md',
  align = 'center',
  tagline,
  animatedTile,
}: {
  size?: BrandHeroSize;
  align?: BrandHeroAlign;
  tagline?: string | null;
  /** Animated.Value 등으로 외부에서 fade/scale 등 감싸고 싶으면 그 자리만 Animated wrapper 로 — 주로 인트로용. */
  animatedTile?: { opacity?: Animated.Value; scale?: Animated.Value };
}) {
  const s = SIZES[size];
  const Wrapper = animatedTile ? Animated.View : View;
  const wrapperStyle = animatedTile
    ? {
        opacity: animatedTile.opacity ?? 1,
        transform: animatedTile.scale ? [{ scale: animatedTile.scale }] : undefined,
      }
    : undefined;

  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Wrapper style={wrapperStyle}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: s.tile,
            height: s.tile,
            borderRadius: s.tileRadius,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.primary600,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.22,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Icon name="flash" size={s.bolt} color="#FFFFFF" />
        </LinearGradient>
      </Wrapper>

      <Text
        style={{
          marginTop: s.gap,
          fontSize: s.wordmark,
          fontWeight: '900',
          color: colors.primary700,
          letterSpacing: -1.0,
          lineHeight: s.wordmark + 4,
        }}
      >
        단바
      </Text>

      {tagline ? (
        <Text
          style={{
            marginTop: 6,
            fontSize: 13,
            color: colors.textMuted,
            fontWeight: '600',
            letterSpacing: -0.2,
          }}
        >
          {tagline}
        </Text>
      ) : null}
    </View>
  );
}
