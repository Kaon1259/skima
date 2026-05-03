import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';

import { EmptyState } from '@/components/EmptyState';
import { api } from '@/lib/api';
import { HEALTH_CERT_STATUS_META, HealthCertStatus, fmtDateTime } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

type ReviewItem = {
  userId: number;
  userName: string;
  userPhone?: string | null;
  imageUrl?: string | null;
  status: HealthCertStatus;
  uploadedAt?: string | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  rejectReason?: string | null;
};

export default function AdminHealthCertsScreen() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [filter, setFilter] = useState<HealthCertStatus>('PENDING');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<ReviewItem[]>(`/api/admin/health-certs?status=${filter}`);
      setItems(data);
    } catch (e) {
      const msg = (e as Error).message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('오류', msg);
    } finally {
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  async function verify(item: ReviewItem) {
    setBusyId(item.userId);
    try {
      await api(`/api/admin/health-certs/${item.userId}/verify`, { method: 'POST' });
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(item: ReviewItem) {
    if (!rejectReason.trim()) {
      notify('거부 사유를 입력해주세요');
      return;
    }
    setBusyId(item.userId);
    try {
      await api(`/api/admin/health-certs/${item.userId}/reject`, {
        method: 'POST',
        body: { reason: rejectReason.trim() },
      });
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const FILTERS: HealthCertStatus[] = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'];

  return (
    <FlatList
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      data={items}
      keyExtractor={(i) => String(i.userId)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.h2}>📋 보건증 검토</Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              워커가 업로드한 보건증을 검증/거부 — VERIFIED 후 시프트 지원 가능
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
            {FILTERS.map((s) => {
              const active = filter === s;
              const meta = HEALTH_CERT_STATUS_META[s];
              return (
                <Pressable
                  key={s}
                  onPress={() => setFilter(s)}
                  style={[
                    styles.chip,
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>
                    {meta.emoji} {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          emoji="✅"
          title={`${HEALTH_CERT_STATUS_META[filter].label} 보건증이 없어요`}
          subtitle="워커가 새로 업로드하면 PENDING 탭에 표시됩니다"
        />
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { marginBottom: 10 }]}>
          {/* 헤더 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: 14 }]}>{item.userName}</Text>
              {item.userPhone ? (
                <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                  📞 {item.userPhone}
                </Text>
              ) : null}
              <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                업로드: {item.uploadedAt ? fmtDateTime(item.uploadedAt) : '—'}
                {item.expiresAt ? ` · 만료: ${item.expiresAt.slice(0, 10)}` : ''}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textMuted }}>
                {HEALTH_CERT_STATUS_META[item.status].emoji}{' '}
                {HEALTH_CERT_STATUS_META[item.status].label}
              </Text>
            </View>
          </View>

          {/* 이미지 */}
          {item.imageUrl ? (
            <ExpoImage
              source={{ uri: item.imageUrl }}
              style={{
                width: '100%',
                height: 240,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceMuted,
                marginBottom: 12,
              }}
              contentFit="contain"
            />
          ) : (
            <Text style={[styles.bodyMuted, { fontSize: 12 }]}>이미지 없음</Text>
          )}

          {item.rejectReason ? (
            <Text style={{ fontSize: 11, color: colors.danger, marginBottom: 8 }}>
              ❌ 거부 사유: {item.rejectReason}
            </Text>
          ) : null}

          {/* 액션 (PENDING 일 때만) */}
          {item.status === 'PENDING' ? (
            rejectingId === item.userId ? (
              <View>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="거부 사유 (예: 사진이 흐림 / 이름 불일치 / 만료된 보건증)"
                  placeholderTextColor={colors.textLight}
                  multiline
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[styles.buttonSecondary, { flex: 1 }]}
                    onPress={() => { setRejectingId(null); setRejectReason(''); }}
                  >
                    <Text style={styles.buttonSecondaryText}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.buttonPrimary, { flex: 1, backgroundColor: colors.danger }, busyId === item.userId && { opacity: 0.6 }]}
                    onPress={() => reject(item)}
                    disabled={busyId === item.userId}
                  >
                    <Text style={styles.buttonPrimaryText}>거부 확정</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setRejectingId(item.userId)}
                  disabled={busyId === item.userId}
                  style={[styles.buttonSecondary, { flex: 1, borderColor: colors.dangerSoft }]}
                >
                  <Text style={[styles.buttonSecondaryText, { color: colors.danger }]}>❌ 거부</Text>
                </Pressable>
                <Pressable
                  onPress={() => verify(item)}
                  disabled={busyId === item.userId}
                  style={[styles.buttonPrimary, { flex: 2, backgroundColor: colors.success }, busyId === item.userId && { opacity: 0.6 }]}
                >
                  <Text style={styles.buttonPrimaryText}>
                    {busyId === item.userId ? '처리 중...' : '✅ 인증 완료'}
                  </Text>
                </Pressable>
              </View>
            )
          ) : null}
        </View>
      )}
    />
  );
}
