import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, styles } from '@/lib/theme';

export type RatingMode = 'owner-rates-worker' | 'worker-rates-owner' | 'owner-approve-payout';

type Props = {
  visible: boolean;
  matchId: number | null;
  targetName: string;
  mode?: RatingMode;
  onClose: () => void;
  onSubmitted: () => void;
};

const COPY: Record<RatingMode, {
  title: string;
  subtitleSuffix: string;
  apiPath: (matchId: number) => string;
  rehirePositive: string;
  rehireNegative: string;
  rehireLabel: string;
  commentPlaceholder: string;
  primaryButtonLabel?: string;
  banner?: string;
}> = {
  'owner-rates-worker': {
    title: '워커 평가',
    subtitleSuffix: ' 님의 근무를 평가해주세요',
    apiPath: (id) => `/api/owner/matches/${id}/rating`,
    rehirePositive: '또 부르고 싶다',
    rehireNegative: '다시는 안 부르겠다',
    rehireLabel: '재고용 의향',
    commentPlaceholder: '동료 점주에게 도움될 한 줄',
  },
  'worker-rates-owner': {
    title: '매장 평가',
    subtitleSuffix: ' 매장에서의 근무를 평가해주세요',
    apiPath: (id) => `/api/worker/matches/${id}/rating`,
    rehirePositive: '또 일하고 싶다',
    rehireNegative: '다시는 가지 않겠다',
    rehireLabel: '재방문 의향',
    commentPlaceholder: '동료 워커에게 도움될 한 줄',
  },
  'owner-approve-payout': {
    title: '정산 승인 + 평가',
    subtitleSuffix: ' 님의 근무 평가를 등록하고 정산을 승인해주세요',
    apiPath: (id) => `/api/owner/matches/${id}/approve-payout`,
    rehirePositive: '또 부르고 싶다',
    rehireNegative: '다시는 안 부르겠다',
    rehireLabel: '재고용 의향',
    commentPlaceholder: '동료 점주에게 도움될 한 줄',
    primaryButtonLabel: '평가 + 정산 승인',
    banner: '승인 즉시 SCHEDULED → 다음 분 안에 입금 처리. 30분 무응답 시 자동 승인됩니다.',
  },
};

export function RatingModal({
  visible,
  matchId,
  targetName,
  mode = 'owner-rates-worker',
  onClose,
  onSubmitted,
}: Props) {
  const [score, setScore] = useState(5);
  const [willRehire, setWillRehire] = useState(true);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  // 모달 열릴 때마다 폼 초기화
  useEffect(() => {
    if (visible) {
      setScore(5);
      setWillRehire(true);
      setComment('');
    }
  }, [visible]);

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
  }

  async function submit() {
    if (matchId == null) return;
    setBusy(true);
    try {
      await api(copy.apiPath(matchId), {
        method: 'POST',
        body: { score, willRehire, comment: comment.trim() || null },
      });
      notify('평가 등록 완료');
      onSubmitted();
      onClose();
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
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.xl,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <Text style={[styles.h2, { marginBottom: 4 }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { marginBottom: copy.banner ? 12 : 20 }]}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{targetName}</Text>
            {copy.subtitleSuffix}
          </Text>
          {copy.banner ? (
            <View
              style={{
                backgroundColor: colors.infoSoft,
                borderLeftWidth: 3,
                borderLeftColor: colors.info,
                padding: 10,
                borderRadius: radius.sm,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.info, fontWeight: '600', lineHeight: 18 }}>
                💡 {copy.banner}
              </Text>
            </View>
          ) : null}

          {/* 별점 */}
          <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 8 }]}>별점</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setScore(n)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: n <= score ? colors.warn : colors.border,
                  backgroundColor: n <= score ? colors.warnSoft : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>{n <= score ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>

          {/* 재고용/재방문 의향 */}
          <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 8 }]}>{copy.rehireLabel}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <Pressable
              style={[
                {
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  alignItems: 'center',
                  borderColor: willRehire ? colors.success : colors.border,
                  backgroundColor: willRehire ? colors.successSoft : colors.surface,
                },
              ]}
              onPress={() => setWillRehire(true)}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: willRehire ? colors.success : colors.text }}>
                {copy.rehirePositive}
              </Text>
            </Pressable>
            <Pressable
              style={[
                {
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  alignItems: 'center',
                  borderColor: !willRehire ? colors.danger : colors.border,
                  backgroundColor: !willRehire ? colors.dangerSoft : colors.surface,
                },
              ]}
              onPress={() => setWillRehire(false)}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: !willRehire ? colors.danger : colors.text }}>
                {copy.rehireNegative}
              </Text>
            </Pressable>
          </View>

          {/* 코멘트 */}
          <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 8 }]}>코멘트 (선택)</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={comment}
            onChangeText={setComment}
            placeholder={copy.commentPlaceholder}
            placeholderTextColor={colors.textLight}
            multiline
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              style={[styles.buttonSecondary, { flex: 1 }]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.buttonSecondaryText}>취소</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonPrimary, { flex: 1 }, busy && { opacity: 0.7 }]}
              onPress={submit}
              disabled={busy}
            >
              <Text style={styles.buttonPrimaryText}>
                {busy ? '등록 중...' : (copy.primaryButtonLabel ?? '평가 등록')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * 모달 트리거 직전 호출 — 활성 요소 blur 처리해서
 * RN Web Modal의 aria-hidden 접근성 경고 방지.
 */
export function blurFocusedForModal() {
  if (Platform.OS === 'web') {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === 'function') el.blur();
  }
}
