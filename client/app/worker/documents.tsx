import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { ShiftMatch, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

type Doc = {
  matchId: number;
  cafeName: string;
  cafeId: number | null;
  workDate: string; // ISO
  hourlyWage: number;
  status: ShiftMatch['status'];
};

export default function WorkerDocumentsScreen() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const matches = await api<ShiftMatch[]>('/api/worker/matches');
      const ds: Doc[] = matches
        .filter((m) => m.status !== 'CANCELED')
        .map((m) => ({
          matchId: m.id,
          cafeName: m.cafeName ?? '매장',
          cafeId: m.cafeId ?? null,
          workDate: m.shiftStartAt ?? m.matchedAt,
          hourlyWage: m.hourlyWage ?? 0,
          status: m.status,
        }))
        .sort((a, b) => (b.workDate ?? '').localeCompare(a.workDate ?? ''));
      setDocs(ds);
    } catch (e) {
      const msg = (e as Error).message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // 월별 그룹화 (2026-04 / 2026-03 ...)
  const grouped = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    const filtered = docs.filter((d) =>
      !trimmed || d.cafeName.toLowerCase().includes(trimmed) || (d.workDate ?? '').includes(trimmed),
    );
    const map = new Map<string, Doc[]>();
    for (const d of filtered) {
      const ym = (d.workDate ?? '').slice(0, 7) || '미분류';
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [docs, q]);

  // FlatList data — flat list of items with optional headers
  type Row =
    | { type: 'header'; ym: string; count: number; total: number }
    | { type: 'item'; doc: Doc };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const [ym, items] of grouped) {
      const total = items.reduce((s, x) => s + (x.hourlyWage ?? 0), 0);
      out.push({ type: 'header', ym, count: items.length, total });
      items.forEach((doc) => out.push({ type: 'item', doc }));
    }
    return out;
  }, [grouped]);

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={rows}
      keyExtractor={(r, idx) =>
        r.type === 'header' ? `h-${r.ym}` : `m-${r.doc.matchId}-${idx}`
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.h2}>내 문서</Text>
          <Text style={[styles.subtitle, { marginTop: 4 }]}>
            모든 매칭의 근로계약서·원천징수영수증 한 곳에서 보기
          </Text>
          {docs.length > 0 ? (
            <TextInput
              style={[styles.input, { marginTop: 12, marginBottom: 0 }]}
              value={q}
              onChangeText={setQ}
              placeholder="매장명·날짜 검색 (예: 메가, 2026-04)"
              placeholderTextColor={colors.textLight}
            />
          ) : null}
          {docs.length > 0 && q.trim() ? (
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
              {grouped.reduce((s, [, items]) => s + items.length, 0)}건 일치
            </Text>
          ) : null}
          <View style={{ height: spacing.md }} />
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>📄</Text>
          <Text style={styles.bodyMuted}>아직 매칭 이력이 없어요</Text>
          <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 6 }]}>
            매칭이 완료되면 계약서·영수증이 여기 모입니다
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return (
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textMuted, letterSpacing: 0.3 }}>
                {item.ym} · {item.count}건
              </Text>
            </View>
          );
        }
        const d = item.doc;
        const dateLabel = (d.workDate ?? '').slice(0, 10).replace(/-/g, '.');
        return (
          <View style={[styles.card, { marginBottom: 8 }]}>
            <Pressable
              onPress={() => d.cafeId != null && router.push(`/cafe/${d.cafeId}` as never)}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 8 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { fontSize: 14 }]}>{d.cafeName}</Text>
                <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                  {dateLabel} · 시급 {fmtKRW(d.hourlyWage)} · {d.status}
                </Text>
              </View>
              {d.cafeId != null ? <Icon name="chevron-forward" size={14} color={colors.textLight} /> : null}
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => router.push(`/contract/${d.matchId}` as never)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: 'row',
                    gap: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    backgroundColor: colors.primarySoft,
                    borderWidth: 1,
                    borderColor: colors.primary,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 14 }}>📜</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primaryDark }}>
                  근로계약서
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/withholding/${d.matchId}` as never)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: 'row',
                    gap: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    backgroundColor: colors.successSoft,
                    borderWidth: 1,
                    borderColor: colors.success,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 14 }}>🧾</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.success }}>
                  원천징수영수증
                </Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}
