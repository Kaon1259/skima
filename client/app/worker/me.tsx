import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { WorkerHomeWidgets } from '@/components/WorkerHomeWidgets';
import { WorkerTierBadge } from '@/components/WorkerTierBadge';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { deleteImage, pickAndUploadImage } from '@/lib/imageUpload';
import {
  MyProfile,
  Payout,
  Rating,
  SkillLevel,
  SKILL_LEVEL_LABEL,
  WorkerStats,
  fmtDateTime,
  fmtKRW,
  fmtPercent,
} from '@/lib/types';
import { activePrefsCount, useWorkerPrefs } from '@/lib/workerPrefs';
import { colors, radius, spacing, styles } from '@/lib/theme';

export default function WorkerMyPageScreen() {
  const { auth, logout } = useAuth();
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [givenRatings, setGivenRatings] = useState<Rating[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { prefs, update: updatePrefs, reset: resetPrefs } = useWorkerPrefs();
  const prefCount = activePrefsCount(prefs);

  // prefs 변경 시 백엔드에도 sync — 알림 채널 적용 위해
  async function persistPrefsToBackend(next: { minWage: number; minCafeRating: number | null; maxCafeNoShowRate: number | null }) {
    try {
      await api('/api/me/worker-profile', {
        method: 'PUT',
        body: {
          prefMinWage: next.minWage > 0 ? next.minWage : null,
          prefMinCafeRating: next.minCafeRating,
          prefMaxCafeNoShowRate: next.maxCafeNoShowRate,
          updatePrefs: true,
        },
      });
    } catch {
      // 네트워크 실패 시 클라 로컬은 유지
    }
  }
  async function handleUpdatePrefs(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch };
    await updatePrefs(patch);
    persistPrefsToBackend(next);
  }
  async function handleResetPrefs() {
    await resetPrefs();
    persistPrefsToBackend({ minWage: 0, minCafeRating: null, maxCafeNoShowRate: null });
  }

  const [busyPhoto, setBusyPhoto] = useState(false);
  async function handleUploadPhoto() {
    setBusyPhoto(true);
    try {
      const url = await pickAndUploadImage('/api/me/profile-image');
      // 로컬 me 갱신
      setMe((prev) => prev ? { ...prev, profileImage: url } : prev);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'cancelled') {
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('오류', msg);
      }
    } finally {
      setBusyPhoto(false);
    }
  }
  async function handleDeletePhoto() {
    setBusyPhoto(true);
    try {
      await deleteImage('/api/me/profile-image');
      setMe((prev) => prev ? { ...prev, profileImage: null } : prev);
    } catch (e) {
      if (Platform.OS === 'web') window.alert((e as Error).message);
      else Alert.alert('오류', (e as Error).message);
    } finally {
      setBusyPhoto(false);
    }
  }

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, r, gr, p, profile] = await Promise.all([
        api<WorkerStats>('/api/worker/me/stats'),
        api<Rating[]>('/api/worker/me/ratings'),
        api<Rating[]>('/api/worker/me/ratings/given').catch(() => [] as Rating[]),
        api<Payout[]>('/api/worker/payouts').catch(() => [] as Payout[]),
        api<MyProfile>('/api/me').catch(() => null),
      ]);
      setStats(s);
      setRatings(r);
      setGivenRatings(gr);
      setPayouts(p);
      setMe(profile);
      // 백엔드 prefs 가 로컬과 다르면 sync — 디바이스 간 동기화
      if (profile) {
        const backendPrefs = {
          minWage: profile.prefMinWage ?? 0,
          minCafeRating: profile.prefMinCafeRating ?? null,
          maxCafeNoShowRate: profile.prefMaxCafeNoShowRate ?? null,
        };
        if (backendPrefs.minWage !== prefs.minWage
            || backendPrefs.minCafeRating !== prefs.minCafeRating
            || backendPrefs.maxCafeNoShowRate !== prefs.maxCafeNoShowRate) {
          updatePrefs(backendPrefs);
        }
      }
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, [prefs, updatePrefs]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const totalHours = stats ? Math.round(stats.totalWorkedMinutes / 6) / 10 : 0;
  const ratingsCount = stats?.ratingsCount ?? 0;
  const dist = stats?.scoreDistribution ?? [0, 0, 0, 0, 0];
  const profileIncomplete = !!me
    && me.role === 'WORKER'
    && (me.selfReportedLevel == null || (me.capableRoles?.length ?? 0) === 0);

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
          {/* 오늘 매칭 / 다음 매칭 / 단골 매장 새 시프트 / 점주 직접 호출 등 — 시프트 화면에서 옮겨옴 */}
          <WorkerHomeWidgets />

          {/* 프로필 헤더 */}
          <View style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={handleUploadPhoto}
              disabled={busyPhoto}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Avatar
                name={auth?.name ?? '워커'}
                imageUrl={me?.profileImage}
                size={56}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.h2, { fontSize: 20 }]}>{auth?.name ?? '워커'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <WorkerTierBadge tier={stats?.tier} size="md" />
                {me?.selfReportedLevel ? (
                  <View style={{
                    paddingHorizontal: 6, paddingVertical: 2,
                    borderRadius: radius.pill, backgroundColor: colors.primarySoft,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: colors.primaryDark }}>
                      {SKILL_LEVEL_LABEL[me.selfReportedLevel as SkillLevel]?.short ?? me.selfReportedLevel}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>등급 미설정</Text>
                )}
                {me?.experienceYears != null ? (
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    · 경력 {me.experienceYears}년
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable
              onPress={() => logout()}
              hitSlop={6}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: radius.pill,
                  borderWidth: 1, borderColor: colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>로그아웃</Text>
            </Pressable>
          </View>

          {/* 프로필 편집 진입 — 큰 CTA */}
          <Pressable
            onPress={() => router.push('/worker/profile' as never)}
            style={({ pressed }) => [
              {
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 14,
                borderRadius: radius.md,
                backgroundColor: profileIncomplete ? colors.warnSoft : colors.surface,
                borderWidth: 1.5,
                borderColor: profileIncomplete ? colors.warn : colors.primary,
                marginBottom: spacing.md,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ fontSize: 22 }}>⚙️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: profileIncomplete ? colors.warn : colors.primaryDark }}>
                {profileIncomplete ? '프로필 미완성 — 등록하기' : '내 프로필 편집'}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                등급·직무·자격 · 자기소개·경력·가능시간대
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: profileIncomplete ? colors.warn : colors.primary }}>›</Text>
          </Pressable>

          {/* 내 문서 빠른 진입 */}
          <Pressable
            onPress={() => router.push('/worker/documents' as never)}
            style={({ pressed }) => [
              {
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 14,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.border,
                marginBottom: spacing.md,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ fontSize: 22 }}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>내 문서 모음</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                근로계약서·원천징수영수증 한 곳에서 (월별 그룹)
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: colors.textLight }}>›</Text>
          </Pressable>

          {/* 선호 조건 — 영구 필터 (시프트 화면 default 좁히기) */}
          <View
            style={{
              padding: 16,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: prefCount > 0 ? colors.primary : colors.border,
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                🎯 선호 조건
                {prefCount > 0 ? (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                    {' · '}활성 {prefCount}개
                  </Text>
                ) : null}
              </Text>
              {prefCount > 0 ? (
                <Pressable onPress={handleResetPrefs} hitSlop={6}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.danger }}>초기화</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>
              시프트 검색 화면에서 항상 적용 — 시급·매장 신뢰도 기준 자동 좁히기
            </Text>

            {/* 최소 시급 */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              💰 최소 시급
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[0, 10000, 11000, 12000, 13000, 15000].map((w) => {
                const active = prefs.minWage === w;
                return (
                  <Pressable
                    key={w}
                    onPress={() => handleUpdatePrefs({ minWage: w })}
                    style={[
                      styles.chip,
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {w === 0 ? '제한 없음' : `${w / 1000}k+`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 최소 매장 평점 */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              ⭐ 매장 평점 (★ 미만 매장 제외)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[null, 3.0, 3.5, 4.0, 4.5].map((v) => {
                const active = prefs.minCafeRating === v;
                return (
                  <Pressable
                    key={String(v)}
                    onPress={() => handleUpdatePrefs({ minCafeRating: v })}
                    style={[
                      styles.chip,
                      active && { backgroundColor: colors.warn, borderColor: colors.warn },
                    ]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {v == null ? '제한 없음' : `★${v.toFixed(1)}+`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 최대 매장 노쇼율 */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              🚫 매장 노쇼율 (초과 매장 제외)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[null, 0.05, 0.1, 0.2].map((v) => {
                const active = prefs.maxCafeNoShowRate === v;
                return (
                  <Pressable
                    key={String(v)}
                    onPress={() => handleUpdatePrefs({ maxCafeNoShowRate: v })}
                    style={[
                      styles.chip,
                      active && { backgroundColor: colors.danger, borderColor: colors.danger },
                    ]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {v == null ? '제한 없음' : `≤ ${Math.round(v * 100)}%`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 최대 거리 */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              📍 최대 거리 (위치 권한 필요)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[null, 5, 10, 30].map((v) => {
                const active = prefs.maxDistanceKm === v;
                return (
                  <Pressable
                    key={String(v)}
                    onPress={() => handleUpdatePrefs({ maxDistanceKm: v })}
                    style={[
                      styles.chip,
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {v == null ? '제한 없음' : `${v}km`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 12, lineHeight: 14 }}>
              💡 단골 등록 매장은 신뢰도 기준에 관계없이 항상 노출됩니다 (자기 책임 선택)
            </Text>
          </View>

          {/* 요약 카드들 */}
          <Text style={[styles.subtitle, { fontWeight: '800', marginBottom: 8, marginTop: 8 }]}>누적 통계</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <SummaryCard label="누적 근무" value={`${totalHours}시간`} fg={colors.primaryDark} />
            <SummaryCard label="누적 수입" value={fmtKRW(stats?.totalEarnings ?? 0)} fg={colors.success} />
            <SummaryCard label="총 매칭" value={`${stats?.totalMatches ?? 0}건`} fg={colors.info} />
            <SummaryCard label="완료" value={`${stats?.completedMatches ?? 0}건`} fg={colors.text} />
          </View>

          {/* PMF 시그널 */}
          <View
            style={{
              marginTop: 14, padding: 16, borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.border,
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

          {/* 월별 수입 미니 차트 */}
          <MonthlyIncomeChart payouts={payouts} />

          {/* 별점 분포 */}
          {ratingsCount > 0 ? (
            <View
              style={{
                marginTop: 14, padding: 16, borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.border,
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
                        flex: 1, height: 8, borderRadius: 4,
                        backgroundColor: colors.surfaceMuted, overflow: 'hidden',
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

          {/* 내가 매장에 준 평가 — 점주가 매장을 어떻게 평가했는지 */}
          {givenRatings.length > 0 ? (
            <View style={[styles.card, { marginTop: 14 }]}>
              <Text style={[styles.title, { marginBottom: 4 }]}>내가 매장에 남긴 평가</Text>
              <Text style={[styles.bodyMuted, { fontSize: 11, marginBottom: 12 }]}>
                다음에 시프트 검색할 때 참고
              </Text>
              {givenRatings.slice(0, 8).map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => router.push(`/cafe/${g.cafeId}` as never)}
                  style={({ pressed }) => [
                    {
                      paddingVertical: 10,
                      borderTopWidth: 1, borderTopColor: colors.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 14, color: colors.warn, fontWeight: '900' }}>
                      {'★'.repeat(g.score)}
                      <Text style={{ color: colors.border }}>{'☆'.repeat(5 - g.score)}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                      {g.cafeName}
                    </Text>
                    {g.willRehire ? (
                      <View style={{
                        paddingHorizontal: 6, paddingVertical: 1,
                        borderRadius: radius.pill, backgroundColor: colors.successSoft,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.success }}>
                          또 가고싶음
                        </Text>
                      </View>
                    ) : (
                      <View style={{
                        paddingHorizontal: 6, paddingVertical: 1,
                        borderRadius: radius.pill, backgroundColor: colors.dangerSoft,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.danger }}>
                          별로
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 4 }]}>
                    {fmtDateTime(g.createdAt)}
                  </Text>
                  {g.comment ? (
                    <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>
                      "{g.comment}"
                    </Text>
                  ) : null}
                </Pressable>
              ))}
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
                  paddingHorizontal: 8, paddingVertical: 3,
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
        marginTop: 14, padding: 16, borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
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
                <Text style={{ fontSize: 10, color: colors.textLight }}>{m.count}건</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SummaryCard({ label, value, fg }: { label: string; value: string; fg: string }) {
  return (
    <View
      style={{
        flexBasis: '47%', flexGrow: 1,
        padding: 14, borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
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
