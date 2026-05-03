import { Pressable, Text, View } from 'react-native';

import { colors, radius, spacing, styles } from '@/lib/theme';

export type EmptyStateAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

export function EmptyState({
  emoji = '🤍',
  title,
  subtitle,
  actions = [],
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  actions?: EmptyStateAction[];
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.lg }}>
      <Text style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 6, textAlign: 'center', maxWidth: 320, lineHeight: 18 }]}>
          {subtitle}
        </Text>
      ) : null}
      {actions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          {actions.map((a, i) => (
            <Pressable
              key={i}
              onPress={a.onPress}
              style={({ pressed }) => [
                a.variant === 'secondary' ? styles.buttonSecondary : styles.buttonPrimary,
                { paddingHorizontal: 18 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={a.variant === 'secondary' ? styles.buttonSecondaryText : styles.buttonPrimaryText}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
