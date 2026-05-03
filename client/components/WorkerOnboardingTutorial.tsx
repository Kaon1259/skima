import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { storage } from '@/lib/storage';
import { colors, radius, spacing, styles } from '@/lib/theme';

const FLAG_KEY = 'skima.worker.onboardingDone';

const STEPS: { emoji: string; title: string; body: string; cta?: { label: string; route: string } }[] = [
  {
    emoji: '👋',
    title: '환영합니다 — 1탭으로 알바 잡기',
    body: '시프트 검색 → 1탭 지원 → 점주 매칭 확정 → 출퇴근 → 30분 안에 입금. 면접 없습니다.',
  },
  {
    emoji: '⚙️',
    title: '내 프로필 등록',
    body: '등급·가능 직무·자격을 입력하면 매칭율이 올라갑니다. 자기소개·경력·가능 시간대도 함께 적어두세요.',
    cta: { label: '내 프로필 가기', route: '/worker/profile' },
  },
  {
    emoji: '🎯',
    title: '선호 조건 — 시프트 자동 좁히기',
    body: '마이 탭의 선호 조건에서 최소 시급·매장 평점·거리를 설정하면 시프트 화면이 알아서 좁혀집니다.',
    cta: { label: '마이 탭으로', route: '/worker/me' },
  },
  {
    emoji: '⭐',
    title: '단골 매장 등록 + 알림',
    body: '자주 가는 매장은 매장 상세에서 단골 등록. 새 시프트가 올라오면 즉시 푸시 — 신뢰도 기준 면제.',
  },
];

export function WorkerOnboardingTutorial({ enabled = true }: { enabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    storage.get(FLAG_KEY).then((v) => {
      if (!v) setVisible(true);
      setChecked(true);
    });
  }, [enabled]);

  function dismiss() {
    storage.set(FLAG_KEY, '1').catch(() => {});
    setVisible(false);
  }

  if (!checked) return null;
  if (!visible) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
      }}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg, padding: spacing.xl,
          width: '100%', maxWidth: 420,
        }}>
          {/* 진행 바 */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i <= step ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>

          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 56, marginBottom: 8 }}>{s.emoji}</Text>
            <Text style={[styles.h2, { fontSize: 18, textAlign: 'center' }]}>{s.title}</Text>
            <Text style={[styles.bodyMuted, { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 }]}>
              {s.body}
            </Text>
          </View>

          {s.cta ? (
            <Pressable
              onPress={() => {
                dismiss();
                router.push(s.cta!.route as never);
              }}
              style={({ pressed }) => [
                {
                  paddingVertical: 12, alignItems: 'center',
                  borderRadius: radius.md,
                  backgroundColor: colors.primarySoft,
                  borderWidth: 1.5, borderColor: colors.primary,
                  marginBottom: 10,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primaryDark }}>
                {s.cta.label}
              </Text>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {step > 0 ? (
              <Pressable
                onPress={() => setStep(step - 1)}
                style={[styles.buttonSecondary, { flex: 1 }]}
              >
                <Text style={styles.buttonSecondaryText}>이전</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={dismiss}
                style={[styles.buttonSecondary, { flex: 1 }]}
              >
                <Text style={styles.buttonSecondaryText}>건너뛰기</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => isLast ? dismiss() : setStep(step + 1)}
              style={[styles.buttonPrimary, { flex: 1 }]}
            >
              <Text style={styles.buttonPrimaryText}>{isLast ? '시작하기' : '다음'}</Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 10, color: colors.textLight, textAlign: 'center', marginTop: 12 }}>
            {step + 1} / {STEPS.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
