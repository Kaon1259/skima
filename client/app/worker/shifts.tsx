import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import ShiftSkillBadges from '@/components/ShiftSkillBadges';
import { api, ApiError } from '@/lib/api';
import { useFocusPolling } from '@/lib/useFocusPolling';
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

type SortMode = 'time' | 'rating' | 'wage';

export default function WorkerShiftsScreen() {
  const [shifts, setShifts] = useState<WorkerShift[]>([]);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [fitOnly, setFitOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('time');

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

  const visibleShifts = useMemo(() => {
    let xs = fitOnly ? shifts.filter(isFitForMe) : shifts.slice();
    if (sortMode === 'rating') {
      xs.sort((a, b) => (b.cafeAvgRating ?? -1) - (a.cafeAvgRating ?? -1));
    } else if (sortMode === 'wage') {
      xs.sort((a, b) => b.hourlyWage - a.hourlyWage);
    } else {
      xs.sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
    }
    return xs;
  }, [shifts, fitOnly, sortMode, isFitForMe]);

  const profileIncomplete = !!me
    && me.role === 'WORKER'
    && (me.selfReportedLevel == null || (me.capableRoles?.length ?? 0) === 0);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, profile] = await Promise.all([
        api<WorkerShift[]>('/api/worker/shifts'),
        api<MyProfile>('/api/me').catch(() => null),
      ]);
      setShifts(data);
      if (profile) setMe(profile);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusPolling(load, 15000);

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

          {/* 정렬 + 필터 */}
          <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {(['time', 'rating', 'wage'] as SortMode[]).map((m) => {
              const active = sortMode === m;
              const label = m === 'time' ? '⏰ 시작순' : m === 'rating' ? '★ 별점순' : '💰 시급순';
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
            {myLevelRank != null || myRolesSet.size > 0 || myCertsSet.size > 0 ? (
              <Pressable
                onPress={() => setFitOnly((v) => !v)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: fitOnly ? colors.success : colors.surface,
                    borderWidth: 1,
                    borderColor: fitOnly ? colors.success : colors.border,
                    flexDirection: 'row',
                    gap: 4,
                    alignItems: 'center',
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: fitOnly ? '#fff' : colors.text }}>
                  {fitOnly ? '✓ 내 능력 매칭만' : '내 능력 매칭만'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
            {visibleShifts.length}건 표시{fitOnly && shifts.length !== visibleShifts.length
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

        return (
          <View
            style={[
              styles.card,
              alreadyApplied && { borderWidth: 1.5, borderColor: colors.primary },
              wasRejected && { opacity: 0.6 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8, flexDirection: 'row', gap: 10 }}>
                {/* 브랜드 아바타 */}
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: item.brandColor ?? colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>
                    {item.brandLetter ?? '☕'}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push(`/cafe/${item.cafeId}` as never)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.title}>{item.cafeName}</Text>
                    <Icon name="chevron-forward" size={14} color={colors.textLight} />
                    {item.cafeAvgRating != null ? (
                      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.warn }}>
                        ★ {item.cafeAvgRating.toFixed(1)}
                        <Text style={{ color: colors.textMuted, fontWeight: '600' }}>
                          {' '}({item.cafeRatingsCount ?? 0})
                        </Text>
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 11, color: colors.textLight, fontWeight: '600' }}>★ 신규</Text>
                    )}
                    {item.cafeNoShowRate != null && item.cafeNoShowRate > 0 ? (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: radius.pill,
                          backgroundColor: colors.dangerSoft,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.danger }}>
                          노쇼 {fmtPercent(item.cafeNoShowRate)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                    {item.cafeType ? (
                      <Text style={[styles.bodyMuted, { fontSize: 11, fontWeight: '700' }]}>
                        {cafeTypeLabel(item.cafeType)}
                      </Text>
                    ) : null}
                    <Text style={[styles.bodyMuted, { fontSize: 11 }]} numberOfLines={1}>
                      · {item.cafeAddress}
                    </Text>
                  </View>
                </Pressable>
              </View>
              <StatusPill status={myStatus} />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>🕐 {fmtDateTime(item.startAt)} 시작</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{dur}시간</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
                <Text style={[styles.chipText, { color: colors.primaryDark }]}>1명 모집</Text>
              </View>
            </View>

            <View
              style={{
                marginTop: 14,
                marginBottom: 14,
                padding: 14,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>예상 보수</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.primary, letterSpacing: -0.5 }}>
                  {fmtKRW(totalEst)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 8 }}>
                  시급 {fmtKRW(item.hourlyWage)}
                </Text>
              </View>
              {item.description ? (
                <Text style={[styles.bodyMuted, { marginTop: 6 }]}>{item.description}</Text>
              ) : null}
            </View>

            <ShiftSkillBadges
              jobRole={item.jobRole}
              minSkill={item.minSkill}
              requirements={item.requirements}
              myLevel={me?.selfReportedLevel as SkillLevel | null | undefined}
              myRoles={me?.capableRoles as JobRole[] | undefined}
              myCertifications={me?.certifications}
            />

            <ApplyButton
              status={myStatus}
              busy={busyId === item.id}
              onApply={() => apply(item.id)}
              onWithdraw={() => withdraw(item.id)}
            />
          </View>
        );
      }}
    />
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
    <Pressable
      style={({ pressed }) => [
        styles.buttonPrimary,
        { flexDirection: 'row', gap: 6 },
        (busy || pressed) && { opacity: 0.85 },
      ]}
      onPress={onApply}
      disabled={busy}
    >
      <Icon name="flash" size={16} color="#fff" />
      <Text style={styles.buttonPrimaryText}>{busy ? '지원 중...' : '1탭 지원'}</Text>
    </Pressable>
  );
}
