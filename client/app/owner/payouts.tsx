import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { GradientButton } from '@/components/Gradient';
import { Icon } from '@/components/Icon';
import { RatingModal, blurFocusedForModal } from '@/components/RatingModal';
import { SkeletonList } from '@/components/Skeleton';
import { api } from '@/lib/api';
import { Payout, fmtDateTime, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

type Filter = 'ALL' | 'REQUESTED' | 'SCHEDULED' | 'COMPLETED';

const FILTER_LABEL: Record<Filter, string> = {
  ALL: '전체',
  REQUESTED: '⏳ 승인 대기',
  SCHEDULED: '💸 진행중',
  COMPLETED: '✅ 완료',
};

export default function OwnerPayoutsScreen() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [approveTarget, setApproveTarget] = useState<{ matchId: number; workerName: string } | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<Payout[]>('/api/owner/payouts');
      setPayouts(data);
    } catch (e) {
      const msg = (e as Error).message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
      setInitialLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (filter === 'ALL') return payouts;
    return payouts.filter((p) => p.status === filter);
  }, [payouts, filter]);

  // 헤더 KPI — 이번달 지출, SLA 충족률, 승인 대기 건수
  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyCompleted = payouts.filter((p) =>
      p.status === 'COMPLETED' && p.completedAt && new Date(p.completedAt) >= monthStart);
    const monthlyGross = monthlyCompleted.reduce((s, p) => s + (p.grossAmount ?? 0), 0);
    const monthlyFee = monthlyCompleted.reduce((s, p) => s + (p.platformFee ?? 0), 0);
    const monthlyTotal = monthlyGross + monthlyFee;
    const requestedCount = payouts.filter((p) => p.status === 'REQUESTED').length;
    const slaPayouts = monthlyCompleted.filter((p) => p.elapsedMinutes != null);
    const slaHits = slaPayouts.filter((p) => (p.elapsedMinutes ?? 0) <= 30).length;
    const slaRate = slaPayouts.length > 0 ? slaHits / slaPayouts.length : null;
    return { monthlyTotal, monthlyGross, monthlyFee, requestedCount, slaRate, monthCount: monthlyCompleted.length };
  }, [payouts]);

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.surfaceAlt }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <View style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.h2}>💸 정산</Text>
                  <Text style={[styles.subtitle, { marginTop: 4 }]}>
                    내 매장 워커 정산 — 승인·SLA·이번달 합계 한 곳에서
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push('/owner/statement' as never)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 12, paddingVertical: 8,
                      borderRadius: radius.pill,
                      borderWidth: 1.5, borderColor: colors.primary,
                      backgroundColor: colors.surface,
                      flexDirection: 'row', gap: 4, alignItems: 'center',
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ fontSize: 12 }}>📄</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                    월간 명세
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 헤더 KPI */}
            {payouts.length > 0 ? (
              <View style={{ marginBottom: spacing.md, gap: 10 }}>
                <View style={[styles.card, { padding: 16, borderWidth: 1, borderColor: colors.primary200, backgroundColor: colors.primary50 }]}>
                  <Text style={{ fontSize: 11, color: colors.primary700, fontWeight: '800', letterSpacing: 0.3 }}>
                    이번달 총 지출 (임금 + 수수료)
                  </Text>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: colors.primary, marginTop: 4, letterSpacing: -0.6 }}>
                    {fmtKRW(kpis.monthlyTotal)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSubtle, marginTop: 4 }}>
                    임금 {fmtKRW(kpis.monthlyGross)} · 수수료 {fmtKRW(kpis.monthlyFee)} · {kpis.monthCount}건 완료
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <KpiCard
                    label="승인 대기"
                    value={`${kpis.requestedCount}`}
                    sub="액션 필요"
                    color={kpis.requestedCount > 0 ? colors.warn : colors.textMuted}
                    bg={kpis.requestedCount > 0 ? colors.warnSoft : colors.surfaceAlt}
                  />
                  <KpiCard
                    label="30분 입금 SLA"
                    value={kpis.slaRate != null ? `${Math.round(kpis.slaRate * 100)}%` : '—'}
                    sub="이번달"
                    color={(kpis.slaRate ?? 0) >= 0.9 ? colors.success : colors.warn}
                    bg={(kpis.slaRate ?? 0) >= 0.9 ? colors.successSoft : colors.warnSoft}
                  />
                </View>
              </View>
            ) : null}

            {/* 필터 칩 */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => {
                const active = filter === f;
                const count = f === 'ALL' ? payouts.length
                  : payouts.filter((p) => p.status === f).length;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[
                      styles.chip,
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {FILTER_LABEL[f]} {count > 0 ? `(${count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          !initialLoaded ? (
            <SkeletonList count={3} />
          ) : (
            <EmptyState
              emoji="💸"
              title="정산 내역이 없어요"
              subtitle="워커가 시프트 끝내면 정산이 자동 생성됩니다. 30분 안에 자동 승인 — 승인 시 즉시 입금"
            />
          )
        }
        renderItem={({ item }) => {
          const v = statusVisual(item.status);
          const needsApprove = item.status === 'REQUESTED';
          return (
            <View
              style={[
                styles.card,
                {
                  marginBottom: 8,
                  borderLeftWidth: needsApprove ? 4 : 0,
                  borderLeftColor: colors.warn,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { fontSize: 14 }]}>
                    {item.workerName ?? `워커 #${item.workerId}`}
                  </Text>
                  <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                    {item.cafeName ?? '매장'} · {item.workDate ? fmtDateTime(item.workDate) : '—'}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: v.bg }]}>
                  <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
                </View>
              </View>

              {/* 금액 */}
              <View
                style={{
                  padding: 10,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceAlt,
                  marginBottom: needsApprove ? 10 : 0,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                    임금 (gross)
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                    {fmtKRW(item.grossAmount ?? 0)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                    수수료 (12%)
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.text }}>
                    {fmtKRW(item.platformFee ?? 0)}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                    워커 수령액 (net)
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: colors.success }}>
                    {fmtKRW(item.netAmount ?? 0)}
                  </Text>
                </View>
                {item.elapsedMinutes != null ? (
                  <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 6 }}>
                    {item.autoApproved ? '자동 승인' : '점주 승인'} → 입금까지 {item.elapsedMinutes}분
                  </Text>
                ) : null}
              </View>

              {/* 액션 — 승인 대기일 때만. ack 강제 게이트 */}
              {needsApprove ? (
                <GradientButton
                  onPress={() => {
                    if (!item.ownerContractAckAt) {
                      const msg = '정산 전 근로계약서 확인이 필요합니다. 확인 화면으로 이동합니다.';
                      if (Platform.OS === 'web') window.alert(msg);
                      else Alert.alert('확인 필요', msg);
                      router.push(`/owner/contract/${item.matchId}?focus=ack` as never);
                      return;
                    }
                    blurFocusedForModal();
                    setApproveTarget({
                      matchId: item.matchId,
                      workerName: item.workerName ?? `워커 #${item.workerId}`,
                    });
                  }}
                  label={item.ownerContractAckAt ? '정산 승인 + 평가' : '📄 계약서 확인 후 정산'}
                  icon={<Text style={{ fontSize: 14 }}>💸</Text>}
                  size="sm"
                />
              ) : null}
            </View>
          );
        }}
      />

      <RatingModal
        visible={approveTarget != null}
        matchId={approveTarget?.matchId ?? null}
        targetName={approveTarget?.workerName ?? ''}
        mode="owner-approve-payout"
        onClose={() => setApproveTarget(null)}
        onSubmitted={() => {
          setApproveTarget(null);
          load();
        }}
      />
    </>
  );
}

function KpiCard({
  label, value, sub, color, bg,
}: {
  label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 14,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '900', color, marginTop: 4 }}>{value}</Text>
      <View
        style={{
          marginTop: 6, paddingHorizontal: 6, paddingVertical: 2,
          borderRadius: radius.pill, alignSelf: 'flex-start',
          backgroundColor: bg,
        }}
      >
        <Text style={{ fontSize: 9, color, fontWeight: '800' }}>{sub}</Text>
      </View>
    </View>
  );
}
