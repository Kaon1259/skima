import { Text, View } from 'react-native';

import { colors, radius } from '@/lib/theme';

/**
 * 신뢰도 점수 뱃지 — 워커 / 매장 공통.
 * score=null → "신규" 회색 / 90+ Elite 골드 / 75+ Verified 초록 / 50+ Regular 파랑 / <50 주의 빨강
 */
export function TrustScoreBadge({
  score,
  size = 'sm',
  showLabel = true,
}: {
  score?: number | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) {
  const sizes = {
    xs: { fontSize: 10, padHor: 5, padVer: 2, radius: radius.pill, iconSize: 10 },
    sm: { fontSize: 11, padHor: 6, padVer: 3, radius: radius.pill, iconSize: 11 },
    md: { fontSize: 13, padHor: 10, padVer: 5, radius: radius.pill, iconSize: 13 },
    lg: { fontSize: 22, padHor: 14, padVer: 8, radius: radius.md, iconSize: 18 },
  }[size];

  if (score == null) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: sizes.padHor,
          paddingVertical: sizes.padVer,
          borderRadius: sizes.radius,
          backgroundColor: '#F3F4F6',
          borderWidth: 1,
          borderColor: '#9CA3AF',
        }}
      >
        <Text style={{ fontSize: sizes.iconSize }}>🌱</Text>
        {showLabel ? (
          <Text style={{ fontSize: sizes.fontSize, fontWeight: '900', color: '#374151' }}>
            신규
          </Text>
        ) : null}
      </View>
    );
  }

  let bg: string, fg: string, border: string, emoji: string;
  if (score >= 90)      { bg = '#FFF4D2'; fg = '#7B5800'; border = '#E5B100'; emoji = '👑'; }
  else if (score >= 75) { bg = '#D1FAE5'; fg = '#065F46'; border = '#10B981'; emoji = '🛡️'; }
  else if (score >= 50) { bg = '#DBEAFE'; fg = '#1E40AF'; border = '#60A5FA'; emoji = '✓'; }
  else                  { bg = colors.dangerSoft; fg = colors.danger; border = colors.danger; emoji = '⚠️'; }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: sizes.padHor,
        paddingVertical: sizes.padVer,
        borderRadius: sizes.radius,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text style={{ fontSize: sizes.iconSize }}>{emoji}</Text>
      <Text style={{ fontSize: sizes.fontSize, fontWeight: '900', color: fg }}>
        {showLabel ? `${score}점` : score}
      </Text>
    </View>
  );
}
