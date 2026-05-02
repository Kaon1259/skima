import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import {
  WorkerProfile,
  fmtDateTime,
  fmtKRW,
  fmtPercent,
} from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

export default function WorkerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const data = await api<WorkerProfile>(`/api/workers/${id}/profile`);
      setProfile(data);
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (!profile) {
    return (
      <View style={[styles.screenPadded, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.bodyMuted}>워커 정보를 불러오는 중...</Text>
      </View>
    );
  }

  const s = profile.stats;
  const totalHours = Math.round((s.totalWorkedMinutes / 60) * 10) / 10;

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={profile.recentMatches}
      keyExtractor={(m) => String(m.matchId)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          {/* 헤더 */}
          <View style={[styles.card, { marginBottom: spacing.md }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 22 }}>
                  {profile.name.slice(-1)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.h2, { fontSize: 20 }]}>{profile.name}</Text>
                <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 2 }]}>워커</Text>
              </View>
            </View>
          </View>

          {/* KPI */}
          <View style={[styles.card, { marginBottom: spacing.md, flexDirection: 'row', gap: 8 }]}>
            <Stat label="평균 별점" value={s.avgRating != null ? `★ ${s.avgRating.toFixed(1)}` : '신규'}
                  sub={`${s.ratingsCount}건`} color={colors.warn} />
            <Stat label="재고용률" value={s.rehireRate != null ? fmtPercent(s.rehireRate) : '—'}
                  sub="또 부르고싶음" color={colors.success} />
            <Stat label="완료 매칭" value={`${s.completedMatches}회`} sub={`총 ${s.totalMatches}회`} color={colors.info} />
            <Stat label="노쇼" value={s.noShowRate != null ? fmtPercent(s.noShowRate) : '0%'}
                  sub={`${s.noShowCount}회`} color={s.noShowCount > 0 ? colors.danger : colors.textMuted} />
          </View>

          {/* 누적 */}
          <View style={[styles.card, { marginBottom: spacing.md }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[styles.bodyMuted, { fontSize: 12, fontWeight: '700' }]}>누적 근무시간</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{totalHours}시간</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[styles.bodyMuted, { fontSize: 12, fontWeight: '700' }]}>누적 수입 (실수령)</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{fmtKRW(s.totalEarnings)}</Text>
            </View>
          </View>

          {/* 별점 분포 */}
          {s.ratingsCount > 0 ? (
            <View style={[styles.card, { marginBottom: spacing.md }]}>
              <Text style={[styles.title, { marginBottom: 10 }]}>별점 분포</Text>
              {[5, 4, 3, 2, 1].map((star) => {
                const idx = star - 1;
                const count = profile.scoreDistribution[idx] ?? 0;
                const pct = s.ratingsCount > 0 ? count / s.ratingsCount : 0;
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

          {/* 받은 평가 */}
          {profile.recentReviews.length > 0 ? (
            <View style={[styles.card, { marginBottom: spacing.md }]}>
              <Text style={[styles.title, { marginBottom: 8 }]}>받은 평가</Text>
              {profile.recentReviews.map((r) => (
                <View
                  key={r.id}
                  style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 16, color: colors.warn, fontWeight: '900' }}>
                      {'★'.repeat(r.score)}
                      <Text style={{ color: colors.border }}>{'☆'.repeat(5 - r.score)}</Text>
                    </Text>
                    {r.willRehire ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radius.pill,
                          backgroundColor: colors.successSoft,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.success }}>또 부르고싶음</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 4 }]}>
                    {r.cafeName} · {fmtDateTime(r.createdAt)}
                  </Text>
                  {r.comment ? (
                    <Text style={[styles.body, { marginTop: 6, fontSize: 13 }]}>"{r.comment}"</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[styles.h2, { fontSize: 18, marginTop: 8, marginBottom: 4 }]}>
            최근 매칭 이력
          </Text>
          <Text style={[styles.subtitle, { marginBottom: 12 }]}>
            {profile.recentMatches.length === 0 ? '아직 매칭 이력이 없어요' : `최근 ${profile.recentMatches.length}건`}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
          <Text style={styles.bodyMuted}>매칭 이력이 없어요</Text>
        </View>
      }
      renderItem={({ item }) => {
        const v = statusVisual(item.status);
        return (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(`/cafe/${item.cafeId}` as never)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {item.cafeName}
                </Text>
                <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                  {item.workDate}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: v.bg }]}>
                <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '900', color, marginTop: 6, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 2 }}>{sub}</Text>
    </View>
  );
}
