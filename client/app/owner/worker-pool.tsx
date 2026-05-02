import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { WorkerPoolEntry, fmtDateTime, fmtPercent } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

type Sort = 'favorites' | 'recent' | 'rating' | 'rehire' | 'most-used' | 'no-show';

const SORT_LABEL: Record<Sort, string> = {
  favorites: '⭐ 단골',
  recent: '최근 매칭순',
  rating: '★ 높은순',
  rehire: '재고용 의향순',
  'most-used': '가장 많이 일한순',
  'no-show': '노쇼 많은순',
};

export default function WorkerPoolScreen() {
  const [pool, setPool] = useState<WorkerPoolEntry[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<Sort>('favorites');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, favs] = await Promise.all([
        api<WorkerPoolEntry[]>('/api/owner/worker-pool'),
        api<number[]>('/api/owner/favorites/workers').catch(() => [] as number[]),
      ]);
      setPool(data);
      setFavoriteIds(new Set(favs));
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  async function toggleFavorite(workerId: number) {
    const was = favoriteIds.has(workerId);
    // optimistic
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (was) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
    try {
      await api(`/api/owner/favorites/workers/${workerId}`, {
        method: was ? 'DELETE' : 'POST',
      });
    } catch (e) {
      // 롤백
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (was) next.add(workerId);
        else next.delete(workerId);
        return next;
      });
    }
  }

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const sorted = useMemo(() => {
    const filtered = pool.filter((w) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return w.workerName.toLowerCase().includes(q);
    });
    const arr = [...filtered];
    switch (sort) {
      case 'favorites':
        arr.sort((a, b) => {
          const fa = favoriteIds.has(a.workerId) ? 1 : 0;
          const fb = favoriteIds.has(b.workerId) ? 1 : 0;
          if (fa !== fb) return fb - fa;
          return (b.lastMatchAt ?? '').localeCompare(a.lastMatchAt ?? '');
        });
        break;
      case 'rating':
        arr.sort((a, b) => (b.avgRatingByOwner ?? -1) - (a.avgRatingByOwner ?? -1));
        break;
      case 'rehire':
        arr.sort((a, b) => (b.rehireRateByOwner ?? -1) - (a.rehireRateByOwner ?? -1));
        break;
      case 'most-used':
        arr.sort((a, b) => b.totalMatches - a.totalMatches);
        break;
      case 'no-show':
        arr.sort((a, b) => b.noShowCount - a.noShowCount);
        break;
      case 'recent':
      default:
        arr.sort((a, b) =>
          (b.lastMatchAt ?? '').localeCompare(a.lastMatchAt ?? ''),
        );
    }
    return arr;
  }, [pool, sort, query, favoriteIds]);

  // 헤더 통계
  const totals = useMemo(() => {
    const totalWorkers = pool.length;
    const repeaters = pool.filter((w) => w.totalMatches >= 2).length;
    const goodWorkers = pool.filter((w) => (w.avgRatingByOwner ?? 0) >= 4).length;
    const noShowWorkers = pool.filter((w) => w.noShowCount > 0).length;
    return { totalWorkers, repeaters, goodWorkers, noShowWorkers };
  }, [pool]);

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={sorted}
      keyExtractor={(w) => String(w.workerId)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.h2}>👥 워커 풀</Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              내 매장에 일했거나 일하기로 한 워커 — 별점·재고용 의향 한눈에
            </Text>
          </View>

          {/* 헤더 통계 */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Stat label="총 워커" value={totals.totalWorkers} color={colors.text} />
            <Stat label="재방문" value={totals.repeaters} color={colors.success} sub="2회+" />
            <Stat label="★4+" value={totals.goodWorkers} color={colors.warn} />
            <Stat
              label="노쇼"
              value={totals.noShowWorkers}
              color={totals.noShowWorkers > 0 ? colors.danger : colors.textMuted}
            />
          </View>

          {/* 검색 */}
          <View style={{ position: 'relative', marginBottom: 10 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="워커 이름 검색"
              placeholderTextColor={colors.textLight}
              style={[styles.input, { marginBottom: 0, paddingLeft: 38 }]}
            />
            <Text style={{ position: 'absolute', left: 14, top: 14, fontSize: 16 }}>🔍</Text>
          </View>

          {/* 정렬 */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSort(s)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: sort === s ? colors.primary : colors.border,
                  backgroundColor: sort === s ? colors.primary : colors.surface,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: sort === s ? '#fff' : colors.text }}>
                  {SORT_LABEL[s]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
          <Text style={styles.bodyMuted}>아직 매칭된 워커가 없어요</Text>
          <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 4 }]}>
            시프트를 등록하고 워커 매칭이 성립되면 여기 모입니다
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <WorkerCard
          entry={item}
          isFavorite={favoriteIds.has(item.workerId)}
          onToggleFavorite={() => toggleFavorite(item.workerId)}
        />
      )}
    />
  );
}

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
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
      <Text style={{ fontSize: 22, fontWeight: '900', color, marginTop: 4 }}>{value}</Text>
      {sub ? (
        <Text style={{ fontSize: 9, color: colors.textLight, marginTop: 1 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

function WorkerCard({
  entry: w,
  isFavorite,
  onToggleFavorite,
}: {
  entry: WorkerPoolEntry;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const tone = w.noShowCount > 0
    ? 'negative'
    : isFavorite
    ? 'favorite'
    : (w.avgRatingByOwner ?? 0) >= 4
    ? 'positive'
    : 'neutral';
  const borderColor =
    tone === 'positive' ? colors.success
    : tone === 'negative' ? colors.danger
    : tone === 'favorite' ? colors.warn
    : colors.border;
  const bg =
    tone === 'positive' ? colors.successSoft
    : tone === 'negative' ? colors.dangerSoft
    : tone === 'favorite' ? colors.warnSoft
    : colors.surfaceAlt;

  return (
    <Pressable
      onPress={() => router.push(`/u/${w.workerId}` as never)}
      style={({ pressed }) => [
        styles.card,
        { borderLeftWidth: 4, borderLeftColor: borderColor },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: borderColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
            {w.workerName.slice(-1)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.title}>{w.workerName}</Text>
            {isFavorite ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radius.pill,
                  backgroundColor: colors.warnSoft,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '900', color: colors.warn }}>⭐ 단골</Text>
              </View>
            ) : null}
            {w.totalMatches >= 2 ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radius.pill,
                  backgroundColor: colors.successSoft,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.success }}>
                  재방문 {w.totalMatches}회
                </Text>
              </View>
            ) : null}
            {w.noShowCount > 0 ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radius.pill,
                  backgroundColor: colors.dangerSoft,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.danger }}>
                  노쇼 {w.noShowCount}회
                </Text>
              </View>
            ) : null}
          </View>
          {w.lastMatchAt ? (
            <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
              {w.lastCafeName ? `${w.lastCafeName} · ` : ''}{fmtDateTime(w.lastMatchAt)}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          hitSlop={10}
          style={({ pressed }) => [
            { padding: 6, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={{ fontSize: 24 }}>{isFavorite ? '⭐' : '☆'}</Text>
        </Pressable>
      </View>

      {/* 통계 */}
      <View
        style={{
          marginTop: 12,
          padding: 10,
          borderRadius: radius.md,
          backgroundColor: bg,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <Pill label="내 평균" value={w.avgRatingByOwner != null ? `★${w.avgRatingByOwner.toFixed(1)}` : '—'} color={colors.warn} />
        <Pill
          label="재고용"
          value={w.rehireRateByOwner != null ? fmtPercent(w.rehireRateByOwner) : '—'}
          color={colors.success}
        />
        <Pill label="총 매칭" value={String(w.totalMatches)} color={colors.info} />
        <Pill label="완료" value={String(w.completedMatches)} color={colors.text} />
      </View>
    </Pressable>
  );
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontWeight: '900', color }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700', marginTop: 1 }}>
        {label}
      </Text>
    </View>
  );
}
