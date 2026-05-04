import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFocusPolling } from '@/lib/useFocusPolling';
import {
  MyProfile,
  NotificationItem,
  Payout,
  ShiftMatch,
  WorkerStats,
  fmtDateTime,
  fmtKRW,
} from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

export default function WorkerHomeScreen() {
  const { auth } = useAuth();
  const [matches, setMatches] = useState<ShiftMatch[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [favCount, setFavCount] = useState(0);
  const [favShiftAlerts, setFavShiftAlerts] = useState<NotificationItem[]>([]);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [m, p, s, favs, notifs, profile] = await Promise.all([
        api<ShiftMatch[]>('/api/worker/matches').catch(() => [] as ShiftMatch[]),
        api<Payout[]>('/api/worker/payouts').catch(() => [] as Payout[]),
        api<WorkerStats>('/api/worker/me/stats').catch(() => null),
        api<number[]>('/api/worker/favorites/cafes').catch(() => [] as number[]),
        api<NotificationItem[]>('/api/worker/notifications').catch(() => [] as NotificationItem[]),
        api<MyProfile>('/api/me').catch(() => null),
      ]);
      setMatches(m);
      setPayouts(p);
      setStats(s);
      setFavCount(favs.length);
      setFavShiftAlerts(notifs.filter((n) => n.type === 'FAVORITE_CAFE_NEW_SHIFT'));
      setMe(profile);
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
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

  // 모든 활성 매칭에서 점주가 보낸 unread 합산 — 빠른 진입 "내 매칭" 버튼 뱃지에 사용
  const totalChatUnread = matches.reduce((sum, m) => sum + (m.chatUnreadCount ?? 0), 0);

  const profileIncomplete = !!me
    && me.role === 'WORKER'
    && (me.selfReportedLevel == null || (me.capableRoles?.length ?? 0) === 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* 인사 */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[styles.h2, { fontSize: 20 }]}>
          {auth?.name ? `${auth.name}님,` : '안녕하세요,'} 오늘도 화이팅 👋
        </Text>
        <Text style={[styles.subtitle, { marginTop: 4 }]}>
          오늘의 매칭·일정·수입을 한눈에
        </Text>
      </View>

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
              능력 자기신고를 완료해 주세요
            </Text>
            <Text style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>
              매칭율을 높이고 더 좋은 시프트 추천 받기
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* 위젯 1 — 오늘 매칭 */}
      <Pressable
        onPress={() => {
          if (todayMatch) router.push(`/worker/matches?focus=${todayMatch.id}` as never);
          else router.push('/worker/shifts' as never);
        }}
        style={({ pressed }) => [
          {
            padding: 16,
            borderRadius: radius.lg,
            backgroundColor: todayMatch ? colors.primary : colors.surface,
            borderWidth: 1,
            borderColor: todayMatch ? colors.primary : colors.border,
            marginBottom: spacing.md,
          },
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: todayMatch ? 'rgba(255,255,255,0.85)' : colors.textMuted, letterSpacing: 0.5 }}>
          오늘의 매칭
        </Text>
        {todayMatch ? (
          <>
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
            {todayMatch.chatUnreadCount && todayMatch.chatUnreadCount > 0 ? (
              <View
                style={{
                  marginTop: 10,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radius.pill,
                  backgroundColor: '#fff',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Text style={{ fontSize: 13 }}>💬</Text>
                <Text style={{ fontSize: 12, fontWeight: '900', color: colors.danger }}>
                  점주 새 메시지 {todayMatch.chatUnreadCount > 99 ? '99+' : todayMatch.chatUnreadCount}건
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 }}>
              오늘 일정 없음
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
              새 시프트를 찾아보세요 👉
            </Text>
          </>
        )}
      </Pressable>

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

      {/* 위젯 3 — 이번주 수입 + 위젯 4 — 평점/단골 (가로 2개) */}
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
          onPress={() => router.push('/worker/stats' as never)}
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
            평가 {stats?.ratingsCount ?? 0}개 · 단골 매장 {favCount}곳
          </Text>
        </Pressable>
      </View>

      {/* 즐겨찾기 매장 새 시프트 */}
      {favShiftAlerts.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
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
      ) : favCount === 0 ? (
        <View
          style={{
            marginTop: spacing.md,
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 22 }}>⭐</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
              자주 가는 매장을 단골 등록하세요
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              매장 상세에서 ⭐ 누르면 새 시프트가 올라올 때 즉시 알려드려요
            </Text>
          </View>
        </View>
      ) : null}

      {/* 내 프로필 — 풀 너비 강조 */}
      <Pressable
        onPress={() => router.push('/worker/profile' as never)}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.primary,
            marginTop: spacing.lg,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={{ fontSize: 22 }}>⚙️</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primaryDark }}>
            내 프로필 관리
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            등급·직무·자격 + 자기소개·경력·가능시간대
          </Text>
        </View>
        <Text style={{ fontSize: 16, color: colors.primary }}>›</Text>
      </Pressable>

      {/* 빠른 진입 */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
        <Pressable
          onPress={() => router.push('/worker/shifts' as never)}
          style={({ pressed }) => [
            { flex: 1, padding: 14, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center' },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 22 }}>⚡</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primaryDark, marginTop: 4 }}>
            시프트 검색
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/worker/matches' as never)}
          style={({ pressed }) => [
            { flex: 1, padding: 14, borderRadius: radius.md, backgroundColor: colors.infoSoft, alignItems: 'center' },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View>
            <Text style={{ fontSize: 22 }}>✅</Text>
            {totalChatUnread > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -12,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 5,
                  borderRadius: 9,
                  backgroundColor: colors.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.infoSoft,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>
                  {totalChatUnread > 99 ? '99+' : totalChatUnread}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.info, marginTop: 4 }}>
            내 매칭
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/worker/payouts' as never)}
          style={({ pressed }) => [
            { flex: 1, padding: 14, borderRadius: radius.md, backgroundColor: colors.successSoft, alignItems: 'center' },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 22 }}>💰</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.success, marginTop: 4 }}>
            정산
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/worker/documents' as never)}
          style={({ pressed }) => [
            { flex: 1, padding: 14, borderRadius: radius.md, backgroundColor: colors.warnSoft, alignItems: 'center' },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 22 }}>📄</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.warn, marginTop: 4 }}>
            내 문서
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
