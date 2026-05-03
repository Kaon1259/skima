import { Text, View } from 'react-native';

import { WORKER_TIER_META, WorkerTier } from '@/lib/types';
import { radius } from '@/lib/theme';

export function WorkerTierBadge({
  tier,
  size = 'sm',
}: {
  tier?: WorkerTier | null;
  size?: 'sm' | 'md';
}) {
  if (!tier) return null;
  const meta = WORKER_TIER_META[tier];
  const isMd = size === 'md';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: isMd ? 8 : 6,
        paddingVertical: isMd ? 4 : 2,
        borderRadius: radius.pill,
        backgroundColor: meta.bg,
        borderWidth: 1,
        borderColor: meta.border,
      }}
    >
      <Text style={{ fontSize: isMd ? 12 : 10 }}>{meta.emoji}</Text>
      <Text
        style={{
          fontSize: isMd ? 11 : 10,
          fontWeight: '900',
          color: meta.color,
        }}
      >
        {meta.label}
      </Text>
    </View>
  );
}
