import { Platform, StyleSheet } from 'react-native';

// Timee-inspired vibrant orange + clean light surfaces
export const colors = {
  // Brand
  primary: '#FF6B35',
  primaryDark: '#E55A28',
  primarySoft: '#FFF1EA',

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
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  body: {
    fontSize: 14,
    color: colors.textSubtle,
  },
  bodyMuted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  bigNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -1,
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
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSubtle,
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
    case 'OPEN':
      return { bg: colors.warnSoft, fg: colors.warn, label: '모집중' };
    case 'PENDING':
      return { bg: colors.warnSoft, fg: colors.warn, label: '대기중' };
    case 'REQUESTED':
      return { bg: colors.warnSoft, fg: colors.warn, label: '점주 승인 대기' };
    case 'SCHEDULED':
      return { bg: colors.infoSoft, fg: colors.info, label: '입금 예정' };
    case 'MATCHED':
      return { bg: colors.infoSoft, fg: colors.info, label: '매칭 완료' };
    case 'ACCEPTED':
      return { bg: colors.infoSoft, fg: colors.info, label: '확정' };
    case 'CHECKED_IN':
    case 'IN_PROGRESS':
      return { bg: colors.infoSoft, fg: colors.info, label: '근무중' };
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
