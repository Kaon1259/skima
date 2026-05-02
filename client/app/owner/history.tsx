import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { Cafe, OwnerShift, fmtDateTime, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, statusVisual, styles } from '@/lib/theme';

type Bucket = 'ALL' | 'COMPLETED' | 'NO_SHOW' | 'CANCELED';

const BUCKET_LABEL: Record<Bucket, string> = {
  ALL: '전체',
  COMPLETED: '완료',
  NO_SHOW: '노쇼',
  CANCELED: '취소',
};

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function shiftMonth(s: string, delta: number): string {
  const [y, m] = s.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function inMonth(iso: string | null | undefined, month: string): boolean {
  if (!iso) return false;
  return iso.startsWith(month);
}

export default function ShiftHistoryScreen() {
  const [shifts, setShifts] = useState<OwnerShift[]>([]);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bucket, setBucket] = useState<Bucket>('ALL');
  const [cafeId, setCafeId] = useState<number | null>(null);
  const [month, setMonth] = useState<string>(thisMonth());
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [shiftData, cafeData] = await Promise.all([
        api<OwnerShift[]>('/api/owner/shifts'),
        api<Cafe[]>('/api/owner/cafes'),
      ]);
      setShifts(shiftData);
      setCafes(cafeData);
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

  // 히스토리 = COMPLETED + NO_SHOW + CANCELED 만 (활성 시프트 제외)
  const archive = useMemo(() => {
    return shifts.filter((s) =>
      s.status === 'COMPLETED' || s.status === 'CANCELED' || s.matchStatus === 'NO_SHOW',
    );
  }, [shifts]);

  const filtered = useMemo(() => {
    return archive.filter((s) => {
      // bucket
      if (bucket === 'COMPLETED' && s.status !== 'COMPLETED') return false;
      if (bucket === 'NO_SHOW' && s.matchStatus !== 'NO_SHOW') return false;
      if (bucket === 'CANCELED' && s.status !== 'CANCELED') return false;
      // cafe
      if (cafeId != null && s.cafeId !== cafeId) return false;
      // month — 종료 시각 기준
      const ts = s.endAt ?? s.startAt;
      if (!inMonth(ts, month)) return false;
      // query
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        s.cafeName.toLowerCase().includes(q) ||
        (s.matchedWorkerName ?? '').toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
      );
    }).sort((a, b) => (b.endAt ?? '').localeCompare(a.endAt ?? ''));
  }, [archive, bucket, cafeId, month, query]);

  // 헤더 통계
  const monthStats = useMemo(() => {
    const m = archive.filter((s) => inMonth(s.endAt ?? s.startAt, month) && (cafeId == null || s.cafeId === cafeId));
    const completed = m.filter((s) => s.status === 'COMPLETED').length;
    const noShow = m.filter((s) => s.matchStatus === 'NO_SHOW').length;
    const canceled = m.filter((s) => s.status === 'CANCELED').length;
    const ratings = m.filter((s) => s.ratingScore != null).map((s) => s.ratingScore!);
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length)
      : null;
    return { completed, noShow, canceled, avgRating, total: m.length };
  }, [archive, month, cafeId]);

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={filtered}
      keyExtractor={(s) => String(s.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.h2}>📚 시프트 히스토리</Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              완료 / 노쇼 / 취소된 시프트 archive — 매장·월별 필터
            </Text>
          </View>

          {/* 월 셀렉터 */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 22, color: colors.primary, fontWeight: '900' }}>‹</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text }}>{month}</Text>
            <Pressable onPress={() => setMonth(shiftMonth(month, 1))} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 22, color: colors.primary, fontWeight: '900' }}>›</Text>
            </Pressable>
          </View>

          {/* 월별 통계 */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Stat label="완료" value={monthStats.completed} color={colors.success} />
            <Stat label="노쇼" value={monthStats.noShow} color={monthStats.noShow > 0 ? colors.danger : colors.textMuted} />
            <Stat label="취소" value={monthStats.canceled} color={colors.textMuted} />
            <Stat
              label="평균 ★"
              value={monthStats.avgRating != null ? monthStats.avgRating.toFixed(1) : '—'}
              color={colors.warn}
            />
          </View>

          {/* 매장 필터 */}
          {cafes.length > 0 ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 6, fontSize: 12 }]}>매장</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Chip label="전체" active={cafeId == null} onPress={() => setCafeId(null)} />
                {cafes.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    active={cafeId === c.id}
                    onPress={() => setCafeId(c.id)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* 종류 필터 */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['ALL', 'COMPLETED', 'NO_SHOW', 'CANCELED'] as Bucket[]).map((b) => (
              <Chip key={b} label={BUCKET_LABEL[b]} active={bucket === b} onPress={() => setBucket(b)} />
            ))}
          </View>

          <View style={{ position: 'relative', marginBottom: 12 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="매장명·워커·설명 검색"
              placeholderTextColor={colors.textLight}
              style={[styles.input, { marginBottom: 0, paddingLeft: 38 }]}
            />
            <Text style={{ position: 'absolute', left: 14, top: 14, fontSize: 16 }}>🔍</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📭</Text>
          <Text style={styles.bodyMuted}>{month}월 히스토리가 없어요</Text>
        </View>
      }
      renderItem={({ item }) => <HistoryCard shift={item} />}
    />
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color, marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.surface,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.text }}>{label}</Text>
    </Pressable>
  );
}

function HistoryCard({ shift }: { shift: OwnerShift }) {
  const isNoShow = shift.matchStatus === 'NO_SHOW';
  const isCanceled = shift.status === 'CANCELED';
  const v = isNoShow
    ? { bg: colors.dangerSoft, fg: colors.danger, label: '노쇼' }
    : isCanceled
    ? { bg: colors.surfaceMuted, fg: colors.textMuted, label: '취소' }
    : statusVisual(shift.status);

  return (
    <Pressable
      onPress={() => router.push(`/owner/shift/${shift.id}` as never)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{shift.cafeName}</Text>
          <Text style={[styles.bodyMuted, { marginTop: 2, fontSize: 12 }]}>
            {fmtDateTime(shift.startAt)} ~ {fmtDateTime(shift.endAt)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: v.bg }]}>
          <Text style={[styles.badgeText, { color: v.fg }]}>{v.label}</Text>
        </View>
      </View>

      {shift.matchedWorkerName ? (
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: radius.md,
            backgroundColor: isNoShow ? colors.dangerSoft : colors.surfaceAlt,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isNoShow ? colors.danger : colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>
              {shift.matchedWorkerName.slice(-1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
              {shift.matchedWorkerName}
            </Text>
            {shift.ratingScore != null ? (
              <Text style={{ fontSize: 11, color: colors.warn, fontWeight: '700', marginTop: 2 }}>
                {'★'.repeat(shift.ratingScore)}{'☆'.repeat(5 - shift.ratingScore)}
                {shift.willRehire ? ' · 재고용 의향' : ''}
              </Text>
            ) : null}
          </View>
          <Text style={{ fontSize: 11, color: colors.textLight }}>시급 {fmtKRW(shift.hourlyWage)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
