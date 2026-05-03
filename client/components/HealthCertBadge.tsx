import { Text, View } from 'react-native';

import { HEALTH_CERT_STATUS_META, HealthCertStatus } from '@/lib/types';
import { colors, radius } from '@/lib/theme';

const TONE: Record<'success' | 'warn' | 'danger' | 'muted', { fg: string; bg: string; border: string }> = {
  success: { fg: colors.success, bg: colors.successSoft, border: colors.success },
  warn:    { fg: colors.warn,    bg: colors.warnSoft,    border: colors.warn },
  danger:  { fg: colors.danger,  bg: colors.dangerSoft,  border: colors.danger },
  muted:   { fg: colors.textMuted, bg: colors.surfaceMuted, border: colors.border },
};

export function HealthCertBadge({
  status,
  size = 'sm',
  hideWhenVerified = false,
}: {
  status?: HealthCertStatus | null;
  size?: 'xs' | 'sm' | 'md';
  /** VERIFIED 일 때 뱃지 숨김 (강조 필요한 경우만 노출하고 싶을 때) */
  hideWhenVerified?: boolean;
}) {
  const eff: HealthCertStatus = status ?? 'NOT_UPLOADED';
  if (hideWhenVerified && eff === 'VERIFIED') return null;
  const meta = HEALTH_CERT_STATUS_META[eff];
  const tone = TONE[meta.color];
  const sizes = {
    xs: { fontSize: 10, padHor: 5, padVer: 2, iconSize: 10 },
    sm: { fontSize: 11, padHor: 6, padVer: 3, iconSize: 11 },
    md: { fontSize: 13, padHor: 10, padVer: 5, iconSize: 13 },
  }[size];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: sizes.padHor,
        paddingVertical: sizes.padVer,
        borderRadius: radius.pill,
        backgroundColor: tone.bg,
        borderWidth: 1,
        borderColor: tone.border,
      }}
    >
      <Text style={{ fontSize: sizes.iconSize }}>{meta.emoji}</Text>
      <Text style={{ fontSize: sizes.fontSize, fontWeight: '900', color: tone.fg }}>
        보건증 {meta.label}
      </Text>
    </View>
  );
}
