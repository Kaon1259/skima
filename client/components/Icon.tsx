import { Text, TextStyle } from 'react-native';

const MAP: Record<string, string> = {
  // 워커
  flash: '⚡',
  'checkmark-circle': '✅',
  'checkmark-circle-outline': '✅',
  wallet: '💰',
  'log-in': '🚪',
  'log-out': '🏁',
  checkmark: '✓',
  // 점주
  list: '📋',
  'add-circle': '➕',
  cafe: '☕',
  'create-outline': '✏️',
  'trash-outline': '🗑️',
  add: '+',
  rocket: '🚀',
  // 공통/상태
  hourglass: '⏳',
  'hourglass-outline': '⏳',
  'time-outline': '⏱️',
  'checkmark-done-outline': '☑️',
  'alert-circle': '⚠️',
  people: '👥',
  notifications: '🔔',
  'chevron-forward': '›',
  // 어드민
  cash: '💵',
  'play-circle': '▶️',
  // 추가
  chart: '📊',
  document: '📄',
  receipt: '🧾',
  search: '🔍',
  filter: '⚙️',
  star: '★',
};

export type IconName = keyof typeof MAP | string;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
};

export function Icon({ name, size = 18, color, style }: Props) {
  const glyph = MAP[name] ?? '•';
  return (
    <Text
      style={[
        { fontSize: size, lineHeight: size * 1.2, color },
        style,
      ]}
    >
      {glyph}
    </Text>
  );
}
