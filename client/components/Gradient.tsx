import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View, ViewStyle, StyleProp, PressableProps } from 'react-native';

import { colors, gradients, radius, shadow } from '@/lib/theme';

type GradientCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: [string, string];
  vertical?: boolean;
  withShadow?: boolean;
  borderRadius?: number;
  onPress?: () => void;
};

export function GradientCard({
  children,
  style,
  colors: cs = gradients.brand,
  vertical = true,
  withShadow = true,
  borderRadius: br = radius.lg,
  onPress,
}: GradientCardProps) {
  const inner = (
    <LinearGradient
      colors={cs}
      start={{ x: 0, y: 0 }}
      end={vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }}
      style={[
        { borderRadius: br },
        withShadow && shadow,
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      {inner}
    </Pressable>
  );
}

type GradientButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
} & Omit<PressableProps, 'style' | 'onPress' | 'disabled'>;

export function GradientButton({
  label,
  onPress,
  disabled,
  style,
  size = 'md',
  icon,
  ...rest
}: GradientButtonProps) {
  const padV = size === 'lg' ? 16 : size === 'sm' ? 9 : 13;
  const padH = size === 'lg' ? 22 : size === 'sm' ? 14 : 18;
  const fontSize = size === 'lg' ? 17 : size === 'sm' ? 13 : 15;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        { borderRadius: radius.md, overflow: 'hidden' },
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.88 },
        style,
      ]}
      {...rest}
    >
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingVertical: padV,
          paddingHorizontal: padH,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {icon}
        <Text style={{ color: '#fff', fontSize, fontWeight: '800', letterSpacing: -0.3 }}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

// 헤더 wash — 흰 배경 위에 살짝 깔리는 brand 톤
export function HeaderWash({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.primary50 }, style]}>
      {children}
    </View>
  );
}
