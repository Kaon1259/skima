import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ChatSheet } from '@/components/ChatSheet';
import { Icon } from '@/components/Icon';
import { RatingModal, blurFocusedForModal } from '@/components/RatingModal';
import ShiftSkillBadges from '@/components/ShiftSkillBadges';
import SkillMatchSummary from '@/components/SkillMatchSummary';
import { api } from '@/lib/api';
import { useFocusPolling } from '@/lib/useFocusPolling';
import { useToast } from '@/lib/toast';
import {
  OwnerShift,
  ShiftApplication,
  WorkerStats,
  fmtDateTime,
  fmtPercent,
} from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

export default function ShiftApplicantsScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const shiftId = id;
  const toast = useToast();
  const [shift, setShift] = useState<OwnerShift | null>(null);
  const [apps, setApps] = useState<ShiftApplication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statsByWorker, setStatsByWorker] = useState<Record<number, WorkerStats>>({});
  const [repeatByWorker, setRepeatByWorker] = useState<Record<number, number>>({});
  const [chatTarget, setChatTarget] = useState<{ matchId: number; cafeName: string } | null>(null);
  const [approveTarget, setApproveTarget] = useState<{ matchId: number; workerName: string } | null>(null);
  const [postRateTarget, setPostRateTarget] = useState<{ matchId: number; workerName: string } | null>(null);
  const [busyNoShow, setBusyNoShow] = useState(false);
  const openChat = (matchId: number, cafeName: string) => {
    blurFocusedForModal();
    setChatTarget({ matchId, cafeName });
  };

  const load = useCallback(async () => {
    if (!shiftId) return;
    setRefreshing(true);
    try {
      const [appsData, allShifts] = await Promise.all([
        api<ShiftApplication[]>(`/api/owner/shifts/${shiftId}/applications`),
        api<OwnerShift[]>(`/api/owner/shifts`),
      ]);
      setApps(appsData);
      const me = allShifts.find((s) => String(s.id) === shiftId);
      if (me) setShift(me);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [shiftId]);

  useFocusPolling(load, 10000);

  // 알림에서 ?action=approve 로 진입 시 정산 승인 모달 자동 오픈
  useEffect(() => {
    if (action === 'approve' && shift?.matchId && shift.matchedWorkerName
        && shift.payoutStatus === 'REQUESTED' && !approveTarget) {
      blurFocusedForModal();
      setApproveTarget({ matchId: shift.matchId, workerName: shift.matchedWorkerName });
    }
  }, [action, shift, approveTarget]);

  // 지원자별 워커 stats + repeat count 비동기 로딩
  useEffect(() => {
    if (!shift) return;
    apps.forEach((a) => {
      const wid = a.workerId;
      if (!statsByWorker[wid]) {
        api<WorkerStats>(`/api/owner/workers/${wid}/stats`).then((s) =>
          setStatsByWorker((prev) => ({ ...prev, [wid]: s })),
        ).catch(() => {});
      }
      if (repeatByWorker[wid] == null) {
        api<{ count: number }>(`/api/owner/cafes/${shift.cafeId}/workers/${wid}/repeat-count`).then((r) =>
          setRepeatByWorker((prev) => ({ ...prev, [wid]: r.count })),
        ).catch(() => {});
      }
    });
  }, [apps, shift, statsByWorker, repeatByWorker]);

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  async function accept(applicationId: number) {
    setBusyId(applicationId);
    try {
      await api(`/api/owner/applications/${applicationId}/accept`, { method: 'POST' });
      notify('매칭 확정! (1시간 SLA 측정 종료)');
      router.replace('/owner/shifts');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function reportNoShow(matchId: number, workerName: string) {
    const ok = Platform.OS === 'web'
      ? window.confirm(`${workerName} 워커를 노쇼 처리하시겠습니까?\n\n• ★1 평가 자동 등록\n• 백업 워커 자동 매칭 시도\n• 워커에게 알림 발송`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            '노쇼 등록',
            `${workerName} 워커를 노쇼 처리하시겠습니까?\n\n★1 평가 자동 등록 + 백업 매칭 시도`,
            [
              { text: '취소', onPress: () => resolve(false), style: 'cancel' },
              { text: '노쇼 등록', onPress: () => resolve(true), style: 'destructive' },
            ],
          );
        });
    if (!ok) return;
    setBusyNoShow(true);
    try {
      const r = await api<{
        backupMatched: boolean;
        shiftReopened: boolean;
        backupWorkerName: string | null;
        backupMatchId: number | null;
        favoritingWorkerCount: number;
      }>(
        `/api/owner/matches/${matchId}/no-show`,
        { method: 'POST' },
      );
      if (r.backupMatched) {
        toast.push({
          title: `✅ 백업 워커 자동 매칭 — ${r.backupWorkerName ?? '워커'}`,
          subtitle: '대기 지원자 중 가장 먼저 지원한 워커가 시프트를 이어받습니다',
          severity: 'success',
          ttl: 6500,
        });
      } else if (r.shiftReopened) {
        const sub = r.favoritingWorkerCount > 0
          ? `백업 후보가 없어 시프트가 OPEN 으로 재모집됐어요. 단골 ${r.favoritingWorkerCount}명이 알림을 받습니다`
          : '백업 후보가 없어 시프트가 OPEN 으로 재모집됐어요. 새 지원자가 들어올 때까지 대기';
        toast.push({
          title: '🔄 시프트 재모집 시작',
          subtitle: sub,
          severity: 'warn',
          ttl: 7000,
        });
      } else {
        toast.push({
          title: '노쇼 등록 완료',
          subtitle: '★1 평가 자동 등록 + 워커 알림 발송',
          severity: 'info',
          ttl: 5000,
        });
      }
      load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyNoShow(false);
    }
  }

  return (
    <>
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={apps}
      keyExtractor={(a) => String(a.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.h2}>시프트 #{shiftId}</Text>
          {shift ? (
            <ShiftTimeline
              shift={shift}
              onOpenChat={openChat}
              onApprovePayout={(matchId, workerName) => {
                blurFocusedForModal();
                setApproveTarget({ matchId, workerName });
              }}
              onRatePostAutoApproval={(matchId, workerName) => {
                blurFocusedForModal();
                setPostRateTarget({ matchId, workerName });
              }}
              onReportNoShow={reportNoShow}
              busyNoShow={busyNoShow}
            />
          ) : null}
          <Text style={[styles.h2, { fontSize: 18, marginTop: 24, marginBottom: 4 }]}>지원자 목록</Text>
          <Text style={[styles.subtitle, { marginBottom: 12 }]}>
            한 명을 ACCEPT 하면 나머지는 자동 거절됩니다
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>👀</Text>
          <Text style={styles.bodyMuted}>아직 지원자가 없어요</Text>
        </View>
      }
      renderItem={({ item }) => {
        const v = statusVisual(item.status);
        const stats = statsByWorker[item.workerId];
        const repeat = repeatByWorker[item.workerId] ?? 0;
        return (
          <View
            style={[
              styles.card,
              repeat > 0 && { borderWidth: 2, borderColor: colors.success },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => router.push(`/u/${item.workerId}` as never)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>
                    {item.workerName.slice(-1)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.title}>{item.workerName}</Text>
                    <Icon name="chevron-forward" size={14} color={colors.textLight} />
                    {repeat > 0 ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radius.pill,
                          backgroundColor: colors.successSoft,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.success }}>
                          재방문 {repeat}회
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.bodyMuted}>{fmtDateTime(item.appliedAt)} 지원</Text>
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: v.bg }]}>
                <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
              </View>
            </Pressable>

            {/* 능력 매칭 요약 — 시프트 요구 vs 워커 자기신고 */}
            <SkillMatchSummary
              shiftJobRole={shift?.jobRole}
              shiftMinSkill={shift?.minSkill}
              shiftRequirements={shift?.requirements}
              workerLevel={item.workerLevel}
              workerRoles={item.workerRoles}
              workerCertifications={item.workerCertifications}
            />

            {/* 워커 통계 미리보기 */}
            {stats ? (
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 12,
                  padding: 10,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceAlt,
                  gap: 12,
                }}
              >
                <Stat
                  label="별점"
                  value={stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
                  color={colors.warn}
                />
                <Stat
                  label="재고용"
                  value={stats.rehireRate != null ? fmtPercent(stats.rehireRate) : '—'}
                  color={colors.success}
                />
                <Stat label="총 근무" value={`${stats.completedMatches}회`} color={colors.info} />
                <Stat
                  label="노쇼"
                  value={stats.noShowRate != null ? fmtPercent(stats.noShowRate) : '0%'}
                  color={stats.noShowRate && stats.noShowRate > 0 ? colors.danger : colors.textMuted}
                />
              </View>
            ) : null}

            {item.status === 'PENDING' ? (
              <Pressable
                style={({ pressed }) => [
                  styles.buttonPrimary,
                  { marginTop: 14, flexDirection: 'row', gap: 6 },
                  (busyId === item.id || pressed) && { opacity: 0.85 },
                ]}
                onPress={() => accept(item.id)}
                disabled={busyId === item.id}
              >
                <Icon name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.buttonPrimaryText}>매칭 확정</Text>
              </Pressable>
            ) : null}
          </View>
        );
      }}
    />
    <ChatSheet
      visible={chatTarget != null}
      matchId={chatTarget?.matchId ?? null}
      title={chatTarget ? `${chatTarget.cafeName} 채팅` : undefined}
      onClose={() => setChatTarget(null)}
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
    <RatingModal
      visible={postRateTarget != null}
      matchId={postRateTarget?.matchId ?? null}
      targetName={postRateTarget?.workerName ?? ''}
      mode="owner-rates-worker"
      onClose={() => setPostRateTarget(null)}
      onSubmitted={() => {
        setPostRateTarget(null);
        load();
      }}
    />
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ShiftTimeline({
  shift,
  onOpenChat,
  onApprovePayout,
  onRatePostAutoApproval,
  onReportNoShow,
  busyNoShow,
}: {
  shift: OwnerShift;
  onOpenChat: (matchId: number, cafeName: string) => void;
  onApprovePayout: (matchId: number, workerName: string) => void;
  onRatePostAutoApproval: (matchId: number, workerName: string) => void;
  onReportNoShow: (matchId: number, workerName: string) => void;
  busyNoShow: boolean;
}) {
  const v = statusVisual(shift.status);
  const checkedOut = shift.matchStatus === 'CHECKED_OUT' || shift.payoutStatus != null;
  const payoutApproved = shift.payoutApprovedAt != null;
  const payoutDone = shift.payoutStatus === 'COMPLETED';
  const ownerRatingDone = shift.ratingScore != null;
  const workerRatingDone = !!shift.workerRatedOwner;
  const stages: { label: string; done: boolean; ts?: string | null; sub?: string }[] = [
    { label: '시프트 등록', done: true, ts: shift.createdAt },
    { label: '매칭 확정', done: shift.matchedAt != null, ts: shift.matchedAt },
    { label: '출근 (체크인)', done: shift.matchStatus === 'CHECKED_IN' || checkedOut },
    { label: '퇴근 (체크아웃)', done: checkedOut },
    {
      label: payoutApproved
        ? '정산 승인'
        : (shift.payoutStatus === 'REQUESTED' ? '정산 승인 대기 (30분 후 자동)' : '정산 미시작'),
      done: payoutApproved,
      ts: shift.payoutApprovedAt,
      sub: payoutApproved
        ? (shift.payoutAutoApproved ? '자동 승인 (30분 무응답)' : '점주 직접 승인')
        : undefined,
    },
    {
      label: payoutDone ? '입금 완료' : (shift.payoutStatus === 'SCHEDULED' ? '입금 처리 중' : '입금 대기'),
      done: payoutDone,
      ts: shift.payoutCompletedAt,
    },
    {
      label: ownerRatingDone ? '워커 평가 완료 (내가 한 평가)' : '워커 평가 대기 (내가 할 평가)',
      done: ownerRatingDone,
      sub: ownerRatingDone ? `★${shift.ratingScore}` : undefined,
    },
    {
      label: workerRatingDone ? '매장 평가 받음 (워커가 한 평가)' : '매장 평가 대기 (워커가 할 평가)',
      done: workerRatingDone,
    },
  ];

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={styles.title}>{shift.cafeName}</Text>
        <View style={[styles.badge, { backgroundColor: v.bg }]}>
          <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
        </View>
      </View>
      <Text style={[styles.bodyMuted, { marginBottom: 4 }]}>
        {fmtDateTime(shift.startAt)} ~ {fmtDateTime(shift.endAt)}
      </Text>
      <ShiftSkillBadges
        jobRole={shift.jobRole}
        minSkill={shift.minSkill}
        requirements={shift.requirements}
        compact
      />

      <View style={{ paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
        {stages.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: s.done ? colors.success : colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              {s.done ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: s.done ? colors.text : colors.textLight }}>
                {s.label}
              </Text>
              {s.sub ? (
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{s.sub}</Text>
              ) : null}
            </View>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{s.ts ? fmtDateTime(s.ts) : ''}</Text>
          </View>
        ))}
      </View>

      {/* 정산 승인 + 평가 — CHECKED_OUT + Payout REQUESTED */}
      {shift.matchId && shift.matchedWorkerName && shift.payoutStatus === 'REQUESTED' ? (
        <Pressable
          style={[
            styles.buttonPrimary,
            { marginTop: 14, flexDirection: 'row', gap: 6, backgroundColor: colors.success },
          ]}
          onPress={() => onApprovePayout(shift.matchId!, shift.matchedWorkerName!)}
        >
          <Text style={{ fontSize: 14, color: '#fff' }}>💸</Text>
          <Text style={styles.buttonPrimaryText}>정산 승인 + 평가</Text>
        </Pressable>
      ) : null}

      {/* 자동 승인된 케이스 — 평가만 별도로 남길 수 있음 */}
      {shift.matchId && shift.matchedWorkerName
        && shift.payoutAutoApproved
        && shift.ratingScore == null ? (
        <Pressable
          style={[styles.buttonSecondary, { marginTop: 8, flexDirection: 'row', gap: 6 }]}
          onPress={() => onRatePostAutoApproval(shift.matchId!, shift.matchedWorkerName!)}
        >
          <Text style={{ fontSize: 14 }}>⭐</Text>
          <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>워커 평가만 등록</Text>
        </Pressable>
      ) : null}

      {/* 노쇼 등록 — match.MATCHED (체크인 전) 만 */}
      {shift.matchId && shift.matchedWorkerName && shift.matchStatus === 'MATCHED' ? (
        <Pressable
          style={[
            styles.buttonSecondary,
            { marginTop: 8, flexDirection: 'row', gap: 6,
              borderColor: colors.danger, borderWidth: 1.5, opacity: busyNoShow ? 0.6 : 1 },
          ]}
          onPress={() => onReportNoShow(shift.matchId!, shift.matchedWorkerName!)}
          disabled={busyNoShow}
        >
          <Text style={{ fontSize: 13 }}>🚨</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>
            {busyNoShow ? '처리 중...' : '노쇼 등록 (★1 자동 평가)'}
          </Text>
        </Pressable>
      ) : null}

      {/* 컴플라이언스 + 채팅 빠른 액션 — 매칭 있는 시프트만 */}
      {shift.matchId ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          <Pressable
            style={[styles.buttonSecondary, { flex: 1, minWidth: 110, paddingVertical: 8, flexDirection: 'row', gap: 4 }]}
            onPress={() => onOpenChat(shift.matchId!, shift.cafeName)}
          >
            <Text style={{ fontSize: 13 }}>💬</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>워커 채팅</Text>
            {shift.chatUnreadCount && shift.chatUnreadCount > 0 ? (
              <View
                style={{
                  marginLeft: 2,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: radius.pill,
                  backgroundColor: colors.danger,
                  minWidth: 18,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>
                  {shift.chatUnreadCount > 99 ? '99+' : shift.chatUnreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={[styles.buttonSecondary, { flex: 1, minWidth: 110, paddingVertical: 8, flexDirection: 'row', gap: 4 }]}
            onPress={() => router.push(`/owner/contract/${shift.matchId}` as never)}
          >
            <Text style={{ fontSize: 13 }}>📄</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>근로계약서</Text>
          </Pressable>
          <Pressable
            style={[styles.buttonSecondary, { flex: 1, minWidth: 110, paddingVertical: 8, flexDirection: 'row', gap: 4 }]}
            onPress={() => router.push(`/owner/withholding/${shift.matchId}` as never)}
          >
            <Text style={{ fontSize: 13 }}>🧾</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>원천징수영수증</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
