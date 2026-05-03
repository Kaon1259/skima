import { Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { colors } from '@/lib/theme';

/**
 * 워커/점주 공통 아바타 — 사진 있으면 ExpoImage, 없으면 이름 마지막 글자.
 * size: 32 / 44 / 56 / 72 등 픽셀 단위 (정사각).
 */
export function Avatar({
  name,
  imageUrl,
  size = 44,
  bg = colors.primarySoft,
  fg = colors.primary,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  const radius = size / 2;
  const fontSize = Math.max(11, Math.round(size * 0.42));
  if (imageUrl) {
    return (
      <ExpoImage
        source={{ uri: imageUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg,
        }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: fg, fontWeight: '900', fontSize }}>
        {(name ?? '?').slice(-1)}
      </Text>
    </View>
  );
}
