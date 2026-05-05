import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { initialFor } from '@/components/Avatar';
import { GradientButton } from '@/components/Gradient';
import { Icon } from '@/components/Icon';
import { RatingModal, blurFocusedForModal } from '@/components/RatingModal';
import ShiftSkillBadges from '@/components/ShiftSkillBadges';
import { SkeletonList } from '@/components/Skeleton';
import { api } from '@/lib/api';
import { useFocusPolling } from '@/lib/useFocusPolling';
import {
  Cafe,
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
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ matchId: number; workerName: string } | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const xs = shifts.filter((s) => {
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
    // 긴급도 정렬 — 점주가 "지금 봐야 할 것" 위로
    // 1. OPEN + 지원자 있음 (수락/거절 결정 필요)
    // 2. IN_PROGRESS (근무 중 — 채팅·체크아웃 모니터링)
    // 3. MATCHED (시작 대기)
    // 4. COMPLETED + 평가/정산 대기 (CHECKED_OUT + ratingScore null)
    // 5. OPEN + 지원자 없음
    // 6. COMPLETED 평가 끝 / CANCELED / etc
    function urgency(s: OwnerShift): number {
      if (s.status === 'OPEN' && (s.pendingApplicationsCount ?? 0) > 0) return 1;
      if (s.status === 'IN_PROGRESS') return 2;
      if (s.status === 'MATCHED') return 3;
      if (s.status === 'COMPLETED' && s.matchStatus === 'CHECKED_OUT' && s.ratingScore == null) return 4;
      if (s.status === 'OPEN') return 5;
      if (s.status === 'COMPLETED') return 6;
      return 7;
    }
    return [...xs].sort((a, b) => {
      const u = urgency(a) - urgency(b);
      if (u !== 0) return u;
      // 같은 긴급도 안에서는 시작 시각 가까운 것 먼저
      return (a.startAt ?? '').localeCompare(b.startAt ?? '');
    });
  }, [shifts, filter, query]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [shiftData, dashData, myCafes] = await Promise.all([
        api<OwnerShift[]>('/api/owner/shifts'),
        api<OwnerDashboard>('/api/owner/dashboard'),
        api<Cafe[]>('/api/owner/cafes').catch(() => [] as Cafe[]),
      ]);
      setShifts(shiftData);
      setDash(dashData);
      setCafes(myCafes);
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
      setInitialLoaded(true);
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
          {/* 매장 0개 — OnboardingSteps 풀 노출 (시프트 등록 단계까지 안내) */}
          {initialLoaded && cafes.length === 0 ? (
            <OnboardingSteps cafesCount={cafes.length} shiftsCount={shifts.length} />
          ) : null}
          {/* 매장 ≥1 + 시프트 ≥1 — 대시보드·검색·빠른진입 (시프트 0건이면 헤더 비우고 CTA만 노출) */}
          {initialLoaded && cafes.length >= 1 && shifts.length >= 1 ? (
            <>
              <DashboardHeader dash={dash} shifts={shifts} filter={filter} onFilterChange={setFilter} />

              {filter !== 'ALL' ? (
                <Pressable
                  onPress={() => setFilter('ALL')}
                  style={({ pressed }) => [
                    {
                      alignSelf: 'flex-start',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: radius.pill,
                      backgroundColor: colors.dangerSoft,
                      borderWidth: 1,
                      borderColor: colors.danger,
                      marginBottom: 10,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.danger }}>
                    ✕ 필터 해제 (전체 보기)
                  </Text>
                </Pressable>
              ) : null}
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
          {/* 빠른 진입 — 워커풀(단골) 가운데 강조, 양쪽 보조 */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <QuickLink emoji="📚" label="히스토리" sub="지난 시프트" onPress={() => router.push('/owner/history')} />
            <QuickLink emoji="👥" label="워커 풀" sub="단골 워커" highlight onPress={() => router.push('/owner/worker-pool')} />
            <QuickLink emoji="🗓️" label="템플릿" sub="반복 시프트" onPress={() => router.push('/owner/shift-templates')} />
          </View>
            </>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !initialLoaded ? (
          <SkeletonList count={3} />
        ) : cafes.length >= 1 && shifts.length === 0 ? (
          // 매장은 있지만 시프트 0건 — 큰 CTA
          <View style={{ paddingVertical: 32, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>📋</Text>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 6 }}>
              아직 등록된 시프트가 없어요
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 20 }}>
              시급·시간을 입력하면 1시간 안에 워커가 매칭돼요{'\n'}
              매칭된 시프트는 정산 완료까지 첫 화면에 계속 노출됩니다
            </Text>
            <GradientButton
              onPress={() => router.push('/owner/new-shift')}
              label="첫 시프트 등록하기"
              icon={<Text style={{ fontSize: 18 }}>⚡</Text>}
              size="lg"
            />
          </View>
        ) : shifts.length > 0 ? (
          // 시프트는 있는데 필터·검색 결과 없음
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
            <Text style={styles.bodyMuted}>조건에 맞는 시프트가 없어요</Text>
            {filter !== 'ALL' || query ? (
              <Pressable
                onPress={() => { setFilter('ALL'); setQuery(''); }}
                style={({ pressed }) => [
                  { marginTop: 12, paddingHorizontal: 14, paddingVertical: 8 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  필터·검색 해제
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null
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

function OnboardingSteps({ cafesCount, shiftsCount }: { cafesCount: number; shiftsCount: number }) {
  const step1Done = cafesCount > 0;
  const step2Done = shiftsCount > 0;
  const allDone = step1Done && step2Done;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[styles.h2, { marginBottom: 4 }]}>
        {allDone ? '🎉 잘 시작했어요!' : '👋 환영합니다'}
      </Text>
      <Text style={[styles.subtitle, { marginBottom: 16 }]}>
        {allDone
          ? '워커 매칭을 기다리는 중 — 추가 등록·운영 도구도 준비되어 있어요'
          : '2단계만 끝내면 워커 매칭이 시작돼요'}
      </Text>

      {/* 1단계: 매장 등록 */}
      <Pressable
        onPress={() => router.push('/owner/cafes?autoCreate=1')}
        disabled={step1Done}
        style={({ pressed }) => [
          {
            padding: 16,
            borderRadius: radius.lg,
            backgroundColor: step1Done ? colors.successSoft : colors.surface,
            borderWidth: 1.5,
            borderColor: step1Done ? colors.success : colors.primary,
            marginBottom: 10,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: step1Done ? colors.success : colors.primary,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
              {step1Done ? '✓' : '1'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
              매장 등록
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              {step1Done ? `${cafesCount}개 매장 등록 완료` : '브랜드 카탈로그에서 골라 매장 정보 입력'}
            </Text>
          </View>
          {step1Done ? (
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.success }}>완료</Text>
          ) : (
            <Text style={{ fontSize: 16, color: colors.primary }}>›</Text>
          )}
        </View>
      </Pressable>

      {/* 2단계: 시프트 등록 */}
      <Pressable
        onPress={() => step1Done && !step2Done && router.push('/owner/new-shift')}
        disabled={!step1Done || step2Done}
        style={({ pressed }) => [
          {
            padding: 16,
            borderRadius: radius.lg,
            backgroundColor: step2Done ? colors.successSoft : (!step1Done ? colors.surfaceMuted : colors.surface),
            borderWidth: 1.5,
            borderColor: step2Done ? colors.success : (step1Done ? colors.primary : colors.border),
            marginBottom: 10,
            opacity: step1Done ? 1 : 0.6,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: step2Done ? colors.success : (step1Done ? colors.primary : colors.textLight),
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
              {step2Done ? '✓' : '2'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
              첫 시프트 등록
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              {step2Done
                ? `${shiftsCount}건 등록 완료 — 워커 지원 대기 중`
                : (step1Done
                  ? '시급·직무·요구 자격 입력 → 1시간 매칭 SLA 시작'
                  : '먼저 매장을 등록해야 시프트를 만들 수 있어요')}
            </Text>
          </View>
          {step2Done ? (
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.success }}>완료</Text>
          ) : (step1Done ? (
            <Text style={{ fontSize: 16, color: colors.primary }}>›</Text>
          ) : null)}
        </View>
      </Pressable>

      {/* 모든 단계 완료 후 — 다음 액션 안내 */}
      {allDone ? (
        <View style={{ marginTop: 4, marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, marginBottom: 8 }}>
            다음 액션
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <NextActionChip emoji="➕" label="시프트 추가" onPress={() => router.push('/owner/new-shift' as never)} />
            <NextActionChip emoji="🗓️" label="템플릿" onPress={() => router.push('/owner/shift-templates' as never)} />
            <NextActionChip emoji="🏪" label="매장 추가" onPress={() => router.push('/owner/cafes' as never)} />
            <NextActionChip emoji="👥" label="워커풀" onPress={() => router.push('/owner/worker-pool' as never)} />
          </View>
          <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 10, lineHeight: 16 }}>
            워커 지원이 들어오면 헤더 종(🔔) 알림과 위 시프트 카드에서 확인할 수 있어요. 워커가 단골 등록한 매장이면 즉시 푸시.
          </Text>
        </View>
      ) : step1Done ? (
        <Pressable
          onPress={() => router.push('/owner/cafes')}
          style={({ pressed }) => [
            {
              paddingVertical: 8, alignItems: 'center',
              borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
              backgroundColor: colors.surface,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>
            + 매장 추가 등록
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NextActionChip({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ fontSize: 13 }}>{emoji}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

/**
 * 컴팩트 대시보드 — 1줄 4 알약. 액션 필요한 상태에 강조 배지(🔥/💬/⭐).
 * 큰 게이지·제목 제거. 매칭률은 우측 작은 숫자로.
 */
function DashboardHeader({ dash, shifts, filter, onFilterChange }: {
  dash: OwnerDashboard | null;
  shifts: OwnerShift[];
  filter: 'ALL' | 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED';
  onFilterChange: (f: 'ALL' | 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED') => void;
}) {
  const openWithApps = shifts.filter((s) => s.status === 'OPEN' && (s.pendingApplicationsCount ?? 0) > 0);
  const totalPending = openWithApps.reduce((sum, s) => sum + (s.pendingApplicationsCount ?? 0), 0);
  const matchedUnread = shifts
    .filter((s) => (s.status === 'MATCHED' || s.status === 'IN_PROGRESS') && (s.chatUnreadCount ?? 0) > 0)
    .reduce((sum, s) => sum + (s.chatUnreadCount ?? 0), 0);
  const completedNeedRating = shifts.filter(
    (s) => s.status === 'COMPLETED' && s.matchStatus === 'CHECKED_OUT' && s.ratingScore == null,
  ).length;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'stretch' }}>
        <DashPill
          label="모집"
          value={dash?.openShifts ?? 0}
          accent={colors.warn}
          active={filter === 'OPEN'}
          badge={totalPending > 0 ? `🔥 ${totalPending}` : undefined}
          onPress={() => onFilterChange(filter === 'OPEN' ? 'ALL' : 'OPEN')}
        />
        <DashPill
          label="매칭"
          value={dash?.matchedShifts ?? 0}
          accent={colors.info}
          active={filter === 'MATCHED'}
          badge={matchedUnread > 0 ? `💬 ${matchedUnread}` : undefined}
          onPress={() => onFilterChange(filter === 'MATCHED' ? 'ALL' : 'MATCHED')}
        />
        <DashPill
          label="근무"
          value={dash?.inProgressShifts ?? 0}
          accent={colors.primary}
          active={filter === 'IN_PROGRESS'}
          onPress={() => onFilterChange(filter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
        />
        <DashPill
          label="완료"
          value={dash?.completedShifts ?? 0}
          accent={colors.success}
          active={filter === 'COMPLETED'}
          badge={completedNeedRating > 0 ? `⭐ ${completedNeedRating}` : undefined}
          onPress={() => onFilterChange(filter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
        />
      </View>
      {dash && dash.matchingSlaRate != null ? (
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, fontWeight: '600' }}>
          1시간 매칭률 {fmtPercent(dash.matchingSlaRate)}
          {dash.avgMatchingMinutes != null ? ` · 평균 ${dash.avgMatchingMinutes}분` : ''}
          {dash.pendingApplications > 0 ? ` · ⏳ 대기 ${dash.pendingApplications}건` : ''}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * 빠른 진입 카드 — 세로 레이아웃 (이모지 위 / 라벨 아래 / 서브 라벨).
 * 균등 너비, 라벨 한 줄 고정.
 */
function QuickLink({
  emoji,
  label,
  sub,
  onPress,
  highlight,
}: {
  emoji: string;
  label: string;
  sub?: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: 8,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: highlight ? colors.primary300 : colors.border,
          backgroundColor: highlight ? colors.primary100 : colors.surface,
          alignItems: 'center',
          gap: 4,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={{ fontSize: 22, lineHeight: 26 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: highlight ? colors.primary700 : colors.text,
          letterSpacing: -0.3,
          lineHeight: 16,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {sub ? (
        <Text
          style={{
            fontSize: 10,
            color: highlight ? colors.primary600 : colors.textMuted,
            letterSpacing: -0.2,
            lineHeight: 12,
          }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * 컴팩트 상태 알약 — 한 줄 4개. 액션 알림 배지 옵션.
 */
function DashPill({
  label,
  value,
  accent,
  active,
  badge,
  onPress,
}: {
  label: string;
  value: number;
  accent: string;
  active: boolean;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 8,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: active ? accent : colors.border,
          backgroundColor: active ? accent + '22' : colors.surface,
          alignItems: 'center',
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={{ fontSize: 18, fontWeight: '900', color: accent, lineHeight: 20 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: active ? accent : colors.textMuted, marginTop: 2 }}>
        {label}
      </Text>
      {badge ? (
        <View
          style={{
            marginTop: 3,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: radius.pill,
            backgroundColor: colors.danger,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }} numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
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
  const hasUnread = (shift.chatUnreadCount ?? 0) > 0;
  const cancellable = shift.status === 'OPEN' || shift.status === 'MATCHED';
  const completedReady = shift.status === 'COMPLETED' && shift.matchStatus === 'CHECKED_OUT';
  const rated = shift.ratingScore != null;
  const needsRating = completedReady && !rated;

  return (
    <View
      style={[
        styles.card,
        hasPending
          ? { borderWidth: 1.5, borderColor: colors.primary }
          : hasUnread
            ? { borderWidth: 1.5, borderColor: colors.danger }
            : null,
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

      {/* 매칭/평가 정보 (완료된 시프트) — 워커 영역 탭하면 워커 상세 진입 */}
      {shift.matchedWorkerName ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            if (shift.matchedWorkerId) router.push(`/u/${shift.matchedWorkerId}` as never);
          }}
          disabled={!shift.matchedWorkerId}
          style={({ pressed }) => [
            {
              marginTop: 10,
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: rated ? colors.successSoft : completedReady ? colors.warnSoft : colors.surfaceAlt,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            },
            pressed && shift.matchedWorkerId ? { opacity: 0.7 } : null,
          ]}
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
              {initialFor(shift.matchedWorkerName)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                {shift.matchedWorkerName}
              </Text>
              {shift.matchedWorkerId ? (
                <Icon name="chevron-forward" size={12} color={colors.textLight} />
              ) : null}
            </View>
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
          {hasUnread ? (
            <Pressable
              onPress={() => router.push(`/owner/shift/${shift.id}` as never)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: colors.danger,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12 }}>💬</Text>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>
                {shift.chatUnreadCount! > 99 ? '99+' : shift.chatUnreadCount}
              </Text>
            </Pressable>
          ) : null}
          {needsRating ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onRate();
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>평가하기</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ) : null}

      {/* 점주 측 근로계약서 미확인 — 매칭 직후 ~ 정산 전까지 노출. 정산 전 확인 필수 (강제 게이트) */}
      {shift.matchId && shift.matchedWorkerName
        && !shift.ownerContractAckAt
        && shift.payoutStatus !== 'COMPLETED' ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            router.push(`/owner/contract/${shift.matchId}?focus=ack` as never);
          }}
          style={({ pressed }) => [
            {
              marginTop: 8,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: radius.md,
              backgroundColor: colors.warnSoft,
              borderWidth: 1,
              borderColor: colors.warn,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 12 }}>📄</Text>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', color: colors.warn }}>
            근로계약서 확인 필요 — 정산 전 필수
          </Text>
          <Text style={{ fontSize: 11, color: colors.warn, fontWeight: '700' }}>›</Text>
        </Pressable>
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
