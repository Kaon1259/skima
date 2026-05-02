import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { api } from '@/lib/api';
import { ContractData, fmtDateTime, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

export default function ContractScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [data, setData] = useState<ContractData | null>(null);

  useEffect(() => {
    if (!matchId) return;
    api<ContractData>(`/api/owner/matches/${matchId}/contract`)
      .then(setData)
      .catch((e) => {
        const msg = (e as Error).message;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
      });
  }, [matchId]);

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
        title="일용근로 표준 근로계약서"
        sub="근로기준법 제17조 명시사항 자동 생성"
        onBack={() => router.back()}
        onPrint={() => Platform.OS === 'web' && window.print()}
      />

      <View style={[styles.card, { padding: spacing.xl }]}>
        <DocSection title="사업주 (사용자)">
          <Field label="대표자" value={data.employerName} />
          <Field label="연락처" value={data.employerPhone} />
          <Field label="사업장명" value={data.employerCafeName} />
          <Field label="사업장 주소" value={data.employerCafeAddress} />
        </DocSection>

        <DocSection title="근로자">
          <Field label="성명" value={data.workerName} />
          <Field label="연락처" value={data.workerPhone} />
          <Field label="입금계좌" value={data.workerBankAccount} />
        </DocSection>

        <DocSection title="근로 조건">
          <Field label="근무 시작" value={fmtDateTime(data.workStartAt)} />
          <Field label="근무 종료" value={fmtDateTime(data.workEndAt)} />
          <Field label="근무 장소" value={data.workplaceAddress} />
          <Field label="업무 내용" value={data.jobDescription} />
          <Field label="시간급" value={fmtKRW(data.hourlyWage)} />
          <Field label="근로 분류" value={data.classification} />
        </DocSection>

        <DocSection title="임금 및 공제">
          <Field label="총 근로시간" value={`${Math.round(data.workMinutes / 6) / 10}시간`} />
          <Field label="총 임금" value={fmtKRW(data.grossAmount)} />
          <Field label="원천징수" value={`-${fmtKRW(data.withholdingTax)}`} />
          <Field label="실수령" value={fmtKRW(data.netAmount)} bold />
        </DocSection>

        <DocSection title="법적 근거 및 안내">
          <Text style={[styles.body, { marginBottom: 8 }]}>{data.taxClause}</Text>
          <Text style={[styles.bodyMuted, { fontSize: 12, lineHeight: 18 }]}>
            본 계약서는 근로기준법 제17조 및 동법 시행령 제8조에 따른 명시 의무 항목을 자동 정리한 일용근로 표준 양식입니다. 산업재해보상보험은 근로복지공단을 통해 자동 신고됩니다. 4대보험 가입은 같은 사업장 1개월 8일·60시간 이상 근무 시 별도 가입 의무가 발생합니다.
          </Text>
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

export function Header({
  title,
  sub,
  onBack,
  onPrint,
}: {
  title: string;
  sub: string;
  onBack: () => void;
  onPrint: () => void;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Pressable onPress={onBack}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>‹ 뒤로</Text>
        </Pressable>
        <Pressable
          onPress={onPrint}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>🖨️ 인쇄/PDF 저장</Text>
        </Pressable>
      </View>
      <Text style={styles.h2}>{title}</Text>
      <Text style={[styles.subtitle, { marginTop: 4 }]}>{sub}</Text>
    </View>
  );
}

export function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginBottom: 18,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: colors.primary,
          fontWeight: '800',
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Field({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 13, color: colors.textMuted, flex: 1 }}>{label}</Text>
      <Text
        style={{
          fontSize: bold ? 16 : 13,
          fontWeight: bold ? '900' : '600',
          color: bold ? colors.primary : colors.text,
          flex: 2,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
