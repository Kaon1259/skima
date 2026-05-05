import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { ChatSheet } from '@/components/ChatSheet';
import { DisputeModal } from '@/components/DisputeModal';
import { GradientButton } from '@/components/Gradient';
import { HealthCertBadge } from '@/components/HealthCertBadge';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import { Icon } from '@/components/Icon';
import { NoShowResult, NoShowResultModal } from '@/components/NoShowResultModal';
import { RatingModal, blurFocusedForModal } from '@/components/RatingModal';
import ShiftSkillBadges from '@/components/ShiftSkillBadges';
import SkillMatchSummary from '@/components/SkillMatchSummary';
import { WorkerTierBadge } from '@/components/WorkerTierBadge';
import { api } from '@/lib/api';
import { useFocusPolling } from '@/lib/useFocusPolling';
import {
  OwnerShift,
  ShiftApplication,
  WorkerStats,
  fmtDateTime,
  fmtPercent,
} from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

export default function ShiftApplicantsScreen() {
  const { id, action, firstTime } = useLocalSearchParams<{ id: string; action?: string; firstTime?: string }>();
  const shiftId = id;
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
  const [noShowResult, setNoShowResult] = useState<NoShowResult | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<{ matchId: number; workerName: string } | null>(null);
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

  // 알림에서 ?action=approve 로 진입 시 정산 승인 모달 자동 오픈 — 화면 라이프사이클당 1회만
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (action === 'approve' && shift?.matchId && shift.matchedWorkerName
        && shift.payoutStatus === 'REQUESTED') {
      autoOpenedRef.current = true;
      // 점주 ack 강제 게이트 — 안 됐으면 자동 모달 대신 계약서 화면으로 라우팅
      if (!shift.ownerContractAckAt) {
        notify('정산 전 근로계약서 확인이 필요합니다. 확인 화면으로 이동합니다.');
        router.replace(`/owner/contract/${shift.matchId}?focus=ack` as never);
        return;
      }
      blurFocusedForModal();
      setApproveTarget({ matchId: shift.matchId, workerName: shift.matchedWorkerName });
    }
  }, [action, shift]);

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
      setNoShowResult({
        workerName,
        backupMatched: r.backupMatched,
        shiftReopened: r.shiftReopened,
        backupWorkerName: r.backupWorkerName,
        backupMatchId: r.backupMatchId,
        favoritingWorkerCount: r.favoritingWorkerCount,
      });
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
          {firstTime === '1' ? (
            <View
              style={{
                marginBottom: spacing.md,
                padding: 14,
                borderRadius: radius.lg,
                backgroundColor: colors.successSoft,
                borderWidth: 1.5,
                borderColor: colors.success,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 22 }}>🎉</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: colors.success, flex: 1 }}>
                  첫 시프트 등록 완료!
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.text, lineHeight: 18 }}>
                • 1시간 매칭 SLA 시작 — 워커 지원이 들어오면 헤더 종(🔔)으로 알림이 옵니다{'\n'}
                • 지원자가 들어오면 이 화면 하단에서 매칭 확정 가능{'\n'}
                • 워커 출근 → 퇴근 → 30분 자동 입금 (정산 승인 시 5분 내)
              </Text>
            </View>
          ) : null}
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
              onReportDispute={(matchId, workerName) => {
                blurFocusedForModal();
                setDisputeTarget({ matchId, workerName });
              }}
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
                <Avatar name={item.workerName} imageUrl={item.workerProfileImage} size={44} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.title}>{item.workerName}</Text>
                    <TrustScoreBadge score={stats?.trustScore} />
                    <WorkerTierBadge tier={stats?.tier} />
                    <HealthCertBadge status={item.workerHealthCertStatus} size="xs" />
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
              <View style={{ marginTop: 14 }}>
                <GradientButton
                  onPress={() => accept(item.id)}
                  disabled={busyId === item.id}
                  label="매칭 확정"
                  icon={<Icon name="checkmark-circle" size={16} color="#fff" />}
                />
              </View>
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
    <NoShowResultModal
      visible={noShowResult != null}
      result={noShowResult}
      onClose={() => setNoShowResult(null)}
    />
    <DisputeModal
      visible={disputeTarget != null}
      matchId={disputeTarget?.matchId ?? null}
      role="OWNER"
      workerName={disputeTarget?.workerName}
      onClose={() => setDisputeTarget(null)}
      onSubmitted={() => { setDisputeTarget(null); load(); }}
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
  onReportDispute,
  busyNoShow,
}: {
  shift: OwnerShift;
  onOpenChat: (matchId: number, cafeName: string) => void;
  onApprovePayout: (matchId: number, workerName: string) => void;
  onRatePostAutoApproval: (matchId: number, workerName: string) => void;
  onReportNoShow: (matchId: number, workerName: string) => void;
  onReportDispute: (matchId: number, workerName: string) => void;
  busyNoShow: boolean;
}) {
  const v = statusVisual(shift.status);
  const checkedOut = shift.matchStatus === 'CHECKED_OUT' || shift.payoutStatus != null;
  const payoutApproved = shift.payoutApprovedAt != null;
  const payoutDone = shift.payoutStatus === 'COMPLETED';
  const ownerRatingDone = shift.ratingScore != null;
  const workerRatingDone = !!shift.workerRatedOwner;
  const ownerAcked = !!shift.ownerContractAckAt;
  const workerAcked = !!shift.workerContractAckAt;
  const matched = shift.matchedAt != null;
  const stages: { label: string; done: boolean; ts?: string | null; sub?: string }[] = [
    { label: '시프트 등록', done: true, ts: shift.createdAt },
    { label: '매칭 확정', done: matched, ts: shift.matchedAt },
    { label: matched
        ? (ownerAcked ? '점주 계약서 확인' : '점주 계약서 확인 대기')
        : '점주 계약서 확인',
      done: ownerAcked, ts: shift.ownerContractAckAt },
    { label: matched
        ? (workerAcked ? '워커 계약서 확인' : '워커 계약서 확인 대기')
        : '워커 계약서 확인',
      done: workerAcked, ts: shift.workerContractAckAt },
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

      {/* 매칭 워커 진입 (있을 때만) */}
      {shift.matchedWorkerName && shift.matchedWorkerId ? (
        <Pressable
          onPress={() => router.push(`/u/${shift.matchedWorkerId}` as never)}
          style={({ pressed }) => [
            {
              marginTop: 8,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: radius.md,
              backgroundColor: colors.primary50,
              borderWidth: 1,
              borderColor: colors.primary200,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Avatar name={shift.matchedWorkerName} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary700, letterSpacing: 0.3 }}>
              매칭 워커
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 1 }}>
              {shift.matchedWorkerName}
            </Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>상세 ›</Text>
        </Pressable>
      ) : null}

      {/* 점주 측 근로계약서 미확인 강조 — 매칭 직후 액션 유도 */}
      {shift.matchId && shift.matchedWorkerName && !shift.ownerContractAckAt ? (
        <Pressable
          onPress={() => router.push(`/owner/contract/${shift.matchId}` as never)}
          style={({ pressed }) => [
            {
              marginTop: 8,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              backgroundColor: colors.warnSoft,
              borderWidth: 1.5,
              borderColor: colors.warn,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 22 }}>📄</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.warn }}>
              근로계약서 확인 필요
            </Text>
            <Text style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>
              근기법 17조 — 양측 확인이 분쟁 방어 자료가 됩니다
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warn }}>확인 ›</Text>
        </Pressable>
      ) : null}

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

      {/* 정산 승인 + 평가 — CHECKED_OUT + Payout REQUESTED. ack 강제 게이트 */}
      {shift.matchId && shift.matchedWorkerName && shift.payoutStatus === 'REQUESTED' ? (
        <View style={{ marginTop: 14 }}>
          <GradientButton
            onPress={() => {
              if (!shift.ownerContractAckAt) {
                // ack 없으면 정산 모달 대신 계약서 화면으로 강제 라우팅
                const msg = '정산 전 근로계약서 확인이 필요합니다. 확인 화면으로 이동합니다.';
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert('확인 필요', msg);
                router.push(`/owner/contract/${shift.matchId}?focus=ack` as never);
                return;
              }
              onApprovePayout(shift.matchId!, shift.matchedWorkerName!);
            }}
            label={shift.ownerContractAckAt ? '정산 승인 + 평가' : '📄 계약서 확인 후 정산'}
            icon={<Text style={{ fontSize: 14 }}>💸</Text>}
          />
        </View>
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

      {/* 이의 제기 — 매칭 종료(CHECKED_OUT/NO_SHOW) 시 24h 이내 가능 */}
      {shift.matchId && shift.matchedWorkerName
        && (shift.matchStatus === 'CHECKED_OUT' || shift.matchStatus === 'NO_SHOW') ? (
        <Pressable
          onPress={() => onReportDispute(shift.matchId!, shift.matchedWorkerName!)}
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
}
