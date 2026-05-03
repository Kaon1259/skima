import { Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { colors } from '@/lib/theme';

/**
 * 워커/점주 공통 아바타 — 사진 있으면 ExpoImage, 없으면 이름 첫 글자(성씨/이니셜).
 * size: 32 / 44 / 56 / 72 등 픽셀 단위 (정사각).
 */
function initialFor(name?: string | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  // 영문이면 첫 글자 대문자, 한글/기타는 첫 글자 그대로
  const first = trimmed.charAt(0);
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
}
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
      <Text style={{ color: fg, fontWeight: '900', fontSize, letterSpacing: -0.3 }}>
        {initialFor(name)}
      </Text>
    </View>
  );
}
