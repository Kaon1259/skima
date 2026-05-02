import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { MonthlyStatement, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(s: string, delta: number): string {
  const [y, m] = s.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthlyStatementScreen() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<MonthlyStatement | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await api<MonthlyStatement>(`/api/owner/statements?month=${month}`);
      setData(r);
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, [month]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={data?.rows ?? []}
      keyExtractor={(r) => String(r.matchId)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.h2}>월간 지급명세서</Text>
          <Text style={[styles.subtitle, { marginTop: 4 }]}>
            점주별 일용근로 월간 지급 집계 — 신고용
          </Text>

          {/* 월 셀렉터 */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))}>
              <Text style={{ fontSize: 18, color: colors.primary, fontWeight: '900', paddingHorizontal: 12 }}>‹</Text>
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>{month}</Text>
            <Pressable onPress={() => setMonth(shiftMonth(month, 1))}>
              <Text style={{ fontSize: 18, color: colors.primary, fontWeight: '900', paddingHorizontal: 12 }}>›</Text>
            </Pressable>
          </View>

          {/* 요약 */}
          <View
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Row label="총 매칭 건수" value={`${data?.totalMatches ?? 0}건`} />
            <Row label="총 지급 임금" value={fmtKRW(data?.totalGross ?? 0)} />
            <Row label="총 원천징수" value={`-${fmtKRW(data?.totalWithholding ?? 0)}`} />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
            <Row label="실지급 합계" value={fmtKRW(data?.totalNet ?? 0)} bold />
            <Row label="플랫폼 수수료" value={fmtKRW(data?.totalPlatformFee ?? 0)} muted />
          </View>

          <Pressable
            onPress={() => Platform.OS === 'web' && window.print()}
            style={[styles.buttonSecondary, { marginTop: 12, flexDirection: 'row', gap: 6 }]}
          >
            <Text>🖨️</Text>
            <Text style={styles.buttonSecondaryText}>인쇄/PDF 저장</Text>
          </Pressable>

          <Text style={[styles.h2, { fontSize: 18, marginTop: 24, marginBottom: 4 }]}>매칭별 명세</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📅</Text>
          <Text style={styles.bodyMuted}>이 달 완료된 정산이 없어요</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable
              style={({ pressed }) => [{ flex: 1 }, pressed && item.workerId && { opacity: 0.7 }]}
              onPress={() => item.workerId && router.push(`/u/${item.workerId}` as never)}
              disabled={!item.workerId}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.title}>{item.workerName}</Text>
                {item.workerId ? <Icon name="chevron-forward" size={14} color={colors.textLight} /> : null}
              </View>
              <Text style={styles.bodyMuted}>{item.cafeName} · {item.workDate}</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.success }}>
              {fmtKRW(item.net)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
            <Text style={[styles.bodyMuted, { fontSize: 11 }]}>
              임금 {fmtKRW(item.gross)}
            </Text>
            <Text style={[styles.bodyMuted, { fontSize: 11 }]}>
              · 원천 -{fmtKRW(item.withholding)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {item.cafeId ? (
              <Pressable
                style={[styles.buttonSecondary, { flex: 1, paddingVertical: 6, flexDirection: 'row', gap: 4 }]}
                onPress={() => router.push(`/cafe/${item.cafeId}` as never)}
              >
                <Text style={{ fontSize: 12 }}>🏪</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>매장</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.buttonSecondary, { flex: 1, paddingVertical: 6, flexDirection: 'row', gap: 4 }]}
              onPress={() => router.push(`/contract/${item.matchId}` as never)}
            >
              <Text style={{ fontSize: 12 }}>📄</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>계약서</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonSecondary, { flex: 1, paddingVertical: 6, flexDirection: 'row', gap: 4 }]}
              onPress={() => router.push(`/withholding/${item.matchId}` as never)}
            >
              <Text style={{ fontSize: 12 }}>🧾</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>영수증</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 3 }}>
      <Text style={{ fontSize: 13, color: muted ? colors.textLight : colors.textMuted }}>{label}</Text>
      <Text
        style={{
          fontSize: bold ? 17 : 13,
          fontWeight: bold ? '900' : '700',
          color: muted ? colors.textLight : bold ? colors.text : colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
