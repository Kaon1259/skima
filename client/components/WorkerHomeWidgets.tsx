import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFocusPolling } from '@/lib/useFocusPolling';
import {
  MyProfile,
  NotificationItem,
  Payout,
  ShiftInvitationItem,
  ShiftMatch,
  WorkerStats,
  fmtDateTime,
  fmtKRW,
} from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

/**
 * 워커 시프트 화면 상단에 노출되는 컨텍스트 위젯 묶음.
 * 오늘 매칭 / 다음 매칭 / 이번주 받을 돈 / 평점·단골 / 단골 매장 새 시프트 / 능력 배너.
 * 자기 데이터를 자체 fetch + 15s 폴링.
 */
export function WorkerHomeWidgets() {
  const { auth } = useAuth();
  const [matches, setMatches] = useState<ShiftMatch[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [favCount, setFavCount] = useState(0);
  const [favShiftAlerts, setFavShiftAlerts] = useState<NotificationItem[]>([]);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [invitations, setInvitations] = useState<ShiftInvitationItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [m, p, s, favs, notifs, profile, invs] = await Promise.all([
        api<ShiftMatch[]>('/api/worker/matches').catch(() => [] as ShiftMatch[]),
        api<Payout[]>('/api/worker/payouts').catch(() => [] as Payout[]),
        api<WorkerStats>('/api/worker/me/stats').catch(() => null),
        api<number[]>('/api/worker/favorites/cafes').catch(() => [] as number[]),
        api<NotificationItem[]>('/api/worker/notifications').catch(() => [] as NotificationItem[]),
        api<MyProfile>('/api/me').catch(() => null),
        api<ShiftInvitationItem[]>('/api/worker/invitations').catch(() => [] as ShiftInvitationItem[]),
      ]);
      setMatches(m);
      setPayouts(p);
      setStats(s);
      setFavCount(favs.length);
      setFavShiftAlerts(notifs.filter((n) => n.type === 'FAVORITE_CAFE_NEW_SHIFT'));
      setMe(profile);
      setInvitations(invs);
    } catch {
      // silent — 시프트 화면 자체 폴링이 따로 도니까
    }
  }, []);

  useFocusPolling(load, 15000);

  // ---- 위젯 데이터 가공 ----
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 3600 * 1000);

  // 이번주 시작(월요일) ~ 끝(일요일)
  const dow = (now.getDay() + 6) % 7; // 월=0
  const weekStart = new Date(startOfToday.getTime() - dow * 24 * 3600 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

  const todayMatch = matches.find((m) => {
    if (!m.shiftStartAt) return false;
    const t = new Date(m.shiftStartAt).getTime();
    return (
      m.status === 'CHECKED_IN'
      || (m.status === 'MATCHED' && t >= startOfToday.getTime() && t < endOfToday.getTime())
    );
  });

  const nextMatch = matches
    .filter((m) => {
      if (m.status !== 'MATCHED') return false;
      if (!m.shiftStartAt) return false;
      return new Date(m.shiftStartAt).getTime() > now.getTime();
    })
    .sort((a, b) => (a.shiftStartAt ?? '').localeCompare(b.shiftStartAt ?? ''))[0];

  const weekIncome = payouts
    .filter((p) => {
      const ref = p.completedAt ?? p.approvedAt ?? p.triggerAt;
      if (!ref) return false;
      const t = new Date(ref).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    })
    .reduce((sum, p) => sum + p.netAmount, 0);

  const weekIncomeStatusCount = {
    pending: payouts.filter((p) => p.status === 'REQUESTED' || p.status === 'SCHEDULED').length,
    completed: payouts.filter((p) => p.status === 'COMPLETED').length,
  };

  const profileIncomplete = !!me
    && me.role === 'WORKER'
    && (me.selfReportedLevel == null || (me.capableRoles?.length ?? 0) === 0);

  // 위젯 0건이면 컴포넌트 자체 숨김 (활성 워커 + 매칭 0 + payout 0 + stats 0 + 단골 0 — 가장 비어있는 상태)
  const hasAny = todayMatch || nextMatch || weekIncome > 0 || (stats?.ratingsCount ?? 0) > 0 || favCount > 0 || favShiftAlerts.length > 0 || profileIncomplete || invitations.length > 0;
  if (!hasAny) {
    return (
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[styles.h2, { fontSize: 20 }]}>
          {auth?.name ? `${auth.name}님,` : '안녕하세요,'} 오늘도 화이팅 👋
        </Text>
        <Text style={[styles.subtitle, { marginTop: 4 }]}>
          아래 시프트 목록에서 1탭으로 지원하세요
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {/* 인사 */}
      <View style={{ marginBottom: spacing.md }}>
        <Text style={[styles.h2, { fontSize: 20 }]}>
          {auth?.name ? `${auth.name}님,` : '안녕하세요,'} 오늘도 화이팅 👋
        </Text>
      </View>

      {/* 점주 직접 호출 (초대) — 가장 위에 강조 */}
      {invitations.length > 0 ? (
        <Pressable
          onPress={() => router.push('/worker/invitations' as never)}
          style={({ pressed }) => [
            {
              padding: 14,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: spacing.md,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 24 }}>📨</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>
              점주가 직접 호출했어요 — {invitations.length}건
            </Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              1탭 수락하면 매칭 즉시 확정 (지원 없이 바로)
            </Text>
          </View>
          <Text style={{ fontSize: 18, color: '#fff' }}>›</Text>
        </Pressable>
      ) : null}

      {profileIncomplete ? (
        <Pressable
          onPress={() => router.push('/worker/profile' as never)}
          style={({ pressed }) => [
            {
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: colors.warnSoft,
              borderWidth: 1,
              borderColor: colors.warn,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: spacing.md,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 22 }}>⚙️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.warn }}>
              내 프로필을 완성해 주세요
            </Text>
            <Text style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>
              등급·직무·자격을 등록하면 매칭율이 올라갑니다
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* 위젯 1 — 오늘 매칭 (있을 때만) */}
      {todayMatch ? (
        <Pressable
          onPress={() => router.push(`/worker/matches?focus=${todayMatch.id}` as never)}
          style={({ pressed }) => [
            {
              padding: 16,
              borderRadius: radius.lg,
              backgroundColor: colors.primary,
              borderWidth: 1,
              borderColor: colors.primary,
              marginBottom: spacing.md,
            },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 }}>
            오늘의 매칭
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 4 }}>
            {todayMatch.cafeName ?? '매장'}
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
            {todayMatch.shiftStartAt ? fmtDateTime(todayMatch.shiftStartAt) : '시간 미정'}
            {todayMatch.shiftEndAt ? ` ~ ${fmtDateTime(todayMatch.shiftEndAt)}` : ''}
            {' · '}
            {todayMatch.status === 'CHECKED_IN' ? '근무중' : todayMatch.status === 'MATCHED' ? '시작 대기' : todayMatch.status}
          </Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 8, fontWeight: '700' }}>
            {todayMatch.status === 'CHECKED_IN'
              ? '👉 탭해서 체크아웃 / 채팅'
              : '👉 탭해서 체크인 / 채팅'}
          </Text>
        </Pressable>
      ) : null}

      {/* 위젯 2 — 다음 매칭 */}
      {nextMatch ? (
        <Pressable
          onPress={() => router.push(`/worker/matches?focus=${nextMatch.id}` as never)}
          style={({ pressed }) => [
            {
              padding: 14,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: spacing.md,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 22 }}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted }}>다음 매칭</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 2 }}>
              {nextMatch.cafeName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
              {nextMatch.shiftStartAt ? fmtDateTime(nextMatch.shiftStartAt) : '시간 미정'}
              {nextMatch.hourlyWage ? ` · 시급 ${fmtKRW(nextMatch.hourlyWage)}` : ''}
            </Text>
          </View>
          <Text style={{ fontSize: 16, color: colors.textLight }}>›</Text>
        </Pressable>
      ) : null}

      {/* 위젯 3 — 이번주 수입 + 위젯 4 — 평점/단골 (가로 2개, 데이터 있을 때만) */}
      {weekIncome > 0 || (stats?.ratingsCount ?? 0) > 0 || favCount > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
          <Pressable
            onPress={() => router.push('/worker/payouts' as never)}
            style={({ pressed }) => [
              {
                flex: 1,
                padding: 14,
                borderRadius: radius.md,
                backgroundColor: colors.successSoft,
                borderWidth: 1,
                borderColor: colors.success,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.success }}>이번주 받을 돈</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.success, marginTop: 6, letterSpacing: -0.5 }}>
              {fmtKRW(weekIncome)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.text, marginTop: 4 }}>
              {weekIncomeStatusCount.pending > 0
                ? `정산 진행중 ${weekIncomeStatusCount.pending}건`
                : weekIncomeStatusCount.completed > 0
                ? `완료 ${weekIncomeStatusCount.completed}건`
                : '아직 정산 없음'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/worker/me' as never)}
            style={({ pressed }) => [
              {
                flex: 1,
                padding: 14,
                borderRadius: radius.md,
                backgroundColor: colors.warnSoft,
                borderWidth: 1,
                borderColor: colors.warn,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.warn }}>내 평점 · 단골</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.warn, marginTop: 6 }}>
              {stats?.avgRating != null ? `★ ${stats.avgRating.toFixed(1)}` : '★ —'}
            </Text>
            <Text style={{ fontSize: 10, color: colors.text, marginTop: 4 }}>
              평가 {stats?.ratingsCount ?? 0}개 · 단골 {favCount}곳
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* 즐겨찾기 매장 새 시프트 */}
      {favShiftAlerts.length > 0 ? (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[styles.subtitle, { fontWeight: '800', marginBottom: 8 }]}>
            ⭐ 단골 매장 새 시프트 ({favShiftAlerts.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: spacing.lg }}>
            {favShiftAlerts.slice(0, 8).map((it) => (
              <Pressable
                key={`${it.type}:${it.targetId}:${it.at}`}
                onPress={() => router.push(it.route as never)}
                style={({ pressed }) => [
                  {
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: radius.md,
                    backgroundColor: colors.successSoft,
                    borderWidth: 1.5,
                    borderColor: colors.success,
                    minWidth: 200,
                    maxWidth: 260,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.success }} numberOfLines={1}>
                  {it.title}
                </Text>
                <Text style={{ fontSize: 11, color: colors.text, marginTop: 4 }} numberOfLines={2}>
                  {it.subtitle}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
                  {fmtDateTime(it.at)} 등록
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
