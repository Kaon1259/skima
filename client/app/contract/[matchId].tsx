import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { GradientButton } from '@/components/Gradient';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ContractData, fmtDateTime, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

export default function ContractScreen() {
  const { matchId, focus } = useLocalSearchParams<{ matchId: string; focus?: string }>();
  const { auth } = useAuth();
  const [data, setData] = useState<ContractData | null>(null);
  const [busyAck, setBusyAck] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const ackY = useRef<number | null>(null);
  const focusAck = focus === 'ack';

  useEffect(() => {
    if (!matchId || !auth) return;
    const path = auth.role === 'WORKER'
      ? `/api/worker/matches/${matchId}/contract`
      : `/api/owner/matches/${matchId}/contract`;
    api<ContractData>(path)
      .then(setData)
      .catch((e) => {
        const msg = (e as Error).message;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
      });
  }, [matchId, auth]);

  async function handleAcknowledge() {
    if (!matchId || !auth || !data) return;
    setBusyAck(true);
    try {
      const path = auth.role === 'WORKER'
        ? `/api/worker/matches/${matchId}/contract/ack`
        : `/api/owner/matches/${matchId}/contract/ack`;
      const r = await api<{ ownerAcknowledgedContractAt: string | null; workerAcknowledgedContractAt: string | null }>(
        path,
        { method: 'POST' },
      );
      // 응답 받은 시각으로 로컬 상태 갱신
      setData((prev) => prev ? {
        ...prev,
        ownerAcknowledgedAt: r.ownerAcknowledgedContractAt,
        workerAcknowledgedAt: r.workerAcknowledgedContractAt,
      } : prev);
      const msg = '근로계약서 확인이 등록되었어요';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('완료', msg);
    } catch (e) {
      const msg = (e as Error).message;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('오류', msg);
    } finally {
      setBusyAck(false);
    }
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
        <Text style={styles.bodyMuted}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
      showsVerticalScrollIndicator={false}
    >
      <Header
        title="일용근로 표준 근로계약서"
        sub={focusAck ? '👇 출근 전 마지막 단계 — 아래에서 확인 등록해주세요' : '근로기준법 제17조 명시사항 자동 생성'}
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

      {/* 양측 확인 상태 */}
      <View
        onLayout={(e) => {
          ackY.current = e.nativeEvent.layout.y;
          // focus=ack 진입 시 자동 스크롤 (한 번만)
          if (focusAck && scrollRef.current && ackY.current != null) {
            setTimeout(() => {
              scrollRef.current?.scrollTo({ y: ackY.current ?? 0, animated: true });
            }, 200);
          }
        }}
      >
        <AcknowledgeCard
          ownerName={data.employerName}
          workerName={data.workerName}
          ownerAt={data.ownerAcknowledgedAt}
          workerAt={data.workerAcknowledgedAt}
          myRole={auth?.role}
          onAcknowledge={handleAcknowledge}
          busy={busyAck}
          highlight={focusAck}
        />
      </View>
    </ScrollView>
  );
}

function AcknowledgeCard({
  ownerName,
  workerName,
  ownerAt,
  workerAt,
  myRole,
  onAcknowledge,
  busy,
  highlight,
}: {
  ownerName: string;
  workerName: string;
  ownerAt?: string | null;
  workerAt?: string | null;
  myRole?: 'OWNER' | 'WORKER' | 'ADMIN';
  onAcknowledge: () => void;
  busy: boolean;
  highlight?: boolean;
}) {
  const myAcked = myRole === 'WORKER' ? !!workerAt : !!ownerAt;
  const oppositeAcked = myRole === 'WORKER' ? !!ownerAt : !!workerAt;
  const oppositeName = myRole === 'WORKER' ? ownerName : workerName;
  const myLabel = myRole === 'WORKER' ? '근로자' : '사업주';
  const oppositeLabel = myRole === 'WORKER' ? '사업주' : '근로자';
  const bothAcked = !!ownerAt && !!workerAt;
  const showHighlight = highlight && !myAcked;

  return (
    <View
      style={{
        marginTop: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: bothAcked ? colors.successSoft : showHighlight ? colors.warnSoft : colors.primary50,
        borderWidth: showHighlight ? 3 : 1.5,
        borderColor: bothAcked ? colors.success : showHighlight ? colors.warn : colors.primary300,
      }}
    >
      {showHighlight ? (
        <View
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: colors.warn,
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>
            ⏳ 출근 전 필수 단계
          </Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 13, fontWeight: '900', color: bothAcked ? colors.success : showHighlight ? colors.warn : colors.primary700, marginBottom: 4 }}>
        {bothAcked ? '✓ 양측 확인 완료' : '📄 근로계약서 양측 확인'}
      </Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 12 }}>
        근로기준법 제17조에 따라 근로조건을 양측이 확인했음을 기록합니다. 분쟁 시 입증 자료로 사용됩니다.
      </Text>

      {/* 양측 상태 */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <AckStatus label="사업주" name={ownerName} at={ownerAt} />
        <AckStatus label="근로자" name={workerName} at={workerAt} />
      </View>

      {!myAcked ? (
        <GradientButton
          onPress={onAcknowledge}
          disabled={busy}
          label={busy ? '등록 중...' : `✍️ ${myLabel} 확인 등록`}
        />
      ) : (
        <View
          style={{
            paddingVertical: 12,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.success,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.success }}>
            ✓ 내 ({myLabel}) 확인 완료
          </Text>
          {!oppositeAcked ? (
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              {oppositeLabel}({oppositeName})의 확인을 기다리는 중
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function AckStatus({ label, name, at }: { label: string; name: string; at?: string | null }) {
  const acked = !!at;
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: acked ? colors.success : colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted }}>{label}</Text>
        {acked ? (
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: colors.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>✓</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, marginTop: 3 }} numberOfLines={1}>
        {name}
      </Text>
      <Text style={{ fontSize: 10, color: acked ? colors.success : colors.textLight, marginTop: 2 }}>
        {acked ? `${fmtDateTime(at!)} 확인` : '확인 대기 중'}
      </Text>
    </View>
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
