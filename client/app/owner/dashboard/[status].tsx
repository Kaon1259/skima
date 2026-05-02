import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Icon } from '@/components/Icon';
import ShiftSkillBadges from '@/components/ShiftSkillBadges';
import { api } from '@/lib/api';
import { useFocusPolling } from '@/lib/useFocusPolling';
import { OwnerShift, fmtDateTime, fmtKRW, fmtRelativeMinutes } from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

type Status = 'open' | 'matched' | 'in-progress' | 'completed';

const META: Record<Status, {
  title: string;
  subtitle: string;
  emptyEmoji: string;
  emptyText: string;
  accent: string;
  filter: (s: OwnerShift) => boolean;
  sort: (a: OwnerShift, b: OwnerShift) => number;
}> = {
  open: {
    title: '모집중 시프트',
    subtitle: '1시간 매칭 SLA 임박 순 — 가장 오래된 등록부터',
    emptyEmoji: '🌱',
    emptyText: '모집 중인 시프트가 없어요',
    accent: colors.warn,
    filter: (s) => s.status === 'OPEN',
    sort: (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
  },
  matched: {
    title: '매칭완료 시프트',
    subtitle: '근무 시작까지 임박한 순',
    emptyEmoji: '⏳',
    emptyText: '매칭 확정된 시프트가 없어요',
    accent: colors.info,
    filter: (s) => s.status === 'MATCHED',
    sort: (a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''),
  },
  'in-progress': {
    title: '근무중 시프트',
    subtitle: '현재 근무 중 — 실시간 상태',
    emptyEmoji: '☕',
    emptyText: '근무 중인 시프트가 없어요',
    accent: colors.primary,
    filter: (s) => s.status === 'IN_PROGRESS',
    sort: (a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''),
  },
  completed: {
    title: '완료된 시프트',
    subtitle: '최근 종료 순 — 정산/평가 상태 표시',
    emptyEmoji: '🏁',
    emptyText: '완료된 시프트가 없어요',
    accent: colors.success,
    filter: (s) => s.status === 'COMPLETED',
    sort: (a, b) => (b.endAt ?? '').localeCompare(a.endAt ?? ''),
  },
};

export default function DashboardStatusScreen() {
  const { status } = useLocalSearchParams<{ status: Status }>();
  const meta = META[status as Status] ?? META.open;
  const [shifts, setShifts] = useState<OwnerShift[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<OwnerShift[]>('/api/owner/shifts');
      setShifts(data);
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusPolling(load, 15000);

  const filtered = useMemo(() => shifts.filter(meta.filter).sort(meta.sort), [shifts, meta]);

  const summary = useMemo(() => {
    if (status === 'open') {
      const totalPending = filtered.reduce((sum, s) => sum + s.pendingApplicationsCount, 0);
      const slaWarn = filtered.filter((s) => {
        if (!s.createdAt) return false;
        const minutesAgo = (Date.now() - new Date(s.createdAt).getTime()) / 60000;
        return minutesAgo > 30;  // 30분 이상 매칭 안 된 것 = 1시간 SLA 임박
      }).length;
      return [
        { label: '대기 중 지원', value: `${totalPending}건` },
        { label: 'SLA 임박 (30분+)', value: `${slaWarn}건`, accent: slaWarn > 0 ? colors.warn : colors.textMuted },
      ];
    }
    if (status === 'matched') {
      const startSoon = filtered.filter((s) => {
        if (!s.minutesUntilStart) return false;
        return s.minutesUntilStart >= 0 && s.minutesUntilStart <= 60;
      }).length;
      return [
        { label: '1시간 내 시작', value: `${startSoon}건`, accent: startSoon > 0 ? colors.warn : colors.textMuted },
        { label: '매칭 후 노쇼 등록 가능', value: `${filtered.length}건` },
      ];
    }
    if (status === 'in-progress') {
      return [{ label: '현재 근무 중', value: `${filtered.length}건`, accent: colors.primary }];
    }
    // completed
    const needsRating = filtered.filter((s) => s.matchStatus === 'CHECKED_OUT' && s.ratingScore == null).length;
    const payoutReq = filtered.filter((s) => s.payoutStatus === 'REQUESTED').length;
    return [
      { label: '평가 대기', value: `${needsRating}건`, accent: needsRating > 0 ? colors.warn : colors.textMuted },
      { label: '정산 승인 대기', value: `${payoutReq}건`, accent: payoutReq > 0 ? colors.warn : colors.textMuted },
    ];
  }, [filtered, status]);

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={filtered}
      keyExtractor={(s) => String(s.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[styles.h2, { color: meta.accent }]}>{meta.title}</Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>{meta.subtitle}</Text>
          </View>
          {/* 요약 카드 */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.lg }}>
            <View
              style={{
                flex: 1,
                padding: 14,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                총 시프트
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '900', color: meta.accent, marginTop: 4 }}>
                {filtered.length}
              </Text>
            </View>
            {summary.map((s, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>{s.label}</Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '900',
                    color: s.accent ?? colors.text,
                    marginTop: 4,
                  }}
                >
                  {s.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>{meta.emptyEmoji}</Text>
          <Text style={styles.bodyMuted}>{meta.emptyText}</Text>
        </View>
      }
      renderItem={({ item }) => <DashboardShiftCard shift={item} status={status as Status} />}
    />
  );
}

function DashboardShiftCard({ shift, status }: { shift: OwnerShift; status: Status }) {
  const v = statusVisual(shift.status);
  const minutesSinceCreated = shift.createdAt
    ? Math.floor((Date.now() - new Date(shift.createdAt).getTime()) / 60000)
    : null;
  const slaWarn = status === 'open' && minutesSinceCreated != null && minutesSinceCreated > 30;
  const startSoon = status === 'matched' && shift.minutesUntilStart != null
    && shift.minutesUntilStart >= 0 && shift.minutesUntilStart <= 60;

  return (
    <Pressable
      onPress={() => router.push(`/owner/shift/${shift.id}` as never)}
      style={({ pressed }) => [
        styles.card,
        slaWarn && { borderWidth: 1.5, borderColor: colors.warn },
        startSoon && { borderWidth: 1.5, borderColor: colors.warn },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.title}>{shift.cafeName}</Text>
          <Text style={[styles.bodyMuted, { marginTop: 2 }]}>
            {fmtDateTime(shift.startAt)} ~ {fmtDateTime(shift.endAt)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: v.bg }]}>
          <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
        </View>
      </View>

      <ShiftSkillBadges
        jobRole={shift.jobRole}
        minSkill={shift.minSkill}
        requirements={shift.requirements}
        compact
      />

      {/* status별 hot 정보 */}
      {status === 'open' ? (
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: radius.md,
            backgroundColor: slaWarn ? colors.warnSoft : colors.surfaceAlt,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon
            name={shift.pendingApplicationsCount > 0 ? 'people' : 'hourglass-outline'}
            size={16}
            color={slaWarn ? colors.warn : colors.textMuted}
          />
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: slaWarn ? colors.warn : colors.text }}>
            {shift.pendingApplicationsCount > 0
              ? `대기 중 지원 ${shift.pendingApplicationsCount}건 — 빨리 확정하세요`
              : minutesSinceCreated != null
                ? `등록 ${minutesSinceCreated}분 경과${slaWarn ? ' — SLA 임박!' : ''}`
                : ''}
          </Text>
        </View>
      ) : null}

      {status === 'matched' && shift.matchedWorkerName ? (
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: radius.md,
            backgroundColor: startSoon ? colors.warnSoft : colors.successSoft,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>
              {shift.matchedWorkerName.slice(-1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
              {shift.matchedWorkerName}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
              {shift.minutesUntilStart != null
                ? fmtRelativeMinutes(shift.minutesUntilStart)
                : '시작 대기'}
            </Text>
          </View>
        </View>
      ) : null}

      {status === 'in-progress' && shift.matchedWorkerName ? (
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.primaryDark }}>
            {shift.matchedWorkerName} · 근무 중 (체크인됨)
          </Text>
        </View>
      ) : null}

      {status === 'completed' && shift.matchedWorkerName ? (
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: radius.md,
            backgroundColor:
              shift.payoutStatus === 'COMPLETED' && shift.ratingScore != null
                ? colors.successSoft
                : colors.warnSoft,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>
              {shift.matchedWorkerName}
            </Text>
            {shift.ratingScore != null ? (
              <Text style={{ fontSize: 11, color: colors.warn, fontWeight: '700' }}>
                {'★'.repeat(shift.ratingScore)}{'☆'.repeat(5 - shift.ratingScore)}
              </Text>
            ) : null}
          </View>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            {shift.payoutStatus === 'COMPLETED' ? '✓ 입금 완료' : shift.payoutStatus === 'SCHEDULED' ? '⏳ 입금 처리 중' : shift.payoutStatus === 'REQUESTED' ? '⚠️ 정산 승인 대기' : '— 정산 미시작'}
            {' · '}
            {shift.ratingScore != null ? '✓ 워커 평가 완료' : '⚠️ 워커 평가 대기'}
            {' · '}
            {shift.workerRatedOwner ? '✓ 매장 평가 받음' : '— 매장 평가 대기'}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
