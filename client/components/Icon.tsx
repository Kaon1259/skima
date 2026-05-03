import Ionicons from '@expo/vector-icons/Ionicons';
import { TextStyle } from 'react-native';

/**
 * Icon — Ionicons SVG 기반 통합 아이콘.
 * 기존 호출부의 name 값을 그대로 받아 Ionicons name 으로 매핑.
 */
// 탭/네비게이션은 outline (얇고 정돈), 상태/배지는 filled (가독)
const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  // 워커 탭
  flash: 'flash-outline',
  'checkmark-circle': 'checkmark-circle',
  'checkmark-circle-outline': 'checkmark-circle-outline',
  wallet: 'wallet-outline',
  'log-in': 'log-in-outline',
  'log-out': 'log-out-outline',
  checkmark: 'checkmark',
  // 점주 탭
  list: 'list-outline',
  'add-circle': 'add-circle-outline',
  cafe: 'cafe-outline',
  'create-outline': 'create-outline',
  'trash-outline': 'trash-outline',
  add: 'add',
  rocket: 'rocket-outline',
  // 공통/상태
  hourglass: 'hourglass-outline',
  'hourglass-outline': 'hourglass-outline',
  'time-outline': 'time-outline',
  'checkmark-done-outline': 'checkmark-done-outline',
  'alert-circle': 'alert-circle-outline',
  people: 'people-outline',
  notifications: 'notifications-outline',
  'chevron-forward': 'chevron-forward',
  // 어드민
  cash: 'cash-outline',
  'play-circle': 'play-circle-outline',
  // 추가
  chart: 'bar-chart-outline',
  document: 'document-outline',
  receipt: 'receipt-outline',
  search: 'search',
  filter: 'funnel-outline',
  star: 'star',
  home: 'home-outline',
  user: 'person-outline',
};

export type IconName = keyof typeof ICON_MAP | string;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
};

export function Icon({ name, size = 18, color = '#111', style }: Props) {
  const ioniconName = (ICON_MAP[name] ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap;
  return <Ionicons name={ioniconName} size={size} color={color} style={style} />;
}
