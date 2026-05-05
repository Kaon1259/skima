import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { GradientButton } from '@/components/Gradient';
import { api } from '@/lib/api';
import { ShiftInvitationItem, fmtDateTime, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

export default function WorkerInvitationsScreen() {
  const [items, setItems] = useState<ShiftInvitationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<ShiftInvitationItem[]>('/api/worker/invitations');
      setItems(data);
    } catch (e) {
      const msg = (e as Error).message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
      setInitialLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  async function accept(inv: ShiftInvitationItem) {
    setBusyId(inv.id);
    try {
      const r = await api<{ ok: boolean; matchId: number }>(
        `/api/worker/invitations/${inv.id}/accept`,
        { method: 'POST' },
      );
      notify('✅ 매칭 확정! 내 매칭으로 이동합니다');
      await load();
      router.replace(`/worker/matches?focus=${r.matchId}` as never);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(inv: ShiftInvitationItem) {
    const ok = Platform.OS === 'web'
      ? window.confirm(`${inv.cafeName} 초대를 거절할까요?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert('초대 거절', `${inv.cafeName} 초대를 거절할까요?`, [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '거절', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!ok) return;
    setBusyId(inv.id);
    try {
      await api(`/api/worker/invitations/${inv.id}/reject`, { method: 'POST' });
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function expiresIn(iso: string): string {
    const left = new Date(iso).getTime() - Date.now();
    if (left <= 0) return '만료됨';
    const min = Math.floor(left / 60000);
    if (min < 60) return `${min}분 남음`;
    return `${Math.floor(min / 60)}시간 ${min % 60}분 남음`;
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={items}
      keyExtractor={(i) => String(i.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={styles.h2}>📨 점주 직접 호출</Text>
          <Text style={[styles.subtitle, { marginTop: 4 }]}>
            점주가 콕 찍어 보낸 시프트 — 1탭 수락하면 매칭 즉시 확정
          </Text>
        </View>
      }
      ListEmptyComponent={
        !initialLoaded ? null : (
          <EmptyState
            emoji="📭"
            title="받은 초대가 없어요"
            subtitle="점주가 단골 워커에게 직접 시프트를 제안할 때 여기 표시됩니다. 매장 단골 등록 + 좋은 평가 받으면 호출 받을 확률 ↑"
            actions={[{
              label: '시프트 검색',
              onPress: () => router.push('/worker/shifts' as never),
            }]}
          />
        )
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.card,
            {
              borderLeftWidth: 4,
              borderLeftColor: colors.primary,
              backgroundColor: colors.primarySoft,
              marginBottom: 10,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 22 }}>📨</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: 14 }]}>
                {item.cafeName}
              </Text>
              <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                점주 {item.ownerName} 님의 직접 호출
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: colors.warn,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>
                ⏱ {expiresIn(item.expiresAt)}
              </Text>
            </View>
          </View>

          <View
            style={{
              padding: 10, borderRadius: radius.md,
              backgroundColor: colors.surface, marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
              {fmtDateTime(item.startAt)} ~ {fmtDateTime(item.endAt).slice(11, 16)}
            </Text>
            <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
              💰 시급 {fmtKRW(item.hourlyWage)}
            </Text>
            {item.message ? (
              <Text style={{ fontSize: 12, color: colors.text, marginTop: 8, fontStyle: 'italic' }}>
                "{item.message}"
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => reject(item)}
              disabled={busyId === item.id}
              style={[
                styles.buttonSecondary,
                { flex: 1, borderColor: colors.dangerSoft },
                busyId === item.id && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.buttonSecondaryText, { color: colors.danger }]}>거절</Text>
            </Pressable>
            <View style={{ flex: 2 }}>
              <GradientButton
                onPress={() => accept(item)}
                disabled={busyId === item.id}
                label={busyId === item.id ? '처리 중...' : '✅ 수락 — 1탭 매칭'}
              />
            </View>
          </View>

          <Pressable
            onPress={() => router.push(`/cafe/${item.cafeId}` as never)}
            style={{ marginTop: 8, paddingVertical: 6, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
              매장 정보 보기 ›
            </Text>
          </Pressable>
        </View>
      )}
    />
  );
}
