import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Icon } from '@/components/Icon';
import { RatingModal, blurFocusedForModal } from '@/components/RatingModal';
import ShiftSkillBadges from '@/components/ShiftSkillBadges';
import { api } from '@/lib/api';
import { useFocusPolling } from '@/lib/useFocusPolling';
import {
  CafeStats,
  OwnerDashboard,
  OwnerShift,
  fmtDateTime,
  fmtKRW,
  fmtPercent,
  fmtRelativeMinutes,
} from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

export default function OwnerShiftsScreen() {
  const [shifts, setShifts] = useState<OwnerShift[]>([]);
  const [dash, setDash] = useState<OwnerDashboard | null>(null);
  const [cafeStats, setCafeStats] = useState<CafeStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ matchId: number; workerName: string } | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shifts.filter((s) => {
      if (filter === 'OPEN' && s.status !== 'OPEN') return false;
      if (filter === 'MATCHED' && s.status !== 'MATCHED') return false;
      if (filter === 'IN_PROGRESS' && s.status !== 'IN_PROGRESS') return false;
      if (filter === 'COMPLETED' && s.status !== 'COMPLETED') return false;
      // 취소된 시프트는 검색어가 있을 때만 노출 (히스토리 페이지에서 archive 검토)
      if (s.status === 'CANCELED' && !q) return false;
      // 노쇼 처리된 매칭이 있는 시프트도 일반 화면에서 숨김
      if (s.matchStatus === 'NO_SHOW' && s.status !== 'OPEN' && !q) return false;
      if (!q) return true;
      return (
        s.cafeName.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        s.startAt.includes(q) ||
        (s.matchedWorkerName ?? '').toLowerCase().includes(q)
      );
    });
  }, [shifts, filter, query]);

  const needsRatingCount = useMemo(
    () => shifts.filter((s) => s.status === 'COMPLETED' && s.matchStatus === 'CHECKED_OUT' && s.ratingScore == null).length,
    [shifts],
  );

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [shiftData, dashData, byCafe] = await Promise.all([
        api<OwnerShift[]>('/api/owner/shifts'),
        api<OwnerDashboard>('/api/owner/dashboard'),
        api<CafeStats[]>('/api/owner/dashboard/by-cafe'),
      ]);
      setShifts(shiftData);
      setDash(dashData);
      setCafeStats(byCafe);
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusPolling(load, 15000);

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  async function confirm(msg: string) {
    if (Platform.OS === 'web') return window.confirm(msg);
    return new Promise<boolean>((resolve) => {
      Alert.alert('확인', msg, [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: '확인', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  }

  async function cancelShift(shift: OwnerShift) {
    const pending = shift.pendingApplicationsCount;
    const msg = pending > 0
      ? `시프트 #${shift.id}을(를) 취소합니다. 대기 중 지원자 ${pending}명도 자동 거절됩니다. 진행할까요?`
      : `시프트 #${shift.id}을(를) 취소할까요?`;
    if (!(await confirm(msg))) return;
    setBusyId(shift.id);
    try {
      await api(`/api/owner/shifts/${shift.id}/cancel`, { method: 'POST' });
      notify('시프트 취소 완료');
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateShift(shift: OwnerShift) {
    setBusyId(shift.id);
    try {
      // 시작/종료 시각 +24시간 (다음 날 같은 시간대)
      const next = (iso: string) => {
        const d = new Date(iso);
        d.setDate(d.getDate() + 1);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      };
      await api('/api/owner/shifts', {
        method: 'POST',
        body: {
          cafeId: shift.cafeId,
          startAt: next(shift.startAt),
          endAt: next(shift.endAt),
          hourlyWage: shift.hourlyWage,
          headcount: shift.headcount,
          description: shift.description ?? '',
        },
      });
      notify('다음 날 같은 시간대로 시프트 복제 완료');
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

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
          <DashboardHeader dash={dash} />
          <TodayWidgets shifts={shifts} />
          <CafeStatsRow stats={cafeStats} />
          {/* 필터 + 검색 — 카드 4개와 1:1 매핑 */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <FilterChip label="전체" active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
            <FilterChip label="모집중" active={filter === 'OPEN'} onPress={() => setFilter('OPEN')} />
            <FilterChip label="매칭완료" active={filter === 'MATCHED'} onPress={() => setFilter('MATCHED')} />
            <FilterChip label="근무중" active={filter === 'IN_PROGRESS'} onPress={() => setFilter('IN_PROGRESS')} />
            <FilterChip label="완료" active={filter === 'COMPLETED'} onPress={() => setFilter('COMPLETED')} count={needsRatingCount} />
          </View>
          <View style={{ position: 'relative', marginBottom: 16 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="매장·워커·설명·날짜 검색"
              placeholderTextColor={colors.textLight}
              style={[styles.input, { marginBottom: 0, paddingLeft: 38 }]}
            />
            <Text style={{ position: 'absolute', left: 14, top: 14, fontSize: 16 }}>🔍</Text>
          </View>
          {/* 빠른 진입 — 히스토리 / 워커 풀 */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <Pressable
              onPress={() => router.push('/owner/history')}
              style={({ pressed }) => [
                {
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ fontSize: 14 }}>📚</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>시프트 히스토리</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/owner/worker-pool')}
              style={({ pressed }) => [
                {
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ fontSize: 14 }}>👥</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>워커 풀</Text>
            </Pressable>
          </View>
          {filtered.length === 0 && shifts.length > 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Text style={styles.bodyMuted}>조건에 맞는 시프트가 없어요</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
          <Text style={styles.bodyMuted}>등록된 시프트가 없어요</Text>
          <Pressable
            style={[styles.buttonPrimary, { marginTop: 16, paddingHorizontal: 24 }]}
            onPress={() => router.push('/owner/new-shift')}
          >
            <Text style={styles.buttonPrimaryText}>첫 시프트 등록하기</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <ShiftCard
          shift={item}
          busy={busyId === item.id}
          onCancel={() => cancelShift(item)}
          onDuplicate={() => duplicateShift(item)}
          onRate={() => {
            if (item.matchId && item.matchedWorkerName) {
              blurFocusedForModal();
              setRatingTarget({ matchId: item.matchId, workerName: item.matchedWorkerName });
            }
          }}
        />
      )}
      ListFooterComponent={
        <RatingModal
          visible={ratingTarget != null}
          matchId={ratingTarget?.matchId ?? null}
          targetName={ratingTarget?.workerName ?? ''}
          mode="owner-rates-worker"
          onClose={() => setRatingTarget(null)}
          onSubmitted={() => load()}
        />
      }
    />
  );
}

function FilterChip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.surface,
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.text }}>{label}</Text>
      {count != null && count > 0 ? (
        <View
          style={{
            paddingHorizontal: 6,
            borderRadius: radius.pill,
            backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.warn,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function DashboardHeader({ dash }: { dash: OwnerDashboard | null }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.h2}>점주 대시보드</Text>
      <Text style={[styles.subtitle, { marginTop: 4 }]}>
        {dash ? `전체 ${dash.totalShifts}개 시프트` : '집계 중...'} · 1시간 매칭 SLA 자동 추적
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        <StatCard
          label="모집중"
          value={dash?.openShifts ?? 0}
          accent={colors.warn}
          bg={colors.warnSoft}
          icon="hourglass-outline"
          onPress={() => router.push('/owner/dashboard/open' as never)}
        />
        <StatCard
          label="매칭완료"
          value={dash?.matchedShifts ?? 0}
          accent={colors.info}
          bg={colors.infoSoft}
          icon="checkmark-circle-outline"
          onPress={() => router.push('/owner/dashboard/matched' as never)}
        />
        <StatCard
          label="근무중"
          value={dash?.inProgressShifts ?? 0}
          accent={colors.primary}
          bg={colors.primarySoft}
          icon="time-outline"
          onPress={() => router.push('/owner/dashboard/in-progress' as never)}
        />
        <StatCard
          label="완료"
          value={dash?.completedShifts ?? 0}
          accent={colors.success}
          bg={colors.successSoft}
          icon="checkmark-done-outline"
          onPress={() => router.push('/owner/dashboard/completed' as never)}
        />
      </View>

      {dash && dash.matchingSlaRate != null ? (
        <View
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: radius.lg,
            backgroundColor: dash.matchingSlaRate >= 0.8 ? colors.successSoft : colors.warnSoft,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 }}>
                내 매장 1시간 매칭률
              </Text>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '900',
                  color: dash.matchingSlaRate >= 0.8 ? colors.success : colors.warn,
                  marginTop: 4,
                  letterSpacing: -0.5,
                }}
              >
                {fmtPercent(dash.matchingSlaRate)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                평균 매칭 시간
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 }}>
                {dash.avgMatchingMinutes != null ? `${dash.avgMatchingMinutes}분` : '—'}
              </Text>
            </View>
          </View>
          {dash.pendingApplications > 0 ? (
            <View
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: 'rgba(0,0,0,0.06)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="notifications" size={14} color={colors.warn} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                대기 중 지원 {dash.pendingApplications}건 — 빨리 확정해서 SLA 지키세요
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.h2, { marginTop: 24, fontSize: 18 }]}>전체 시프트</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  accent,
  bg,
  icon,
  onPress,
}: {
  label: string;
  value: number;
  accent: string;
  bg: string;
  icon: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexBasis: '47%',
          flexGrow: 1,
          padding: 14,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.7, borderColor: accent },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ padding: 6, borderRadius: 8, backgroundColor: bg }}>
          <Icon name={icon} size={14} color={accent} />
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
        <View style={{ flex: 1 }} />
        {onPress ? <Icon name="chevron-forward" size={14} color={colors.textLight} /> : null}
      </View>
      <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 6, letterSpacing: -0.5 }}>
        {value}
      </Text>
    </Pressable>
  );
}

function TodayWidgets({ shifts }: { shifts: OwnerShift[] }) {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = startOfToday.getTime() + 24 * 3600 * 1000;

  const todayShifts = shifts.filter((s) => {
    const t = new Date(s.startAt).getTime();
    return t >= startOfToday.getTime() && t < endOfToday;
  });
  const todayMatched = todayShifts.filter((s) => s.matchId != null).length;
  const todayInProgress = shifts.filter((s) => s.status === 'IN_PROGRESS').length;

  // SLA 임박: OPEN + 등록 30분+ 매칭 안 된 것
  const slaWarn = shifts.filter((s) => {
    if (s.status !== 'OPEN') return false;
    if (!s.createdAt) return false;
    const minutesAgo = (now - new Date(s.createdAt).getTime()) / 60000;
    return minutesAgo > 30;
  });

  if (todayShifts.length === 0 && slaWarn.length === 0 && todayInProgress === 0) {
    return null; // 아무것도 없으면 위젯 영역 자체 숨김
  }

  return (
    <View style={{ marginBottom: spacing.lg, flexDirection: 'row', gap: 8 }}>
      <Pressable
        onPress={() => router.push('/owner/dashboard/in-progress' as never)}
        style={({ pressed }) => [
          {
            flex: 1,
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: todayInProgress > 0 ? colors.primary : colors.surface,
            borderWidth: 1,
            borderColor: todayInProgress > 0 ? colors.primary : colors.border,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: todayInProgress > 0 ? 'rgba(255,255,255,0.85)' : colors.textMuted }}>
          오늘 · 근무중
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '900', color: todayInProgress > 0 ? '#fff' : colors.text, marginTop: 4 }}>
          {todayInProgress}건
        </Text>
        <Text style={{ fontSize: 10, color: todayInProgress > 0 ? 'rgba(255,255,255,0.85)' : colors.textMuted, marginTop: 2 }}>
          오늘 시작 시프트 {todayShifts.length}건 / 매칭 {todayMatched}건
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/owner/dashboard/open' as never)}
        style={({ pressed }) => [
          {
            flex: 1,
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: slaWarn.length > 0 ? colors.warnSoft : colors.surface,
            borderWidth: 1,
            borderColor: slaWarn.length > 0 ? colors.warn : colors.border,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: slaWarn.length > 0 ? colors.warn : colors.textMuted }}>
          ⏱️ SLA 임박
        </Text>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '900',
            color: slaWarn.length > 0 ? colors.warn : colors.text,
            marginTop: 4,
          }}
        >
          {slaWarn.length}건
        </Text>
        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
          {slaWarn.length > 0
            ? '등록 30분+ 매칭 안 됨 — 빨리 확인'
            : '모든 시프트 정상 진행 중'}
        </Text>
      </Pressable>
    </View>
  );
}

function CafeStatsRow({ stats }: { stats: CafeStats[] }) {
  if (!stats || stats.length === 0) return null;
  // 이번달 매칭 많은 순으로 정렬 (점주가 자주 쓰는 매장 자연 우선)
  const sorted = [...stats].sort(
    (a, b) => (b.monthCompletedMatches ?? 0) - (a.monthCompletedMatches ?? 0),
  );
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 8 }]}>
        매장별 이번달 요약 (활동 많은 순)
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 16 }}
      >
        {sorted.map((c) => {
          const ratingPct = c.avgRating != null ? c.avgRating / 5 : 0;
          const noShowPct = c.noShowRate != null ? c.noShowRate : 0;
          const thisTotal = c.monthGross + c.monthFee;
          const prev = c.prevMonthGross ?? 0;
          const trend: 'up' | 'down' | 'flat' | null = prev === 0 && thisTotal === 0
            ? null
            : thisTotal > prev ? 'up' : thisTotal < prev ? 'down' : 'flat';
          const trendPct = prev > 0 ? Math.round(((thisTotal - prev) / prev) * 100) : null;
          return (
            <Pressable
              key={c.cafeId}
              style={({ pressed }) => [
                {
                  width: 240,
                  padding: 14,
                  borderRadius: radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push(`/cafe/${c.cafeId}` as never)}
            >
              {/* 헤더: 브랜드 아바타 + 매장명 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {c.brandLetter ? (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: c.brandColor ?? colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{c.brandLetter}</Text>
                  </View>
                ) : null}
                <Text style={{ flex: 1, fontWeight: '800', fontSize: 13, color: colors.text }} numberOfLines={1}>
                  {c.cafeName}
                </Text>
                <Icon name="chevron-forward" size={16} color={colors.textLight} />
              </View>

              {/* 이번달 매출 */}
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 12 }}>
                이번달 총 지출
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>
                  {fmtKRW(thisTotal)}
                </Text>
                {trend && trend !== 'flat' ? (
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: trend === 'up' ? colors.success : colors.danger,
                  }}>
                    {trend === 'up' ? '▲' : '▼'}
                    {trendPct != null ? ` ${Math.abs(trendPct)}%` : ''}
                  </Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>
                임금 {fmtKRW(c.monthGross)} · 수수료 {fmtKRW(c.monthFee)}
                {prev > 0 ? ` · 지난달 ${fmtKRW(prev)}` : ''}
              </Text>

              {/* 시프트 카운트 미니 */}
              <View
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  flexDirection: 'row',
                  gap: 12,
                }}
              >
                <Pill label="모집중" value={c.openShifts} accent={colors.warn} />
                <Pill label="진행" value={c.matchedShifts} accent={colors.info} />
                <Pill label="완료" value={c.completedShifts} accent={colors.success} />
              </View>

              {/* 별점 + 노쇼 바 */}
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                    평균 별점
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text, fontWeight: '800' }}>
                    {c.avgRating != null ? `★ ${c.avgRating.toFixed(2)} (${c.ratingsCount ?? 0})` : '—'}
                  </Text>
                </View>
                <Bar pct={ratingPct} color={colors.warn} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                    노쇼율
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text, fontWeight: '800' }}>
                    {c.noShowRate != null ? fmtPercent(c.noShowRate) : '—'}
                  </Text>
                </View>
                <Bar pct={noShowPct} color={colors.danger} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Pill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color: accent }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View
      style={{
        marginTop: 4,
        height: 5,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function ShiftCard({
  shift,
  busy,
  onCancel,
  onDuplicate,
  onRate,
}: {
  shift: OwnerShift;
  busy: boolean;
  onCancel: () => void;
  onDuplicate: () => void;
  onRate: () => void;
}) {
  const v = statusVisual(shift.status);
  const matched = shift.matchingMinutes != null;
  const within = matched && shift.matchingMinutes! <= 60;
  const hasPending = shift.pendingApplicationsCount > 0;
  const cancellable = shift.status === 'OPEN' || shift.status === 'MATCHED';
  const completedReady = shift.status === 'COMPLETED' && shift.matchStatus === 'CHECKED_OUT';
  const rated = shift.ratingScore != null;
  const needsRating = completedReady && !rated;

  return (
    <View
      style={[
        styles.card,
        hasPending && { borderWidth: 1.5, borderColor: colors.primary },
      ]}
    >
      <Pressable onPress={() => router.push(`/owner/shift/${shift.id}`)}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.title}>{shift.cafeName}</Text>
            <Text style={[styles.bodyMuted, { marginTop: 2 }]}>
              {fmtDateTime(shift.startAt)} ~ {fmtDateTime(shift.endAt)}
            </Text>
            {shift.minutesUntilStart != null && shift.status !== 'COMPLETED' && shift.status !== 'CANCELED' ? (
              <Text style={{ marginTop: 4, fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                {fmtRelativeMinutes(shift.minutesUntilStart)}
              </Text>
            ) : null}
          </View>
          <View style={[styles.badge, { backgroundColor: v.bg }]}>
            <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <View style={[styles.chip, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
            <Text style={[styles.chipText, { color: colors.primaryDark }]}>
              시급 {fmtKRW(shift.hourlyWage)}
            </Text>
          </View>
          {shift.description ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{shift.description}</Text>
            </View>
          ) : null}
        </View>
        <ShiftSkillBadges
          jobRole={shift.jobRole}
          minSkill={shift.minSkill}
          requirements={shift.requirements}
          compact
        />

        <View
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: radius.md,
            backgroundColor: hasPending
              ? colors.primarySoft
              : matched
                ? within
                  ? colors.successSoft
                  : colors.dangerSoft
                : colors.surfaceAlt,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Icon
              name={
                hasPending ? 'people' : matched ? (within ? 'checkmark-circle' : 'alert-circle') : 'hourglass'
              }
              size={18}
              color={
                hasPending ? colors.primary : matched ? (within ? colors.success : colors.danger) : colors.textMuted
              }
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: hasPending ? colors.primaryDark : matched ? (within ? colors.success : colors.danger) : colors.textMuted,
              }}
            >
              {hasPending
                ? `대기 중 지원 ${shift.pendingApplicationsCount}건 — 확인하기`
                : matched
                  ? `매칭 SLA: ${shift.matchingMinutes}분`
                  : shift.applicationsCount > 0
                    ? `지원자 ${shift.applicationsCount}명 — 처리됨`
                    : '지원자 대기 중...'}
            </Text>
          </View>
          {hasPending ? <Icon name="chevron-forward" size={16} color={colors.primary} /> : null}
        </View>
      </Pressable>

      {/* 매칭/평가 정보 (완료된 시프트) */}
      {shift.matchedWorkerName ? (
        <View
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: radius.md,
            backgroundColor: rated ? colors.successSoft : completedReady ? colors.warnSoft : colors.surfaceAlt,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>
              {shift.matchedWorkerName.slice(-1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
              {shift.matchedWorkerName}
            </Text>
            {rated ? (
              <Text style={{ fontSize: 12, color: colors.success, marginTop: 2, fontWeight: '600' }}>
                {'★'.repeat(shift.ratingScore!)}{'☆'.repeat(5 - shift.ratingScore!)} {shift.willRehire ? '· 재고용 의향' : ''}
              </Text>
            ) : completedReady ? (
              <Text style={{ fontSize: 12, color: colors.warn, marginTop: 2, fontWeight: '600' }}>
                평가 대기 중
              </Text>
            ) : (
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {shift.matchStatus === 'CHECKED_IN' ? '근무 중' : shift.matchStatus === 'MATCHED' ? '매칭 확정 — 근무 시작 대기' : shift.matchStatus}
              </Text>
            )}
          </View>
          {needsRating ? (
            <Pressable
              onPress={onRate}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: colors.warn,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>평가하기</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* 액션 행: 복제 / 취소 */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable
          style={[
            styles.buttonSecondary,
            { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 10 },
            busy && { opacity: 0.6 },
          ]}
          onPress={onDuplicate}
          disabled={busy}
        >
          <Text style={{ fontSize: 14 }}>📄</Text>
          <Text style={[styles.buttonSecondaryText, { fontSize: 13 }]}>복제 (다음 날)</Text>
        </Pressable>
        {cancellable ? (
          <Pressable
            style={[
              styles.buttonSecondary,
              {
                flex: 1,
                flexDirection: 'row',
                gap: 6,
                paddingVertical: 10,
                borderColor: colors.dangerSoft,
              },
              busy && { opacity: 0.6 },
            ]}
            onPress={onCancel}
            disabled={busy}
          >
            <Text style={{ fontSize: 14 }}>🚫</Text>
            <Text style={[styles.buttonSecondaryText, { color: colors.danger, fontSize: 13 }]}>
              {busy ? '처리 중...' : '시프트 취소'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
