import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { Payout, fmtDateTime, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

export default function WorkerPayoutsScreen() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<Payout[]>('/api/worker/payouts');
      setPayouts(data);
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

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      data={payouts}
      keyExtractor={(p) => String(p.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={styles.h2}>내 정산</Text>
          <Text style={[styles.subtitle, { marginTop: 4 }]}>
            퇴근 → 점주 승인(또는 30분 자동승인) → 30분 내 입금
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>💰</Text>
          <Text style={styles.bodyMuted}>아직 정산 내역이 없어요</Text>
        </View>
      }
      renderItem={({ item }) => {
        const elapsed = item.elapsedMinutes;
        const isWithin = elapsed != null && elapsed <= 30;
        const v = statusVisual(item.status);
        return (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Pressable
                style={({ pressed }) => [{ flex: 1 }, pressed && item.cafeId && { opacity: 0.7 }]}
                onPress={() => item.cafeId && router.push(`/cafe/${item.cafeId}` as never)}
                disabled={!item.cafeId}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.title}>{item.cafeName ?? `정산 #${item.id}`}</Text>
                  {item.cafeId ? <Icon name="chevron-forward" size={14} color={colors.textLight} /> : null}
                </View>
                {item.workDate ? (
                  <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 2 }]}>
                    {fmtDateTime(item.workDate)} 근무
                  </Text>
                ) : null}
              </Pressable>
              <View style={[styles.badge, { backgroundColor: v.bg }]}>
                <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
              </View>
            </View>

            <Text style={[styles.bigNumber, { color: colors.success, marginTop: 8, fontSize: 40 }]}>
              {fmtKRW(item.netAmount)}
            </Text>

            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
                gap: 4,
              }}
            >
              <Row label="임금" value={fmtKRW(item.grossAmount)} />
              <Row label="원천징수" value={`-${fmtKRW(item.withholdingTax)}`} />
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
              <Row label="실수령" value={fmtKRW(item.netAmount)} bold />
              <Row label="(점주 수수료)" value={fmtKRW(item.platformFee)} muted />
            </View>

            <View style={{ marginTop: 12, gap: 4 }}>
              <Row label="체크아웃" value={fmtDateTime(item.triggerAt)} muted />
              {item.approvedAt ? (
                <Row
                  label={item.autoApproved ? '자동 승인' : '점주 승인'}
                  value={fmtDateTime(item.approvedAt)}
                  muted
                />
              ) : item.status === 'REQUESTED' ? (
                <Row label="점주 승인" value="대기 중 (30분 후 자동)" muted />
              ) : null}
              {item.completedAt ? (
                <Row label="입금 완료" value={fmtDateTime(item.completedAt)} muted />
              ) : item.status === 'SCHEDULED' ? (
                <Row label="입금 처리" value="대기 중..." muted />
              ) : null}
            </View>

            {item.completedAt ? (
              <View
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: radius.md,
                  backgroundColor: isWithin ? colors.successSoft : colors.dangerSoft,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isWithin ? colors.success : colors.danger,
                  }}
                >
                  {isWithin ? '✓' : '✗'} 30분 입금 SLA — 경과 {elapsed}분
                </Text>
              </View>
            ) : null}

            {/* 영수증/계약서 진입 */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              <Pressable
                style={[styles.buttonSecondary, { flex: 1, paddingVertical: 8, flexDirection: 'row', gap: 4 }]}
                onPress={() => router.push(`/contract/${item.matchId}` as never)}
              >
                <Text style={{ fontSize: 13 }}>📄</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>근로계약서</Text>
              </Pressable>
              <Pressable
                style={[styles.buttonSecondary, { flex: 1, paddingVertical: 8, flexDirection: 'row', gap: 4 }]}
                onPress={() => router.push(`/withholding/${item.matchId}` as never)}
              >
                <Text style={{ fontSize: 13 }}>🧾</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>원천징수영수증</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: muted ? colors.textLight : colors.textMuted }}>{label}</Text>
      <Text
        style={{
          fontSize: bold ? 16 : 13,
          fontWeight: bold ? '800' : '600',
          color: muted ? colors.textLight : colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
