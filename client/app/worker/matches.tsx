import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChatSheet } from '@/components/ChatSheet';
import { DisputeModal } from '@/components/DisputeModal';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { RatingModal, blurFocusedForModal } from '@/components/RatingModal';
import { SkeletonList } from '@/components/Skeleton';

import { api } from '@/lib/api';
import { getCurrentCoords } from '@/lib/geolocation';
import { useFocusPolling } from '@/lib/useFocusPolling';
import { ShiftMatch, fmtDateTime, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

function TimelineDot({
  done,
  label,
  time,
  sub,
}: {
  done: boolean;
  label: string;
  time?: string | null;
  sub?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: done ? colors.success : colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        {done ? <Icon name="checkmark" size={12} color="#fff" /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: done ? colors.text : colors.textLight, fontSize: 13, fontWeight: '600' }}>
          {label}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{sub}</Text>
        ) : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{time ? fmtDateTime(time) : '—'}</Text>
    </View>
  );
}

export default function WorkerMatchesScreen() {
  const [matches, setMatches] = useState<ShiftMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ matchId: number; cafeName: string; cafeId: number | null } | null>(null);
  const [chatTarget, setChatTarget] = useState<{ matchId: number; cafeName: string } | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<{ matchId: number; cafeName: string } | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<ShiftMatch[]>('/api/worker/matches');
      setMatches(data);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
      setInitialLoaded(true);
    }
  }, []);

  useFocusPolling(load, 10000);

  async function checkIn(matchId: number) {
    setBusyId(matchId);
    try {
      // GPS 좌표 — 가능하면 함께 보내 매장 반경 100m 게이트 검증
      let coords: { latitude: number; longitude: number } | null = null;
      try {
        coords = await getCurrentCoords();
      } catch {
        // 권한 거부 / 위치 못 받음 — 좌표 없이 진행 (매장에 좌표 있으면 백엔드에서 게이트 적용 안 됨)
      }
      await api(`/api/worker/matches/${matchId}/check-in`, {
        method: 'POST',
        body: coords ?? {},
      });
      notify('출근 체크인 완료');
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function checkOut(matchId: number) {
    setBusyId(matchId);
    try {
      await api(`/api/worker/matches/${matchId}/check-out`, { method: 'POST' });
      notify('퇴근 체크아웃 완료. 30분 안에 입금됩니다.');
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function openRating(m: ShiftMatch) {
    blurFocusedForModal();
    setRatingTarget({
      matchId: m.id,
      cafeName: m.cafeName ?? `시프트 #${m.shiftId}`,
      cafeId: m.cafeId ?? null,
    });
  }
  function openChat(m: ShiftMatch) {
    blurFocusedForModal();
    setChatTarget({ matchId: m.id, cafeName: m.cafeName ?? `시프트 #${m.shiftId}` });
  }

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.surfaceAlt }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        data={matches}
        keyExtractor={(m) => String(m.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.h2}>내 매칭</Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>출근 → 퇴근 → 30분 내 입금</Text>
          </View>
        }
        ListEmptyComponent={
          !initialLoaded ? (
            <SkeletonList count={3} />
          ) : (
            <EmptyState
              emoji="📅"
              title="아직 매칭된 시프트가 없어요"
              subtitle="시프트 검색에서 1탭으로 지원해보세요. 점주가 확정하면 여기에 표시됩니다"
              actions={[{
                label: '시프트 검색',
                onPress: () => router.push('/worker/shifts' as never),
              }]}
            />
          )
        }
        renderItem={({ item }) => {
          const v = statusVisual(item.status);
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Pressable
                  style={({ pressed }) => [{ flex: 1, paddingRight: 8 }, pressed && item.cafeId ? { opacity: 0.7 } : null]}
                  onPress={() => item.cafeId && router.push(`/cafe/${item.cafeId}` as never)}
                  disabled={!item.cafeId}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <Text style={styles.title}>{item.cafeName ?? `시프트 #${item.shiftId}`}</Text>
                    {item.cafeId ? <Icon name="chevron-forward" size={14} color={colors.textLight} /> : null}
                  </View>
                  {item.cafeAddress ? (
                    <Text style={[styles.bodyMuted, { marginTop: 2, fontSize: 12 }]}>{item.cafeAddress}</Text>
                  ) : null}
                  {item.shiftStartAt && item.shiftEndAt ? (
                    <Text style={[styles.bodyMuted, { marginTop: 4, fontSize: 12 }]}>
                      {fmtDateTime(item.shiftStartAt)} ~ {fmtDateTime(item.shiftEndAt)}
                      {item.hourlyWage ? ` · 시급 ${fmtKRW(item.hourlyWage)}` : ''}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={[styles.badge, { backgroundColor: v.bg }]}>
                  <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
                </View>
              </View>

              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <TimelineDot done label="매칭 확정" time={item.matchedAt} />
                <TimelineDot done={!!item.checkInAt} label="출근 체크인" time={item.checkInAt} />
                <TimelineDot done={!!item.checkOutAt} label="퇴근 체크아웃" time={item.checkOutAt} />
                <TimelineDot
                  done={!!item.payoutApprovedAt}
                  label={
                    item.payoutApprovedAt
                      ? '점주 정산 승인'
                      : item.payoutStatus === 'REQUESTED'
                      ? '정산 승인 대기 (30분 후 자동)'
                      : '정산 미시작'
                  }
                  time={item.payoutApprovedAt}
                  sub={item.payoutAutoApproved ? '자동 승인' : (item.payoutApprovedAt ? '점주 직접 승인' : undefined)}
                />
                <TimelineDot
                  done={item.payoutStatus === 'COMPLETED'}
                  label={
                    item.payoutStatus === 'COMPLETED'
                      ? '입금 완료'
                      : item.payoutStatus === 'SCHEDULED'
                      ? '입금 처리 중'
                      : '입금 대기'
                  }
                  time={item.payoutCompletedAt}
                />
                <TimelineDot
                  done={!!item.workerRatedOwner}
                  label={item.workerRatedOwner ? '내가 매장 평가 완료' : '매장 평가 대기'}
                />
                <TimelineDot
                  done={!!item.ownerRatedWorker}
                  label={item.ownerRatedWorker ? '점주가 나를 평가함' : '점주 평가 대기'}
                />
              </View>

              {item.status !== 'CANCELED' ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.buttonSecondary,
                    { marginTop: 14, flexDirection: 'row', gap: 6, justifyContent: 'center' },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => openChat(item)}
                >
                  <Text style={{ fontSize: 14 }}>💬</Text>
                  <Text style={styles.buttonSecondaryText}>점주와 채팅</Text>
                  {item.chatUnreadCount && item.chatUnreadCount > 0 ? (
                    <View
                      style={{
                        marginLeft: 4,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: radius.pill,
                        backgroundColor: colors.danger,
                        minWidth: 18,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>
                        {item.chatUnreadCount > 99 ? '99+' : item.chatUnreadCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              ) : null}

              {item.status === 'MATCHED' ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.buttonPrimary,
                    { marginTop: 14, flexDirection: 'row', gap: 6 },
                    (busyId === item.id || pressed) && { opacity: 0.85 },
                  ]}
                  onPress={() => checkIn(item.id)}
                  disabled={busyId === item.id}
                >
                  <Icon name="log-in" size={16} color="#fff" />
                  <Text style={styles.buttonPrimaryText}>출근 체크인</Text>
                </Pressable>
              ) : null}

              {item.status === 'CHECKED_IN' ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.buttonPrimary,
                    { marginTop: 14, backgroundColor: colors.success, flexDirection: 'row', gap: 6 },
                    (busyId === item.id || pressed) && { opacity: 0.85 },
                  ]}
                  onPress={() => checkOut(item.id)}
                  disabled={busyId === item.id}
                >
                  <Icon name="log-out" size={16} color="#fff" />
                  <Text style={styles.buttonPrimaryText}>퇴근 체크아웃 (정산 시작)</Text>
                </Pressable>
              ) : null}

              {item.status === 'CHECKED_OUT' ? (
                item.workerRatedOwner ? (
                  <View
                    style={{
                      marginTop: 14,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: radius.md,
                      backgroundColor: colors.successSoft,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Icon name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={{ color: colors.success, fontWeight: '700', fontSize: 13 }}>
                      매장 평가 완료
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.buttonPrimary,
                      { marginTop: 14, backgroundColor: colors.warn, flexDirection: 'row', gap: 6 },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => openRating(item)}
                  >
                    <Icon name="star" size={16} color="#fff" />
                    <Text style={styles.buttonPrimaryText}>매장 평가하기</Text>
                  </Pressable>
                )
              ) : null}

              {/* 이의 제기 — 매칭 종료(CHECKED_OUT/NO_SHOW) 시 24h 이내 가능 */}
              {(item.status === 'CHECKED_OUT' || item.status === 'NO_SHOW') ? (
                <Pressable
                  onPress={() => setDisputeTarget({ matchId: item.id, cafeName: item.cafeName ?? '매장' })}
                  style={({ pressed }) => [
                    {
                      marginTop: 8, paddingVertical: 8,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ fontSize: 12 }}>⚠️</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>
                    이의 제기 (24h 내)
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
      <RatingModal
        visible={ratingTarget != null}
        matchId={ratingTarget?.matchId ?? null}
        targetName={ratingTarget?.cafeName ?? ''}
        cafeId={ratingTarget?.cafeId ?? null}
        mode="worker-rates-owner"
        onClose={() => setRatingTarget(null)}
        onSubmitted={() => load()}
      />
      <ChatSheet
        visible={chatTarget != null}
        matchId={chatTarget?.matchId ?? null}
        title={chatTarget ? `${chatTarget.cafeName} 채팅` : undefined}
        onClose={() => setChatTarget(null)}
      />
      <DisputeModal
        visible={disputeTarget != null}
        matchId={disputeTarget?.matchId ?? null}
        role="WORKER"
        cafeName={disputeTarget?.cafeName}
        onClose={() => setDisputeTarget(null)}
        onSubmitted={() => { setDisputeTarget(null); load(); }}
      />
    </>
  );
}
