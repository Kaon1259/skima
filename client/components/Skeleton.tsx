import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';

export function Skeleton({
  width = '100%',
  height = 14,
  rounded = 4,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  rounded?: number;
  style?: any;
}) {
  const shimmer = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.85, duration: 800, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0.4, duration: 800, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: rounded,
          backgroundColor: colors.surfaceMuted,
          opacity: shimmer,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View
      style={{
        padding: 16,
        marginBottom: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Skeleton width={42} height={42} rounded={12} />
        <View style={{ flex: 1 }}>
          <Skeleton width={'60%'} height={14} />
          <View style={{ height: 6 }} />
          <Skeleton width={'40%'} height={11} />
        </View>
      </View>
      <Skeleton width={'100%'} height={10} />
      <View style={{ height: 6 }} />
      <Skeleton width={'80%'} height={10} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
