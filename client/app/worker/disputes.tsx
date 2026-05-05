import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { useFocusPolling } from '@/lib/useFocusPolling';
import {
  DISPUTE_REASON_LABEL,
  Dispute,
  DisputeStatus,
  DisputeVerdict,
  fmtDateTime,
} from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

const STATUS_LABEL: Record<DisputeStatus, { label: string; bg: string; fg: string }> = {
  PENDING:   { label: '판정 대기', bg: colors.warnSoft,   fg: colors.warn },
  RESOLVED:  { label: '판정 완료', bg: colors.successSoft, fg: colors.success },
  DISMISSED: { label: '기각',       bg: colors.surfaceMuted, fg: colors.textMuted },
};

const VERDICT_LABEL: Record<DisputeVerdict, string> = {
  REPORTER_WINS:    '신고 인정',
  RESPONDENT_WINS:  '신고 기각',
  NEUTRAL:          '중립 (운영자 검토)',
};

export default function WorkerDisputesScreen() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<Dispute[]>('/api/disputes');
      setItems(data);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusPolling(load, 30_000);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceAlt }}>
      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        data={items}
        keyExtractor={(d) => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.h2}>이의 제기 내역</Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              본인이 신고한 분쟁 — 자동 판정 결과 또는 진행 상태 표시
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
            <Text style={styles.bodyMuted}>등록된 이의 제기가 없어요</Text>
          </View>
        }
        renderItem={({ item: d }) => {
          const reason = DISPUTE_REASON_LABEL[d.reason];
          const status = STATUS_LABEL[d.status];
          return (
            <View style={[styles.card, { marginBottom: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 16 }}>{reason.emoji}</Text>
                <Text style={[styles.title, { fontSize: 14, flex: 1 }]} numberOfLines={1}>
                  {reason.label}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 8, paddingVertical: 2,
                    borderRadius: radius.pill, backgroundColor: status.bg,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '900', color: status.fg }}>
                    {status.label}
                  </Text>
                </View>
              </View>

              <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 6 }]}>
                {d.cafeName}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>
                신고일 {fmtDateTime(d.createdAt)}
              </Text>

              {d.comment ? (
                <View
                  style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                    상세
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.text, marginTop: 2 }}>
                    {d.comment}
                  </Text>
                </View>
              ) : null}

              {d.status === 'RESOLVED' && d.verdict ? (
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: radius.md,
                    backgroundColor: colors.infoSoft,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '900', color: colors.info }}>
                    📜 판정 결과: {VERDICT_LABEL[d.verdict]}
                  </Text>
                  {d.resolutionNote ? (
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                      {d.resolutionNote}
                    </Text>
                  ) : null}
                  {d.resolvedAt ? (
                    <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 4 }}>
                      판정 시각: {fmtDateTime(d.resolvedAt)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
