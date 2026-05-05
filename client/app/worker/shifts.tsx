import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { GradientButton } from '@/components/Gradient';
import { Icon } from '@/components/Icon';
import KakaoMapThumbnail from '@/components/KakaoMapThumbnail';
import ShiftSkillBadges from '@/components/ShiftSkillBadges';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import { WorkerOnboardingTutorial } from '@/components/WorkerOnboardingTutorial';
import { api, ApiError } from '@/lib/api';
import { Coords, distanceKm, getCurrentCoords } from '@/lib/geolocation';
import { storage } from '@/lib/storage';
import { useFocusPolling } from '@/lib/useFocusPolling';
import { useWorkerPrefs } from '@/lib/workerPrefs';
import {
  JobRole,
  MyProfile,
  SKILL_LEVEL_ORDER,
  SkillLevel,
  WorkerShift,
  fmtDateTime,
  fmtKRW,
  fmtPercent,
} from '@/lib/types';

function cafeTypeLabel(t: string): string {
  switch (t) {
    case 'FRANCHISE_CAFE': return '프렌차이즈 카페';
    case 'INDIVIDUAL_CAFE': return '개인 카페';
    case 'FRANCHISE_BAKERY': return '프렌차이즈 베이커리';
    case 'INDIVIDUAL_BAKERY': return '개인 베이커리';
    default: return '';
  }
}
import { colors, radius, spacing, styles } from '@/lib/theme';

function durationHours(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

type SortMode = 'recommend' | 'time' | 'rating' | 'wage' | 'distance';
type TimeFilter = 'any' | 'morning' | 'afternoon' | 'evening' | 'night';
type DayFilter = 'any' | 'today' | 'thisweek' | 'weekend';
type WageFilter = 'any' | '12k' | '15k';
type DistanceFilter = 'any' | '5' | '10' | '30';

const DISTANCE_LIMIT_KM: Record<DistanceFilter, number | null> = {
  any: null,
  '5': 5,
  '10': 10,
  '30': 30,
};

const FILTER_STORAGE_KEY = 'skima.worker.shiftFilters';

const TIME_RANGES: Record<TimeFilter, { from: number; to: number; label: string; emoji: string }> = {
  any: { from: 0, to: 24, label: '전체', emoji: '⏱' },
  morning: { from: 5, to: 11, label: '오전', emoji: '🌅' },
  afternoon: { from: 11, to: 17, label: '오후', emoji: '🌤️' },
  evening: { from: 17, to: 22, label: '저녁', emoji: '🌆' },
  night: { from: 22, to: 5, label: '심야', emoji: '🌙' },
};

const DAY_LABEL: Record<DayFilter, { label: string; emoji: string }> = {
  any: { label: '전체', emoji: '📅' },
  today: { label: '오늘', emoji: '⚡' },
  thisweek: { label: '이번주', emoji: '🗓' },
  weekend: { label: '주말', emoji: '🎉' },
};

const WAGE_LABEL: Record<WageFilter, string> = {
  any: '전체',
  '12k': '시급 12k+',
  '15k': '시급 15k+',
};

export default function WorkerShiftsScreen() {
  const [shifts, setShifts] = useState<WorkerShift[]>([]);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // 필터 상태 (임시 — 화면 칩)
  const [fitOnly, setFitOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [dayFilter, setDayFilter] = useState<DayFilter>('any');
  const [wageFilter, setWageFilter] = useState<WageFilter>('any');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('any');
  const [sortMode, setSortMode] = useState<SortMode>('recommend');
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // 워커 현재 위치 (GPS, best-effort)
  const [myCoords, setMyCoords] = useState<Coords | null>(null);

  // 영구 필터 (마이 탭 선호 조건)
  const { prefs } = useWorkerPrefs();

  const myLevelRank = me?.selfReportedLevel
    ? SKILL_LEVEL_ORDER[me.selfReportedLevel]
    : null;
  const myRolesSet = useMemo(
    () => new Set(me?.capableRoles ?? []),
    [me?.capableRoles],
  );
  const myCertsSet = useMemo(
    () => new Set(me?.certifications ?? []),
    [me?.certifications],
  );

  /** 시프트가 내 능력에 맞는지 — fitOnly 토글 + 추천 정렬용 */
  const isFitForMe = useCallback(
    (s: WorkerShift): boolean => {
      if (s.minSkill && myLevelRank != null
          && SKILL_LEVEL_ORDER[s.minSkill] > myLevelRank) return false;
      if (s.jobRole && myRolesSet.size > 0 && !myRolesSet.has(s.jobRole)) return false;
      if (s.requirements && s.requirements.length > 0) {
        for (const r of s.requirements) {
          if (!myCertsSet.has(r)) return false;
        }
      }
      return true;
    },
    [myLevelRank, myRolesSet, myCertsSet],
  );

  // 추천 정렬 시 카드에 노출할 추천 이유 — score 가중치 기여도 큰 시그널부터 최대 3개
  const recommendReasons = useCallback(
    (s: WorkerShift): string[] => {
      const reasons: string[] = [];
      const isFav = favIds.has(s.cafeId) || !!s.isFavoriteCafe;
      if (isFav) reasons.push('⭐ 단골 매장');
      if (isFitForMe(s)) reasons.push('💪 능력 적합');
      if (s.cafeTrustScore != null && s.cafeTrustScore >= 75) reasons.push('🛡️ 신뢰 매장');
      let d: number | null = null;
      if (myCoords && s.cafeLatitude != null && s.cafeLongitude != null) {
        d = distanceKm(myCoords, { latitude: s.cafeLatitude, longitude: s.cafeLongitude });
      }
      if (d != null && d <= 2) {
        const dStr = d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
        reasons.push(`📍 ${dStr}`);
      }
      if (s.cafeAvgRating != null && s.cafeAvgRating >= 4.5) {
        reasons.push(`★ ${s.cafeAvgRating.toFixed(1)}`);
      }
      if (s.hourlyWage >= 15000) {
        reasons.push(`💰 시급 ${Math.round(s.hourlyWage / 1000)}k`);
      }
      return reasons.slice(0, 3);
    },
    [favIds, isFitForMe, myCoords],
  );

  const visibleShifts = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 3600 * 1000);
    const dow = (now.getDay() + 6) % 7; // 월=0
    const weekStart = new Date(startOfToday.getTime() - dow * 24 * 3600 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    let xs = shifts.slice();

    // 영구 필터 (마이 탭 선호 조건) — 단골 등록 매장은 면제 (사용자가 명시 선택)
    if (prefs.minWage > 0) {
      xs = xs.filter((s) => favIds.has(s.cafeId) || s.hourlyWage >= prefs.minWage);
    }
    if (prefs.minCafeRating != null) {
      const min = prefs.minCafeRating;
      xs = xs.filter((s) => favIds.has(s.cafeId) || s.cafeAvgRating == null || s.cafeAvgRating >= min);
    }
    if (prefs.maxCafeNoShowRate != null) {
      const max = prefs.maxCafeNoShowRate;
      xs = xs.filter((s) => favIds.has(s.cafeId) || s.cafeNoShowRate == null || s.cafeNoShowRate <= max);
    }
    if (prefs.maxDistanceKm != null && myCoords) {
      const limit = prefs.maxDistanceKm;
      xs = xs.filter((s) => {
        if (favIds.has(s.cafeId)) return true;
        if (s.cafeLatitude == null || s.cafeLongitude == null) return true; // 좌표 없는 매장은 면제
        const d = distanceKm(myCoords, { latitude: s.cafeLatitude, longitude: s.cafeLongitude });
        return d <= limit;
      });
    }

    // 임시 거리 필터 (화면 칩) — 영구보다 좁히는 의미
    const tempLimit = DISTANCE_LIMIT_KM[distanceFilter];
    if (tempLimit != null && myCoords) {
      xs = xs.filter((s) => {
        if (s.cafeLatitude == null || s.cafeLongitude == null) return false; // 좌표 없으면 거리 측정 불가 — 제외
        const d = distanceKm(myCoords, { latitude: s.cafeLatitude, longitude: s.cafeLongitude });
        return d <= tempLimit;
      });
    }

    // 임시 필터 (화면 칩)
    if (fitOnly) xs = xs.filter(isFitForMe);
    if (favOnly) xs = xs.filter((s) => favIds.has(s.cafeId));
    if (wageFilter === '12k') xs = xs.filter((s) => s.hourlyWage >= 12000);
    if (wageFilter === '15k') xs = xs.filter((s) => s.hourlyWage >= 15000);
    if (timeFilter !== 'any') {
      const r = TIME_RANGES[timeFilter];
      xs = xs.filter((s) => {
        if (!s.startAt) return false;
        const h = new Date(s.startAt).getHours();
        if (r.from < r.to) return h >= r.from && h < r.to;
        // wrap (밤): 22~24 or 0~5
        return h >= r.from || h < r.to;
      });
    }
    if (dayFilter !== 'any') {
      xs = xs.filter((s) => {
        if (!s.startAt) return false;
        const t = new Date(s.startAt).getTime();
        if (dayFilter === 'today') return t >= startOfToday.getTime() && t < endOfToday.getTime();
        if (dayFilter === 'thisweek') return t >= weekStart.getTime() && t < weekEnd.getTime();
        if (dayFilter === 'weekend') {
          const d = new Date(s.startAt).getDay();
          return d === 0 || d === 6;
        }
        return true;
      });
    }
    if (sortMode === 'rating') {
      xs.sort((a, b) => (b.cafeAvgRating ?? -1) - (a.cafeAvgRating ?? -1));
    } else if (sortMode === 'wage') {
      xs.sort((a, b) => b.hourlyWage - a.hourlyWage);
    } else if (sortMode === 'distance' && myCoords) {
      const dist = (s: WorkerShift) => {
        if (s.cafeLatitude == null || s.cafeLongitude == null) return Number.POSITIVE_INFINITY;
        return distanceKm(myCoords, { latitude: s.cafeLatitude, longitude: s.cafeLongitude });
      };
      xs.sort((a, b) => dist(a) - dist(b));
    } else if (sortMode === 'recommend') {
      const distOf = (s: WorkerShift): number | null => {
        if (!myCoords || s.cafeLatitude == null || s.cafeLongitude == null) return null;
        return distanceKm(myCoords, { latitude: s.cafeLatitude, longitude: s.cafeLongitude });
      };
      const score = (s: WorkerShift): number => {
        let total = 0;
        // 매장 신뢰도 (0~100, 데이터 없으면 50 중립)
        total += (s.cafeTrustScore ?? 50) * 0.25;
        // 별점 (5점 만점 → 100점 환산, 신규 매장 50 중립)
        total += (s.cafeAvgRating != null ? s.cafeAvgRating * 20 : 50) * 0.20;
        // 노쇼율 (1-rate, 데이터 없으면 0.9 낙관 중립)
        total += ((1 - (s.cafeNoShowRate ?? 0.1)) * 100) * 0.10;
        // 거리 (0km=100, 30km=0 — GPS 없으면 50 중립)
        const d = distOf(s);
        const distScore = d == null ? 50 : Math.max(0, 100 - (d / 30) * 100);
        total += distScore * 0.15;
        // 시급 (8천원=0, 2만원=100)
        const wageScore = Math.min(100, Math.max(0, ((s.hourlyWage - 8000) / 12000) * 100));
        total += wageScore * 0.10;
        // 단골 매장 가산 (강력)
        if (favIds.has(s.cafeId) || s.isFavoriteCafe) total += 15;
        // 능력 적합 가산
        if (isFitForMe(s)) total += 5;
        return total;
      };
      xs.sort((a, b) => score(b) - score(a));
    } else {
      xs.sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
    }
    return xs;
  }, [shifts, fitOnly, favOnly, favIds, wageFilter, timeFilter, dayFilter, distanceFilter, sortMode, isFitForMe, prefs, myCoords]);

  const activeFilterCount = (fitOnly ? 1 : 0) + (favOnly ? 1 : 0)
    + (timeFilter !== 'any' ? 1 : 0) + (dayFilter !== 'any' ? 1 : 0) + (wageFilter !== 'any' ? 1 : 0)
    + (distanceFilter !== 'any' ? 1 : 0);

  function resetFilters() {
    setFitOnly(false);
    setFavOnly(false);
    setTimeFilter('any');
    setDayFilter('any');
    setWageFilter('any');
    setDistanceFilter('any');
  }

  const profileIncomplete = !!me
    && me.role === 'WORKER'
    && (me.selfReportedLevel == null || (me.capableRoles?.length ?? 0) === 0);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, profile, favs] = await Promise.all([
        api<WorkerShift[]>('/api/worker/shifts'),
        api<MyProfile>('/api/me').catch(() => null),
        api<number[]>('/api/worker/favorites/cafes').catch(() => [] as number[]),
      ]);
      setShifts(data);
      if (profile) setMe(profile);
      setFavIds(new Set(favs));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusPolling(load, 15000);

  // GPS 한 번만 가져오기 (best-effort) — 거리 필터/정렬용. 권한 거부면 그냥 비활성
  useEffect(() => {
    let alive = true;
    getCurrentCoords()
      .then((c) => { if (alive) setMyCoords(c); })
      .catch(() => { /* silent — 거리 기능만 비활성 */ });
    return () => { alive = false; };
  }, []);

  // 필터 상태 영구 저장 — AsyncStorage 로드/세이브
  useEffect(() => {
    storage.get(FILTER_STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const v = JSON.parse(raw);
          if (typeof v.fitOnly === 'boolean') setFitOnly(v.fitOnly);
          if (typeof v.favOnly === 'boolean') setFavOnly(v.favOnly);
          if (typeof v.timeFilter === 'string') setTimeFilter(v.timeFilter as TimeFilter);
          if (typeof v.dayFilter === 'string') setDayFilter(v.dayFilter as DayFilter);
          if (typeof v.wageFilter === 'string') setWageFilter(v.wageFilter as WageFilter);
          if (typeof v.distanceFilter === 'string') setDistanceFilter(v.distanceFilter as DistanceFilter);
          if (typeof v.sortMode === 'string') setSortMode(v.sortMode as SortMode);
        } catch { /* ignore */ }
      }
      setFiltersLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!filtersLoaded) return;
    storage.set(FILTER_STORAGE_KEY, JSON.stringify({
      fitOnly, favOnly, timeFilter, dayFilter, wageFilter, distanceFilter, sortMode,
    }));
  }, [fitOnly, favOnly, timeFilter, dayFilter, wageFilter, distanceFilter, sortMode, filtersLoaded]);

  async function apply(shiftId: number) {
    setBusyId(shiftId);
    try {
      await api(`/api/worker/shifts/${shiftId}/apply`, { method: 'POST' });
      notify('지원 완료! 점주 확인을 기다려주세요.');
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      notify(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function withdraw(shiftId: number) {
    const ok = Platform.OS === 'web'
      ? window.confirm('지원을 취소할까요?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert('지원 취소', '정말 지원을 취소할까요?', [
            { text: '아니오', style: 'cancel', onPress: () => resolve(false) },
            { text: '예', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!ok) return;
    setBusyId(shiftId);
    try {
      await api(`/api/worker/shifts/${shiftId}/withdraw`, { method: 'POST' });
      notify('지원 취소 완료');
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  return (
    <>
    <WorkerOnboardingTutorial />
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      data={visibleShifts}
      keyExtractor={(s) => String(s.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={styles.h2}>지금 일할 수 있는 시프트</Text>
          <Text style={[styles.subtitle, { marginTop: 4 }]}>1탭 지원 · 면접 없음 · 30분 내 입금</Text>

          {profileIncomplete ? (
            <Pressable
              onPress={() => router.push('/worker/profile' as never)}
              style={({ pressed }) => [
                {
                  marginTop: 14,
                  padding: 12,
                  borderRadius: radius.md,
                  backgroundColor: colors.warnSoft,
                  borderWidth: 1,
                  borderColor: colors.warn,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ fontSize: 20 }}>⚙️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.warn }}>
                  능력 자기신고를 완료해 주세요
                </Text>
                <Text style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>
                  등급·가능 직무·자격을 입력하면 매칭율이 올라갑니다
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.warn} />
            </Pressable>
          ) : null}

          {/* 선호 조건 적용 중 안내 (영구 필터) */}
          {(prefs.minWage > 0 || prefs.minCafeRating != null || prefs.maxCafeNoShowRate != null) ? (
            <Pressable
              onPress={() => router.push('/worker/me' as never)}
              style={({ pressed }) => [
                {
                  marginTop: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  backgroundColor: colors.primarySoft,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ fontSize: 14 }}>🎯</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryDark, flex: 1 }} numberOfLines={1}>
                선호 조건 적용 중
                {prefs.minWage > 0 ? ` · 시급 ${prefs.minWage / 1000}k+` : ''}
                {prefs.minCafeRating != null ? ` · ★${prefs.minCafeRating.toFixed(1)}+` : ''}
                {prefs.maxCafeNoShowRate != null ? ` · 노쇼 ≤${Math.round(prefs.maxCafeNoShowRate * 100)}%` : ''}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>변경 ›</Text>
            </Pressable>
          ) : null}

          {/* 정렬 칩 */}
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['recommend', 'time', 'rating', 'wage', ...(myCoords ? ['distance' as SortMode] : [])] as SortMode[]).map((m) => {
              const active = sortMode === m;
              const label =
                m === 'recommend' ? '🎯 추천순'
                : m === 'time' ? '⏰ 시작순'
                : m === 'rating' ? '★ 별점순'
                : m === 'wage' ? '💰 시급순'
                : '📍 가까운순';
              return (
                <Pressable
                  key={m}
                  onPress={() => setSortMode(m)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radius.pill,
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: active ? '#fff' : colors.text }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 토글 row — 단골만 / 능력 매칭만 / 필터 펼치기 / 초기화 (한 줄에 핵심만) */}
          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <FilterChip
              label={favOnly ? '✓ ⭐ 단골만' : '⭐ 단골만'}
              active={favOnly}
              onPress={() => setFavOnly((v) => !v)}
              accent={colors.primary}
            />
            {myLevelRank != null || myRolesSet.size > 0 || myCertsSet.size > 0 ? (
              <FilterChip
                label={fitOnly ? '✓ 능력 매칭' : '🎯 능력 매칭'}
                active={fitOnly}
                onPress={() => setFitOnly((v) => !v)}
                accent={colors.success}
              />
            ) : null}
            {/* 펼치기 버튼 — 활성 필터 수 표시 */}
            {(() => {
              const advCount = (timeFilter !== 'any' ? 1 : 0)
                + (dayFilter !== 'any' ? 1 : 0)
                + (wageFilter !== 'any' ? 1 : 0)
                + (distanceFilter !== 'any' ? 1 : 0);
              return (
                <Pressable
                  onPress={() => setFiltersExpanded((v) => !v)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radius.pill,
                      backgroundColor: advCount > 0 ? colors.primarySoft : colors.surface,
                      borderWidth: 1,
                      borderColor: advCount > 0 ? colors.primary : colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: advCount > 0 ? colors.primaryDark : colors.text }}>
                    🔍 필터{advCount > 0 ? ` ${advCount}` : ''}
                  </Text>
                  <Text style={{ fontSize: 10, color: advCount > 0 ? colors.primaryDark : colors.textMuted }}>
                    {filtersExpanded ? '▴' : '▾'}
                  </Text>
                </Pressable>
              );
            })()}
            {activeFilterCount > 0 ? (
              <Pressable
                onPress={resetFilters}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: colors.dangerSoft,
                    borderWidth: 1,
                    borderColor: colors.danger,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.danger }}>
                  ✕ 초기화
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* 펼친 필터들 — 거리·시간대·요일·시급 (조건부 렌더) */}
          {filtersExpanded ? (
            <View style={{ marginTop: 8 }}>
              {myCoords ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingRight: spacing.lg }}
                >
                  {(['any', '5', '10', '30'] as DistanceFilter[]).map((d) => {
                    const active = distanceFilter === d;
                    const label = d === 'any' ? '📍 거리 전체' : `📍 ${d}km 이내`;
                    return (
                      <FilterChip
                        key={d}
                        label={label}
                        active={active}
                        onPress={() => setDistanceFilter(d)}
                        accent={colors.primary}
                      />
                    );
                  })}
                </ScrollView>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingRight: spacing.lg }}
                style={{ marginTop: 6 }}
              >
                {(['any', 'morning', 'afternoon', 'evening', 'night'] as TimeFilter[]).map((t) => {
                  const active = timeFilter === t;
                  const meta = TIME_RANGES[t];
                  return (
                    <FilterChip
                      key={t}
                      label={`${meta.emoji} ${meta.label}`}
                      active={active}
                      onPress={() => setTimeFilter(t)}
                      accent={colors.info}
                    />
                  );
                })}
              </ScrollView>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingRight: spacing.lg }}
                style={{ marginTop: 6 }}
              >
                {(['any', 'today', 'thisweek', 'weekend'] as DayFilter[]).map((d) => {
                  const active = dayFilter === d;
                  const meta = DAY_LABEL[d];
                  return (
                    <FilterChip
                      key={d}
                      label={`${meta.emoji} ${meta.label}`}
                      active={active}
                      onPress={() => setDayFilter(d)}
                      accent={colors.primary}
                    />
                  );
                })}
                {(['any', '12k', '15k'] as WageFilter[]).map((w) => {
                  if (w === 'any') return null;
                  const active = wageFilter === w;
                  return (
                    <FilterChip
                      key={w}
                      label={`💰 ${WAGE_LABEL[w]}`}
                      active={active}
                      onPress={() => setWageFilter(active ? 'any' : w)}
                      accent={colors.success}
                    />
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
            {visibleShifts.length}건 표시{activeFilterCount > 0 && shifts.length !== visibleShifts.length
              ? ` (전체 ${shifts.length}건 중)`
              : ''}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 40, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
          <Text style={{ fontSize: 44, marginBottom: 10 }}>{fitOnly ? '🎯' : '🕐'}</Text>
          <Text style={[styles.bodyMuted, { fontSize: 14, fontWeight: '700' }]}>
            {fitOnly ? '내 능력에 맞는 시프트가 없어요' : '지금 모집 중인 시프트가 없어요'}
          </Text>
          <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 4, textAlign: 'center' }]}>
            {fitOnly
              ? '내 등급/직무/자격을 다시 확인하거나 전체 시프트를 둘러보세요'
              : '새 시프트가 올라오면 자동으로 표시돼요'}
          </Text>

          <View style={{ marginTop: 20, alignItems: 'stretch', width: '100%', maxWidth: 360, gap: 8 }}>
            {fitOnly ? (
              <Pressable
                onPress={() => setFitOnly(false)}
                style={({ pressed }) => [
                  {
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: radius.md,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                  전체 시프트 보기
                </Text>
              </Pressable>
            ) : null}

            {profileIncomplete ? (
              <Pressable
                onPress={() => router.push('/worker/profile' as never)}
                style={({ pressed }) => [
                  {
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: radius.md,
                    backgroundColor: colors.warnSoft,
                    borderWidth: 1,
                    borderColor: colors.warn,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 16 }}>⚙️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.warn }}>
                    능력 자기신고 완료하기
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.text, marginTop: 1 }}>
                    매칭율을 높이고 더 좋은 시프트 추천 받기
                  </Text>
                </View>
              </Pressable>
            ) : null}

            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 16 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>
                  자주 가는 매장을 단골 등록하세요
                </Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>
                  새 시프트가 올라오면 즉시 알림받을 수 있어요
                </Text>
              </View>
            </View>
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const dur = durationHours(item.startAt, item.endAt);
        const totalEst = Math.round(item.hourlyWage * dur);
        const myStatus = item.myApplicationStatus;
        const alreadyApplied = myStatus === 'PENDING';
        const wasRejected = myStatus === 'REJECTED';
        const isFavCafe = item.isFavoriteCafe || favIds.has(item.cafeId);
        const dKm = (myCoords && item.cafeLatitude != null && item.cafeLongitude != null)
          ? distanceKm(myCoords, { latitude: item.cafeLatitude, longitude: item.cafeLongitude })
          : null;
        const reasons = sortMode === 'recommend' ? recommendReasons(item) : [];

        return (
          <View
            style={[
              styles.card,
              { padding: 14, marginBottom: 10 },
              alreadyApplied && { borderWidth: 1.5, borderColor: colors.primary },
              wasRejected && { opacity: 0.55 },
              isFavCafe && {
                borderLeftWidth: 4,
                borderLeftColor: colors.primary,
                backgroundColor: colors.primary50,
              },
            ]}
          >
            {/* 헤더: 매장 사진(또는 letter 폴백) + 매장 정보 + 상태 */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              {item.cafeImageUrl ? (
                <Image
                  source={{ uri: item.cafeImageUrl }}
                  style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surfaceAlt }}
                />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: item.brandColor ?? colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                    {item.brandLetter ?? '☕'}
                  </Text>
                </View>
              )}
              <Pressable
                style={({ pressed }) => [{ flex: 1, marginRight: 6 }, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/cafe/${item.cafeId}` as never)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  <Text style={[styles.title, { fontSize: 16 }]} numberOfLines={1}>{item.cafeName}</Text>
                  {isFavCafe ? (
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>⭐</Text>
                  ) : null}
                  {item.cafeAvgRating != null ? (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warn }}>
                      ★ {item.cafeAvgRating.toFixed(1)}
                      <Text style={{ color: colors.textLight, fontWeight: '500' }}>
                        {' '}({item.cafeRatingsCount ?? 0})
                      </Text>
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.textLight, fontWeight: '500' }}>★ 신규</Text>
                  )}
                  {item.cafeTrustScore != null ? (
                    <TrustScoreBadge score={item.cafeTrustScore} size="xs" showLabel={false} />
                  ) : null}
                  {item.cafeNoShowRate != null && item.cafeNoShowRate > 0 ? (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.danger }}>
                      노쇼 {fmtPercent(item.cafeNoShowRate)}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]} numberOfLines={1}>
                  {item.cafeType ? `${cafeTypeLabel(item.cafeType)} · ` : ''}
                  {dKm != null ? `📍 ${dKm < 1 ? `${Math.round(dKm * 1000)}m` : `${dKm.toFixed(1)}km`} · ` : ''}
                  {item.cafeAddress}
                </Text>
              </Pressable>
              <StatusPill status={myStatus} />
            </View>

            {reasons.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10, alignItems: 'center' }}>
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    backgroundColor: colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Text style={{ fontSize: 10 }}>🎯</Text>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>추천</Text>
                </View>
                {reasons.map((r, i) => (
                  <View
                    key={i}
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                      backgroundColor: colors.primarySoft,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryDark }}>
                      {r}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* 핵심 정보 한 줄: 시간/근무/모집 + 우측 가격 */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: -0.3 }}>
                  🕐 {fmtDateTime(item.startAt)}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  {dur}시간 근무 · 1명 모집
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '900',
                    color: colors.primary,
                    letterSpacing: -0.6,
                    lineHeight: 24,
                  }}
                >
                  {fmtKRW(totalEst)}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>
                  시급 {fmtKRW(item.hourlyWage)}
                </Text>
              </View>
            </View>

            {/* 설명 (있을 때만) */}
            {item.description ? (
              <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 8 }]} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            {/* 능력 배지 */}
            <ShiftSkillBadges
              jobRole={item.jobRole}
              minSkill={item.minSkill}
              requirements={item.requirements}
              myLevel={me?.selfReportedLevel as SkillLevel | null | undefined}
              myRoles={me?.capableRoles as JobRole[] | undefined}
              myCertifications={me?.certifications}
              compact
            />

            {/* 지도 — 작게 (88px), 좌표 있을 때만 */}
            {item.cafeLatitude != null && item.cafeLongitude != null ? (
              <View style={{ marginTop: 10 }}>
                <KakaoMapThumbnail
                  latitude={item.cafeLatitude}
                  longitude={item.cafeLongitude}
                  placeName={item.cafeName}
                  address={item.cafeAddress}
                  height={88}
                />
              </View>
            ) : null}

            <View style={{ marginTop: 12 }}>
              <ApplyButton
                status={myStatus}
                busy={busyId === item.id}
                onApply={() => apply(item.id)}
                onWithdraw={() => withdraw(item.id)}
              />
            </View>
          </View>
        );
      }}
    />
    </>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  accent,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: radius.pill,
          backgroundColor: active ? accent : colors.surface,
          borderWidth: 1,
          borderColor: active ? accent : colors.border,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color: active ? '#fff' : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatusPill({ status }: { status: WorkerShift['myApplicationStatus'] }) {
  if (!status) {
    return (
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.warnSoft }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.warn }}>모집중</Text>
      </View>
    );
  }
  if (status === 'PENDING') {
    return (
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryDark }}>지원 완료</Text>
      </View>
    );
  }
  if (status === 'REJECTED') {
    return (
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.dangerSoft }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.danger }}>거절됨</Text>
      </View>
    );
  }
  return null;
}

function ApplyButton({
  status,
  busy,
  onApply,
  onWithdraw,
}: {
  status: WorkerShift['myApplicationStatus'];
  busy: boolean;
  onApply: () => void;
  onWithdraw?: () => void;
}) {
  if (status === 'PENDING') {
    return (
      <View style={{ gap: 8 }}>
        <View
          style={{
            backgroundColor: colors.primarySoft,
            borderRadius: radius.md,
            paddingVertical: 14,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Icon name="hourglass" size={16} color={colors.primaryDark} />
          <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: '700' }}>지원 대기 중 · 점주 확인 대기</Text>
        </View>
        {onWithdraw ? (
          <Pressable
            style={({ pressed }) => [
              {
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
              },
              (busy || pressed) && { opacity: 0.6 },
            ]}
            onPress={onWithdraw}
            disabled={busy}
          >
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>지원 취소</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (status === 'REJECTED') {
    return (
      <View
        style={{
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.md,
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>이미 거절된 지원</Text>
      </View>
    );
  }
  return (
    <GradientButton
      onPress={onApply}
      disabled={busy}
      label={busy ? '지원 중...' : '1탭 지원'}
      icon={<Icon name="flash" size={15} color="#fff" />}
      size="sm"
    />
  );
}
