import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Icon } from '@/components/Icon';

import { api } from '@/lib/api';
import { Kpi, fmtPercent } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

function AnimatedPercent({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const v = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('—');

  useEffect(() => {
    Animated.timing(v, {
      toValue: value,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, v]);

  useEffect(() => {
    const id = v.addListener(({ value: x }) => setDisplay(fmtPercent(x)));
    return () => v.removeListener(id);
  }, [v]);

  return (
    <Text style={{ fontSize: 72, fontWeight: '900', color, letterSpacing: -2 }}>
      {display}
    </Text>
  );
}

export default function KpiScreen() {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<Kpi>('/api/admin/kpi?sinceDays=30');
      setKpi(data);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  async function runPayouts() {
    setBusy(true);
    try {
      const r = await api<{ processed: number }>('/api/admin/payouts/run', { method: 'POST' });
      notify(`정산 ${r.processed}건 처리`);
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const matchOK = kpi ? kpi.matchingSlaRate >= 0.8 : false;
  const payoutOK = kpi ? kpi.payoutSlaRate >= 0.95 : false;

  return (
    <ScrollView
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={styles.h2}>북극성 KPI</Text>
        <Text style={[styles.subtitle, { marginTop: 4 }]}>
          최근 30일 · 단 두 개의 숫자가 이 사업의 모든 것
        </Text>
      </View>

      {/* 운영 진입 — 보건증 검토 등 */}
      <Pressable
        onPress={() => router.push('/admin/health-certs' as never)}
        style={({ pressed }) => [
          {
            flexDirection: 'row', alignItems: 'center', gap: 12,
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1.5, borderColor: colors.warn,
            marginBottom: spacing.md,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={{ fontSize: 22 }}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.warn }}>
            보건증 검토
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            워커 업로드한 보건증 인증/거부
          </Text>
        </View>
        <Text style={{ fontSize: 16, color: colors.warn }}>›</Text>
      </Pressable>

      <KpiCard
        accent={colors.primary}
        accentSoft={colors.primarySoft}
        icon="flash"
        label="1시간 매칭률"
        targetText="목표 80% 이상"
        value={kpi?.matchingSlaRate ?? 0}
        sub={
          kpi
            ? `${kpi.matchedWithinSla} / ${kpi.totalMatchedShifts} 시프트`
            : '집계 중...'
        }
        ok={matchOK}
      />

      <KpiCard
        accent={colors.success}
        accentSoft={colors.successSoft}
        icon="cash"
        label="30분 입금률"
        targetText="목표 95% 이상"
        value={kpi?.payoutSlaRate ?? 0}
        sub={
          kpi
            ? `${kpi.payoutsWithinSla} / ${kpi.totalCompletedPayouts} 정산`
            : '집계 중...'
        }
        ok={payoutOK}
      />

      {/* PMF 시그널 — 확장 카드 */}
      <View
        style={[
          styles.card,
          { marginTop: 8, padding: spacing.lg, borderTopWidth: 4, borderTopColor: colors.warn },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: colors.warnSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16 }}>📈</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>PMF 시그널 (지난 30일)</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <PmfMetric
            label="평균 별점"
            value={kpi?.avgWorkerRating != null ? kpi.avgWorkerRating.toFixed(2) : '—'}
            sub={`평가 ${kpi?.totalRatings ?? 0}건`}
            color={colors.warn}
          />
          <PmfMetric
            label="재고용 의향"
            value={kpi?.rehireRate != null ? fmtPercent(kpi.rehireRate) : '—'}
            sub="높을수록 PMF ↑"
            color={colors.success}
          />
          <PmfMetric
            label="노쇼율"
            value={kpi?.noShowRate != null ? fmtPercent(kpi.noShowRate) : '0%'}
            sub={`총 ${kpi?.totalNoShows ?? 0}건`}
            color={kpi?.noShowRate && kpi.noShowRate > 0.03 ? colors.danger : colors.textMuted}
          />
        </View>
        <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 12, textAlign: 'center' }}>
          재고용률 = "또 부르고 싶다"라고 답한 점주 비율 — 진짜 PMF 지표
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.buttonSecondary,
          { marginTop: 8, flexDirection: 'row', gap: 6 },
          (busy || pressed) && { opacity: 0.7 },
        ]}
        onPress={runPayouts}
        disabled={busy}
      >
        <Icon name="play-circle" size={16} color={colors.text} />
        <Text style={styles.buttonSecondaryText}>
          {busy ? '실행 중...' : '대기 정산 강제 실행 (디버그)'}
        </Text>
      </Pressable>

      <View
        style={{
          marginTop: spacing.xl,
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.text,
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
          KICK
        </Text>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 6, lineHeight: 26 }}>
          1시간 매칭, 30분 입금
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 }}>
          못 지키면 사업 없음, 지키면 카테고리 주인.
        </Text>
      </View>
    </ScrollView>
  );
}

function PmfMetric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View
      style={{
        flexBasis: '30%',
        flexGrow: 1,
        padding: 12,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '900', color, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 4 }}>{label}</Text>
      <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 2 }}>{sub}</Text>
    </View>
  );
}

function KpiCard({
  accent,
  accentSoft,
  icon,
  label,
  targetText,
  value,
  sub,
  ok,
}: {
  accent: string;
  accentSoft: string;
  icon: string;
  label: string;
  targetText: string;
  value: number;
  sub: string;
  ok: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          padding: spacing.xl,
          borderTopWidth: 4,
          borderTopColor: accent,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={18} color={accent} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{label}</Text>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: ok ? colors.successSoft : colors.warnSoft,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color: ok ? colors.success : colors.warn }}>
            {ok ? '정상' : '미달'}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: 'center', marginVertical: 18 }}>
        <AnimatedPercent value={value} color={accent} />
      </View>

      <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
        {sub}
      </Text>
      <Text style={{ textAlign: 'center', color: colors.textLight, fontSize: 11, marginTop: 4 }}>
        {targetText}
      </Text>
    </View>
  );
}
