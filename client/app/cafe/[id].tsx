import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Icon } from '@/components/Icon';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import {
  CAFE_TYPE_LABEL,
  CafeDetail,
  Shift as ShiftItem,
  fmtDateTime,
  fmtKRW,
  fmtPercent,
} from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

export default function CafeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cafeId = id;
  const { auth } = useAuth();
  const [detail, setDetail] = useState<CafeDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyShiftId, setBusyShiftId] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [busyFav, setBusyFav] = useState(false);

  const isWorkerInit = auth?.role === 'WORKER';

  const load = useCallback(async () => {
    if (!cafeId) return;
    setRefreshing(true);
    try {
      const [data, favIds] = await Promise.all([
        api<CafeDetail>(`/api/cafes/${cafeId}/detail`),
        isWorkerInit
          ? api<number[]>('/api/worker/favorites/cafes').catch(() => [] as number[])
          : Promise.resolve([] as number[]),
      ]);
      setDetail(data);
      setIsFavorite(favIds.includes(Number(cafeId)));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [cafeId, isWorkerInit]);

  async function toggleFavorite() {
    if (!cafeId || busyFav) return;
    const was = isFavorite;
    setIsFavorite(!was);
    setBusyFav(true);
    try {
      await api(`/api/worker/favorites/cafes/${cafeId}`, {
        method: was ? 'DELETE' : 'POST',
      });
    } catch (e) {
      setIsFavorite(was);
      notify((e as Error).message);
    } finally {
      setBusyFav(false);
    }
  }

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  async function applyShift(shiftId: number) {
    setBusyShiftId(shiftId);
    try {
      await api(`/api/worker/shifts/${shiftId}/apply`, { method: 'POST' });
      notify('지원 완료! 점주 확인을 기다려주세요.');
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      notify(msg);
    } finally {
      setBusyShiftId(null);
    }
  }

  if (!detail) {
    return (
      <View style={[styles.screenPadded, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.bodyMuted}>매장 정보를 불러오는 중...</Text>
      </View>
    );
  }

  const isOwnerView = detail.ownerView != null;
  const isWorker = auth?.role === 'WORKER';

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={detail.openShifts}
      keyExtractor={(s) => String(s.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <CafeHeader detail={detail} />
          {isWorker ? (
            <Pressable
              onPress={toggleFavorite}
              disabled={busyFav}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: isFavorite ? colors.warn : colors.border,
                  backgroundColor: isFavorite ? colors.warnSoft : colors.surface,
                  marginBottom: spacing.md,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{isFavorite ? '⭐' : '☆'}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: isFavorite ? colors.warn : colors.text,
                }}
              >
                {isFavorite ? '단골 매장 — 새 시프트 알림 받는 중' : '단골 매장으로 등록'}
              </Text>
            </Pressable>
          ) : null}
          <SignalsCard detail={detail} />
          {isOwnerView ? <OwnerMonthCard detail={detail} /> : null}
          {isOwnerView && detail.ownerView!.regulars.length > 0 ? (
            <RegularsCard detail={detail} />
          ) : null}
          {detail.recentReviews.length > 0 ? <ReviewsCard detail={detail} /> : null}
          <Text style={[styles.h2, { fontSize: 18, marginTop: 24, marginBottom: 4 }]}>
            모집중 시프트
          </Text>
          <Text style={[styles.subtitle, { marginBottom: 12 }]}>
            {detail.openShifts.length === 0
              ? '현재 모집중인 시프트가 없어요'
              : `${detail.openShifts.length}건`}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🕐</Text>
          <Text style={styles.bodyMuted}>등록된 시프트가 없어요</Text>
        </View>
      }
      renderItem={({ item }) => (
        <OpenShiftCard
          shift={item}
          isWorker={isWorker}
          busy={busyShiftId === item.id}
          onApply={() => applyShift(item.id)}
          onOpen={() => {
            if (isOwnerView) router.push(`/owner/shift/${item.id}` as never);
          }}
        />
      )}
    />
  );
}

function CafeHeader({ detail }: { detail: CafeDetail }) {
  return (
    <View style={[styles.card, { marginBottom: spacing.md }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            backgroundColor: detail.brandColor ?? colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>
            {detail.brandLetter ?? '☕'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.h2, { fontSize: 20 }]}>{detail.name}</Text>
          <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 2 }]}>
            {CAFE_TYPE_LABEL[detail.cafeType]}
            {detail.brandName ? ` · ${detail.brandName}` : ''}
          </Text>
          <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 4 }]}>
            📍 {detail.address}
          </Text>
          <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 4 }]}>
            점주: {detail.ownerName}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SignalsCard({ detail }: { detail: CafeDetail }) {
  return (
    <View style={[styles.card, { marginBottom: spacing.md, flexDirection: 'row', gap: 8 }]}>
      <Signal
        label="평균 별점"
        value={detail.avgRating != null ? `★ ${detail.avgRating.toFixed(1)}` : '신규'}
        sub={detail.ratingsCount != null ? `${detail.ratingsCount}건` : '평가 없음'}
        color={colors.warn}
      />
      <Signal
        label="노쇼율"
        value={detail.noShowRate != null ? fmtPercent(detail.noShowRate) : '0%'}
        sub={detail.noShowRate && detail.noShowRate > 0 ? '주의' : '깨끗'}
        color={detail.noShowRate && detail.noShowRate > 0 ? colors.danger : colors.success}
      />
      <Signal
        label="완료 시프트"
        value={`${detail.totalCompletedShifts}회`}
        sub="누적"
        color={colors.info}
      />
    </View>
  );
}

function Signal({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '900', color, marginTop: 6, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 2 }}>{sub}</Text>
    </View>
  );
}

function OwnerMonthCard({ detail }: { detail: CafeDetail }) {
  const o = detail.ownerView!;
  return (
    <View style={[styles.card, { marginBottom: spacing.md }]}>
      <Text style={[styles.title, { marginBottom: 8 }]}>이번달 운영 현황</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>총 지출</Text>
      <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 2 }}>
        {fmtKRW(o.monthGross + o.monthFee)}
      </Text>
      <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>
        임금 {fmtKRW(o.monthGross)} · 수수료 {fmtKRW(o.monthFee)} · {o.monthCompletedMatches}건 완료
      </Text>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <CountPill label="모집중" value={o.openShifts} accent={colors.warn} />
        <CountPill label="진행" value={o.matchedShifts} accent={colors.info} />
        <CountPill label="완료" value={o.completedShifts} accent={colors.success} />
      </View>
    </View>
  );
}

function CountPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '900', color: accent, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

function RegularsCard({ detail }: { detail: CafeDetail }) {
  const o = detail.ownerView!;
  return (
    <View style={[styles.card, { marginBottom: spacing.md }]}>
      <Text style={[styles.title, { marginBottom: 8 }]}>단골 워커</Text>
      <Text style={[styles.subtitle, { marginBottom: 12 }]}>
        이 매장에서 2회 이상 일한 워커
      </Text>
      {o.regulars.map((r) => (
        <Pressable
          key={r.workerId}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              padding: 10,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceAlt,
              marginBottom: 6,
            },
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => router.push(`/u/${r.workerId}` as never)}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.successSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Text style={{ color: colors.success, fontWeight: '900' }}>
              {r.workerName.slice(-1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {r.workerName}
            </Text>
            <Text style={[styles.bodyMuted, { fontSize: 11 }]}>
              {r.matchCount}회 근무
              {r.avgRating != null ? ` · ★ ${r.avgRating.toFixed(1)}` : ''}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.textLight} />
        </Pressable>
      ))}
    </View>
  );
}

function ReviewsCard({ detail }: { detail: CafeDetail }) {
  return (
    <View style={[styles.card, { marginBottom: spacing.md }]}>
      <Text style={[styles.title, { marginBottom: 8 }]}>워커가 남긴 후기</Text>
      {detail.recentReviews.map((r) => (
        <View
          key={r.id}
          style={{
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, color: colors.warn, fontWeight: '900' }}>
              {'★'.repeat(r.score)}
              <Text style={{ color: colors.border }}>{'☆'.repeat(5 - r.score)}</Text>
            </Text>
            <Text style={[styles.bodyMuted, { fontSize: 11 }]}>{fmtDateTime(r.createdAt)}</Text>
          </View>
          {r.comment ? (
            <Text style={[styles.body, { marginTop: 6, fontSize: 13 }]}>"{r.comment}"</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function OpenShiftCard({
  shift,
  isWorker,
  busy,
  onApply,
  onOpen,
}: {
  shift: ShiftItem;
  isWorker: boolean;
  busy: boolean;
  onApply: () => void;
  onOpen: () => void;
}) {
  const dur = Math.round(((new Date(shift.endAt).getTime() - new Date(shift.startAt).getTime()) / (1000 * 60 * 60)) * 10) / 10;
  const totalEst = Math.round(shift.hourlyWage * dur);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && !isWorker && { opacity: 0.85 }]}
      onPress={isWorker ? undefined : onOpen}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>🕐 {fmtDateTime(shift.startAt)} 시작</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{dur}시간</Text>
        </View>
      </View>
      <View
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
        }}
      >
        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>예상 보수</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.primary, letterSpacing: -0.5 }}>
            {fmtKRW(totalEst)}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: 8 }}>
            시급 {fmtKRW(shift.hourlyWage)}
          </Text>
        </View>
        {shift.description ? (
          <Text style={[styles.bodyMuted, { marginTop: 6, fontSize: 12 }]}>{shift.description}</Text>
        ) : null}
      </View>
      {isWorker ? (
        <Pressable
          style={({ pressed }) => [
            styles.buttonPrimary,
            { marginTop: 14, flexDirection: 'row', gap: 6 },
            (busy || pressed) && { opacity: 0.85 },
          ]}
          onPress={onApply}
          disabled={busy}
        >
          <Icon name="flash" size={16} color="#fff" />
          <Text style={styles.buttonPrimaryText}>{busy ? '지원 중...' : '1탭 지원'}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}
