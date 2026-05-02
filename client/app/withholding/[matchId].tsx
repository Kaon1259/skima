import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { WithholdingReceipt, fmtDateTime, fmtKRW } from '@/lib/types';
import { colors, spacing, styles } from '@/lib/theme';
import { DocSection, Field, Header } from '../contract/[matchId]';

export default function WithholdingScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { auth } = useAuth();
  const [data, setData] = useState<WithholdingReceipt | null>(null);

  useEffect(() => {
    if (!matchId || !auth) return;
    const path = auth.role === 'WORKER'
      ? `/api/worker/matches/${matchId}/withholding`
      : `/api/owner/matches/${matchId}/withholding`;
    api<WithholdingReceipt>(path)
      .then(setData)
      .catch((e) => {
        const msg = (e as Error).message;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
      });
  }, [matchId, auth]);

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
        <Text style={styles.bodyMuted}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
      showsVerticalScrollIndicator={false}
    >
      <Header
        title="일용근로 원천징수 영수증"
        sub="소득세법 제20조 분리과세 — 자동 계산"
        onBack={() => router.back()}
        onPrint={() => Platform.OS === 'web' && window.print()}
      />

      <View style={[styles.card, { padding: spacing.xl }]}>
        <DocSection title="지급자 (사업주)">
          <Field label="성명" value={data.employerName} />
          <Field label="사업장" value={data.employerCafeName} />
        </DocSection>

        <DocSection title="소득자 (근로자)">
          <Field label="성명" value={data.workerName} />
          <Field label="연락처" value={data.workerPhone} />
          <Field label="근무일" value={fmtDateTime(data.workDate)} />
        </DocSection>

        <DocSection title="과세 내역">
          <Field label="총 지급액" value={fmtKRW(data.grossAmount)} />
          <Field label="과세표준 (15만원 초과분)" value={fmtKRW(data.taxableAmount)} />
          <Field label="소득세 원천징수" value={`-${fmtKRW(data.withholdingTax)}`} />
          <Field label="지방소득세 (10%)" value={`-${fmtKRW(data.localIncomeTax)}`} />
          <Field label="실수령액" value={fmtKRW(data.netAmount)} bold />
        </DocSection>

        <DocSection title="법적 근거">
          <Text style={[styles.body, { lineHeight: 20 }]}>{data.taxClause}</Text>
        </DocSection>

        <View
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={styles.bodyMuted}>발급일: {fmtDateTime(data.issuedAt)}</Text>
          <Text style={styles.bodyMuted}>매칭 #{data.matchId}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
