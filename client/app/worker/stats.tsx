import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { Payout, Rating, WorkerStats, fmtDateTime, fmtKRW, fmtPercent } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

export default function WorkerStatsScreen() {
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, r, p] = await Promise.all([
        api<WorkerStats>('/api/worker/me/stats'),
        api<Rating[]>('/api/worker/me/ratings'),
        api<Payout[]>('/api/worker/payouts').catch(() => [] as Payout[]),
      ]);
      setStats(s);
      setRatings(r);
      setPayouts(p);
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const totalHours = stats ? Math.round(stats.totalWorkedMinutes / 6) / 10 : 0; // 0.1h precision
  const ratingsCount = stats?.ratingsCount ?? 0;
  const dist = stats?.scoreDistribution ?? [0, 0, 0, 0, 0];

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={ratings}
      keyExtractor={(r) => String(r.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>내 통계</Text>
              <Text style={[styles.subtitle, { marginTop: 4 }]}>
                누적 근무·평가 — 점주에게 검증된 워커가 되는 길
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/worker/profile' as never)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  backgroundColor: colors.surface,
                  flexDirection: 'row',
                  gap: 4,
                  alignItems: 'center',
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ fontSize: 12 }}>⚙️</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>내 프로필</Text>
            </Pressable>
          </View>

          {/* 요약 카드들 */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            <SummaryCard label="누적 근무" value={`${totalHours}시간`} bg={colors.primarySoft} fg={colors.primaryDark} />
            <SummaryCard label="누적 수입" value={fmtKRW(stats?.totalEarnings ?? 0)} bg={colors.successSoft} fg={colors.success} />
            <SummaryCard label="총 매칭" value={`${stats?.totalMatches ?? 0}건`} bg={colors.infoSoft} fg={colors.info} />
            <SummaryCard label="완료" value={`${stats?.completedMatches ?? 0}건`} bg={colors.surfaceAlt} fg={colors.text} />
          </View>

          {/* PMF 시그널 */}
          <View
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
              평가 지표
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <Metric
                label="평균 별점"
                value={stats?.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
                sub={stats?.avgRating != null ? '★'.repeat(Math.round(stats.avgRating)) : ''}
                color={colors.warn}
              />
              <Metric
                label="재고용 의향"
                value={stats?.rehireRate != null ? fmtPercent(stats.rehireRate) : '—'}
                sub={`평가 ${ratingsCount}건`}
                color={colors.success}
              />
              <Metric
                label="노쇼율"
                value={stats?.noShowRate != null ? fmtPercent(stats.noShowRate) : '0%'}
                sub={`총 ${stats?.noShowCount ?? 0}회`}
                color={colors.danger}
              />
            </View>
          </View>

          {/* 월별 수입 미니 차트 (3개월) */}
          <MonthlyIncomeChart payouts={payouts} />

          {/* 별점 분포 — Day 5 */}
          {ratingsCount > 0 ? (
            <View
              style={{
                marginTop: 14,
                padding: 16,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 }}>
                별점 분포
              </Text>
              {[5, 4, 3, 2, 1].map((star) => {
                const idx = star - 1;
                const count = dist[idx] ?? 0;
                const pct = ratingsCount > 0 ? count / ratingsCount : 0;
                return (
                  <View key={star} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ width: 28, fontSize: 12, fontWeight: '700', color: colors.text }}>
                      {star}★
                    </Text>
                    <View
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.surfaceMuted,
                        overflow: 'hidden',
                        marginHorizontal: 8,
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.round(pct * 100)}%`,
                          height: '100%',
                          backgroundColor: colors.warn,
                        }}
                      />
                    </View>
                    <Text style={{ width: 36, fontSize: 11, color: colors.textMuted, textAlign: 'right' }}>
                      {count}건
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={[styles.h2, { fontSize: 18, marginTop: 24, marginBottom: 4 }]}>받은 평가</Text>
          <Text style={[styles.subtitle, { marginBottom: 12 }]}>
            점주들이 남긴 평가
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>⭐</Text>
          <Text style={styles.bodyMuted}>아직 받은 평가가 없어요</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          onPress={() => router.push(`/cafe/${item.cafeId}` as never)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, color: colors.warn, fontWeight: '900' }}>
              {'★'.repeat(item.score)}
              <Text style={{ color: colors.border }}>{'☆'.repeat(5 - item.score)}</Text>
            </Text>
            {item.willRehire ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                  backgroundColor: colors.successSoft,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>또 부르고 싶음</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{item.cafeName}</Text>
            <Icon name="chevron-forward" size={12} color={colors.textLight} />
            <Text style={[styles.bodyMuted, { fontSize: 11 }]}>· {fmtDateTime(item.createdAt)}</Text>
          </View>
          {item.comment ? (
            <Text style={[styles.body, { marginTop: 8 }]}>"{item.comment}"</Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}

function MonthlyIncomeChart({ payouts }: { payouts: Payout[] }) {
  // 최근 6개월 슬롯, 차트는 3개월 표시 (월말까지)
  const months: { key: string; label: string; net: number; count: number }[] = [];
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: `${d.getMonth() + 1}월`, net: 0, count: 0 });
  }
  for (const p of payouts) {
    if (p.status !== 'COMPLETED') continue;
    const ref = p.completedAt ?? p.workDate ?? p.triggerAt;
    if (!ref) continue;
    const key = ref.slice(0, 7);
    const slot = months.find((m) => m.key === key);
    if (slot) {
      slot.net += p.netAmount ?? 0;
      slot.count += 1;
    }
  }
  const max = Math.max(1, ...months.map((m) => m.net));
  const total = months.reduce((s, m) => s + m.net, 0);
  if (total === 0) return null;
  return (
    <View
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 }}>
          최근 3개월 수입
        </Text>
        <Text style={{ fontSize: 11, color: colors.textLight }}>
          이번달 {fmtKRW(months[months.length - 1]?.net ?? 0)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end', height: 120 }}>
        {months.map((m) => {
          const h = max === 0 ? 0 : Math.round((m.net / max) * 90);
          const isCurrent = m.key === months[months.length - 1].key;
          return (
            <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
                {m.net > 0 ? fmtKRW(m.net) : '—'}
              </Text>
              <View
                style={{
                  width: '100%',
                  height: Math.max(2, h),
                  backgroundColor: isCurrent ? colors.primary : colors.primarySoft,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                }}
              />
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 6 }}>
                {m.label}
              </Text>
              {m.count > 0 ? (
                <Text style={{ fontSize: 10, color: colors.textLight }}>
                  {m.count}건
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SummaryCard({ label, value, bg, fg }: { label: string; value: string; bg: string; fg: string }) {
  return (
    <View
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        padding: 14,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '900', color: fg, marginTop: 6, letterSpacing: -0.5 }}>
        {value}
      </Text>
    </View>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 4 }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}
