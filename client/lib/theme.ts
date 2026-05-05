import { Platform, StyleSheet } from 'react-native';

// Timee-inspired vibrant orange + clean light surfaces
// 단바 brand orange — 9-step palette (Tailwind-style)
export const colors = {
  // Brand — orange palette (use these for brand surfaces, washes, accents)
  primary50: '#FFF7F2',   // 가장 연한 — 헤더 wash, hover bg
  primary100: '#FFEEE2',  // soft 칩 배경
  primary200: '#FFD9BC',
  primary300: '#FFB890',
  primary400: '#FF935E',
  primary500: '#FF6B35',  // = primary (CTA, 강조)
  primary600: '#E55A28',  // = primaryDark (그라디언트 끝)
  primary700: '#C44619',
  primary800: '#9C320E',
  primary900: '#7A2208',

  // Aliases (호환 유지 — 기존 코드는 primary/primaryDark/primarySoft 사용 중)
  primary: '#FF6B35',
  primaryDark: '#E55A28',
  primarySoft: '#FFEEE2',

  // Surface
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FA',
  surfaceMuted: '#F0F2F5',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  // Text
  text: '#111827',
  textSubtle: '#374151',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#10B981',
  successSoft: '#E6F8F2',
  warn: '#F59E0B',
  warnSoft: '#FEF4E2',
  danger: '#EF4444',
  dangerSoft: '#FEECEC',
  info: '#3B82F6',
  infoSoft: '#EAF2FE',
};

// Brand gradient — hero 카드, 메인 CTA 등에서 사용
export const gradients = {
  brand: ['#FF6B35', '#E55A28'] as [string, string],
  brandWarm: ['#FF8A3D', '#FF5A1F'] as [string, string],
  brandSoft: ['#FFEEE2', '#FFF7F2'] as [string, string],
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: {
    elevation: 2,
  },
  default: {
    boxShadow: '0 4px 14px rgba(15,23,42,0.06)',
  },
}) as object;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
  screenPadded: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  cardFlat: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  h1: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  h2: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    lineHeight: 26,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  body: {
    fontSize: 14,
    color: colors.textSubtle,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  bodyMuted: {
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSubtle,
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

type StatusVisual = { bg: string; fg: string; label: string };

export function statusVisual(status: string): StatusVisual {
  switch (status) {
    // 단바 라이프사이클 상태들 — 주황 intensity 로 진행 단계 표현
    case 'OPEN':
      // 모집중 — 가장 연한 주황 (정적 대기)
      return { bg: colors.primary50, fg: colors.primary600, label: '모집중' };
    case 'PENDING':
      return { bg: colors.warnSoft, fg: colors.warn, label: '대기중' };
    case 'REQUESTED':
      return { bg: colors.warnSoft, fg: colors.warn, label: '점주 승인 대기' };
    case 'SCHEDULED':
      // 입금 예정 — 부드러운 주황 (브랜드 동선)
      return { bg: colors.primary50, fg: colors.primary600, label: '입금 예정' };
    case 'MATCHED':
    case 'ACCEPTED':
      // 매칭/확정 — 중간 주황
      return { bg: colors.primary100, fg: colors.primary700, label: status === 'MATCHED' ? '매칭 완료' : '확정' };
    case 'CHECKED_IN':
    case 'IN_PROGRESS':
      // 근무중 — 가장 진한 단바 색 (live)
      return { bg: colors.primary500, fg: '#FFFFFF', label: '근무중' };
    case 'CHECKED_OUT':
      return { bg: colors.successSoft, fg: colors.success, label: '근무 완료' };
    case 'COMPLETED':
      return { bg: colors.successSoft, fg: colors.success, label: '완료' };
    case 'REJECTED':
      return { bg: colors.dangerSoft, fg: colors.danger, label: '거절됨' };
    case 'WITHDRAWN':
      return { bg: colors.surfaceMuted, fg: colors.textMuted, label: '취소' };
    case 'CANCELED':
      return { bg: colors.dangerSoft, fg: colors.danger, label: '취소됨' };
    case 'NO_SHOW':
      return { bg: colors.dangerSoft, fg: colors.danger, label: '노쇼' };
    case 'FAILED':
      return { bg: colors.dangerSoft, fg: colors.danger, label: '실패' };
    default:
      return { bg: colors.surfaceMuted, fg: colors.textMuted, label: status };
  }
}
