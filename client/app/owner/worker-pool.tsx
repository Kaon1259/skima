import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Modal, ScrollView } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import { useToast } from '@/lib/toast';
import { api } from '@/lib/api';
import { OwnerShift, WorkerPoolEntry, fmtDateTime, fmtKRW, fmtPercent } from '@/lib/types';
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

type Tier = 'VIP' | 'REGULAR' | 'NEW';

function classifyTier(w: WorkerPoolEntry): Tier {
  if (w.completedMatches >= 5 && (w.avgRatingByOwner ?? 0) >= 4.5) return 'VIP';
  if (w.completedMatches >= 2) return 'REGULAR';
  return 'NEW';
}

const TIER_META: Record<Tier, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  VIP: { label: 'VIP', emoji: '👑', color: '#7B5800', bg: '#FFF4D2', border: '#E5B100' },
  REGULAR: { label: '단골', emoji: '⭐', color: '#7C2D12', bg: '#FFEDD5', border: '#FB923C' },
  NEW: { label: '신규', emoji: '🌱', color: '#1E40AF', bg: '#DBEAFE', border: '#60A5FA' },
};

type TierFilter = 'ALL' | Tier;

export default function WorkerPoolScreen() {
  const toast = useToast();
  const [pool, setPool] = useState<WorkerPoolEntry[]>([]);
  const [inviteTarget, setInviteTarget] = useState<{ workerId: number; workerName: string } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<Sort>('favorites');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
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
      if (q && !w.workerName.toLowerCase().includes(q)) return false;
      if (tierFilter !== 'ALL' && classifyTier(w) !== tierFilter) return false;
      return true;
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
  }, [pool, sort, query, favoriteIds, tierFilter]);

  // 헤더 통계 — 그룹별
  const totals = useMemo(() => {
    let vip = 0, regular = 0, fresh = 0;
    for (const w of pool) {
      const t = classifyTier(w);
      if (t === 'VIP') vip++;
      else if (t === 'REGULAR') regular++;
      else fresh++;
    }
    const totalWorkers = pool.length;
    const noShowWorkers = pool.filter((w) => w.noShowCount > 0).length;
    return { totalWorkers, vip, regular, fresh, noShowWorkers };
  }, [pool]);

  return (
    <>
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

          {/* 헤더 통계 — 그룹별 + 노쇼 */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Stat label="총" value={totals.totalWorkers} color={colors.text} />
            <Stat label="👑 VIP" value={totals.vip} color={TIER_META.VIP.color} sub="5+ ★4.5+" />
            <Stat label="⭐ 단골" value={totals.regular} color={TIER_META.REGULAR.color} sub="2~4회" />
            <Stat label="🌱 신규" value={totals.fresh} color={TIER_META.NEW.color} sub="0~1회" />
            <Stat
              label="노쇼"
              value={totals.noShowWorkers}
              color={totals.noShowWorkers > 0 ? colors.danger : colors.textMuted}
            />
          </View>

          {/* 그룹 필터 */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            {(['ALL', 'VIP', 'REGULAR', 'NEW'] as TierFilter[]).map((t) => {
              const active = tierFilter === t;
              const meta = t === 'ALL' ? null : TIER_META[t];
              return (
                <Pressable
                  key={t}
                  onPress={() => setTierFilter(t)}
                  style={[
                    styles.chip,
                    active && {
                      backgroundColor: meta?.border ?? colors.primary,
                      borderColor: meta?.border ?? colors.primary,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>
                    {t === 'ALL' ? '전체' : `${meta!.emoji} ${meta!.label}`}
                  </Text>
                </Pressable>
              );
            })}
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
          onInvite={() => setInviteTarget({ workerId: item.workerId, workerName: item.workerName })}
        />
      )}
    />
    <InviteModal
      visible={inviteTarget != null}
      target={inviteTarget}
      onClose={() => setInviteTarget(null)}
      onSent={() => {
        toast.push({
          title: `📨 ${inviteTarget?.workerName ?? '워커'}에게 초대 발송`,
          subtitle: '워커가 1탭 수락하면 매칭 즉시 확정됩니다',
          severity: 'success',
        });
        setInviteTarget(null);
      }}
    />
    </>
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
  onInvite,
}: {
  entry: WorkerPoolEntry;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onInvite: () => void;
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
    : tone === 'favorite' ? colors.primary
    : colors.border;
  const bg =
    tone === 'positive' ? colors.successSoft
    : tone === 'negative' ? colors.dangerSoft
    : tone === 'favorite' ? colors.primary50
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
        <Avatar
          name={w.workerName}
          imageUrl={w.profileImage}
          size={44}
          bg={borderColor}
          fg="#fff"
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.title}>{w.workerName}</Text>
            {/* 신뢰도 점수 */}
            <TrustScoreBadge score={w.trustScore} />
            {/* 자동 그룹 뱃지 (VIP/단골/신규) */}
            {(() => {
              const tier = classifyTier(w);
              const meta = TIER_META[tier];
              return (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: radius.pill,
                    backgroundColor: meta.bg,
                    borderWidth: 1,
                    borderColor: meta.border,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '900', color: meta.color }}>
                    {meta.emoji} {meta.label}
                  </Text>
                </View>
              );
            })()}
            {isFavorite ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radius.pill,
                  backgroundColor: colors.primary100,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '900', color: colors.primary700 }}>⭐ 점주 단골</Text>
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

      {/* 1탭 재고용 — 시프트 직접 초대 */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onInvite();
        }}
        style={({ pressed }) => [
          {
            marginTop: 10,
            paddingVertical: 10,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
            borderWidth: 1.5,
            borderColor: colors.primary,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={{ fontSize: 14 }}>📨</Text>
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primaryDark }}>
          이 워커에게 시프트 직접 제안
        </Text>
      </Pressable>
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

function InviteModal({
  visible,
  target,
  onClose,
  onSent,
}: {
  visible: boolean;
  target: { workerId: number; workerName: string } | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [shifts, setShifts] = useState<OwnerShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [expiresMinutes, setExpiresMinutes] = useState(60);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setSelectedShiftId(null);
    setMessage('');
    api<OwnerShift[]>('/api/owner/shifts')
      .then((data) => setShifts(data.filter((s) => s.status === 'OPEN')))
      .catch(() => setShifts([]));
  }, [visible]);

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  async function submit() {
    if (!target || !selectedShiftId) {
      notify('초대할 시프트를 선택해주세요');
      return;
    }
    setBusy(true);
    try {
      await api('/api/owner/shift-invitations', {
        method: 'POST',
        body: {
          shiftId: selectedShiftId,
          workerId: target.workerId,
          message: message.trim() || null,
          expiresInMinutes: expiresMinutes,
        },
      });
      onSent();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg, padding: spacing.xl,
            width: '100%', maxWidth: 460, maxHeight: '90%',
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Text style={{ fontSize: 24 }}>📨</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.h2, { fontSize: 18 }]}>
                  {target?.workerName ?? '워커'} 님에게 시프트 제안
                </Text>
                <Text style={[styles.subtitle, { fontSize: 11, marginTop: 2 }]}>
                  워커가 1탭 수락하면 매칭 즉시 확정 (지원 단계 스킵)
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              제안할 시프트 (모집중 시프트만)
            </Text>
            {shifts.length === 0 ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={[styles.bodyMuted, { fontSize: 12 }]}>
                  등록된 모집중 시프트가 없어요. 시프트 먼저 등록 후 제안해주세요.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 6, marginBottom: 14 }}>
                {shifts.map((s) => {
                  const active = selectedShiftId === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedShiftId(s.id)}
                      style={({ pressed }) => [
                        {
                          padding: 12, borderRadius: radius.md,
                          backgroundColor: active ? colors.primarySoft : colors.surface,
                          borderWidth: 1.5,
                          borderColor: active ? colors.primary : colors.border,
                        },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                          {s.cafeName}
                        </Text>
                        {active ? <Text style={{ color: colors.primary }}>✓</Text> : null}
                      </View>
                      <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                        {fmtDateTime(s.startAt)} · 시급 {fmtKRW(s.hourlyWage)} · {s.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              메시지 (선택)
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
              value={message}
              onChangeText={setMessage}
              placeholder="예: 지난번 잘해주셔서 다시 모시고 싶어요"
              placeholderTextColor={colors.textLight}
              multiline
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              응답 마감
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {[30, 60, 120, 240].map((m) => {
                const active = expiresMinutes === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setExpiresMinutes(m)}
                    style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>{m}분</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.buttonSecondary, { flex: 1 }]} onPress={onClose} disabled={busy}>
                <Text style={styles.buttonSecondaryText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.buttonPrimary, { flex: 1 }, (busy || !selectedShiftId) && { opacity: 0.5 }]}
                onPress={submit}
                disabled={busy || !selectedShiftId}
              >
                <Text style={styles.buttonPrimaryText}>{busy ? '발송 중...' : '초대 발송'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
