import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { api } from '@/lib/api';
import { DISPUTE_REASON_LABEL, DisputeReason } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

export function DisputeModal({
  visible,
  matchId,
  role,
  workerName,
  cafeName,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  matchId: number | null;
  role: 'WORKER' | 'OWNER';
  workerName?: string;
  cafeName?: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  function reset() {
    setReason(null);
    setComment('');
  }

  async function submit() {
    if (!matchId || !reason) {
      notify('사유를 선택해주세요');
      return;
    }
    setBusy(true);
    try {
      await api('/api/disputes', {
        method: 'POST',
        body: { matchId, reason, comment: comment.trim() || null },
      });
      notify('신고 접수 완료 — 24시간 내 자동 판정 또는 관리자 검토');
      reset();
      onSubmitted();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reasons = (Object.keys(DISPUTE_REASON_LABEL) as DisputeReason[])
    .filter((r) => DISPUTE_REASON_LABEL[r].allowedRoles.includes(role));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center', justifyContent: 'center',
        padding: spacing.lg,
      }}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg, padding: spacing.xl,
          width: '100%', maxWidth: 460, maxHeight: '90%',
        }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Text style={{ fontSize: 24 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.h2, { fontSize: 18 }]}>이의 제기</Text>
                <Text style={[styles.subtitle, { fontSize: 11, marginTop: 2 }]}>
                  매칭 종료 후 24시간 내 신고 가능 · 자동 판정 보조
                </Text>
              </View>
            </View>

            {workerName || cafeName ? (
              <View style={{
                padding: 10, borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt, marginBottom: 14,
              }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                  대상 매칭
                </Text>
                <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700', marginTop: 2 }}>
                  {workerName ?? cafeName}
                </Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              사유
            </Text>
            <View style={{ gap: 6, marginBottom: 14 }}>
              {reasons.map((r) => {
                const meta = DISPUTE_REASON_LABEL[r];
                const active = reason === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setReason(r)}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        padding: 12, borderRadius: radius.md,
                        backgroundColor: active ? colors.warnSoft : colors.surface,
                        borderWidth: 1.5,
                        borderColor: active ? colors.warn : colors.border,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                    <Text style={{
                      flex: 1, fontSize: 13, fontWeight: '700',
                      color: active ? colors.warn : colors.text,
                    }}>
                      {meta.label}
                    </Text>
                    {active ? <Text style={{ fontSize: 14, color: colors.warn }}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>
              상세 설명 (선택)
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={comment}
              onChangeText={setComment}
              placeholder="구체적인 시각·정황 등을 적어주시면 자동 판정에 도움이 됩니다"
              placeholderTextColor={colors.textLight}
              multiline
            />

            <View style={{
              padding: 10, borderRadius: radius.md,
              backgroundColor: colors.infoSoft, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 11, color: colors.text, lineHeight: 16 }}>
                💡 GPS 출근 기록·체크인/아웃 시각·채팅 내역이 자동 판정에 활용됩니다.{'\n'}
                허위 신고 시 계정 제재 대상이 될 수 있습니다.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={[styles.buttonSecondary, { flex: 1 }]}
                onPress={() => { reset(); onClose(); }}
                disabled={busy}
              >
                <Text style={styles.buttonSecondaryText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.buttonPrimary, { flex: 1, backgroundColor: colors.warn }, busy && { opacity: 0.7 }]}
                onPress={submit}
                disabled={busy}
              >
                <Text style={styles.buttonPrimaryText}>{busy ? '제출 중...' : '신고 제출'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
