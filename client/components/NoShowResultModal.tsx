import { Modal, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { colors, radius, spacing, styles } from '@/lib/theme';

export type NoShowResult = {
  workerName: string;
  backupMatched: boolean;
  shiftReopened: boolean;
  backupWorkerName: string | null;
  backupMatchId: number | null;
  favoritingWorkerCount: number;
};

export function NoShowResultModal({
  visible,
  result,
  onClose,
}: {
  visible: boolean;
  result: NoShowResult | null;
  onClose: () => void;
}) {
  if (!result) return null;
  const r = result;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
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
            maxWidth: 440,
          }}
        >
          {r.backupMatched ? <BackupMatchedView result={r} onClose={onClose} /> : null}
          {!r.backupMatched && r.shiftReopened ? <ReopenedView result={r} onClose={onClose} /> : null}
          {!r.backupMatched && !r.shiftReopened ? <DoneView result={r} onClose={onClose} /> : null}
        </View>
      </View>
    </Modal>
  );
}

function BackupMatchedView({ result, onClose }: { result: NoShowResult; onClose: () => void }) {
  return (
    <View>
      {/* 헤더 */}
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <View
          style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.successSoft,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 26 }}>✅</Text>
        </View>
        <Text style={[styles.h2, { fontSize: 18, textAlign: 'center' }]}>
          백업 워커 자동 매칭 완료
        </Text>
        <Text style={[styles.bodyMuted, { fontSize: 12, textAlign: 'center', marginTop: 4 }]}>
          {result.workerName} 워커가 노쇼 처리되었고 새 워커가 연결됐어요
        </Text>
      </View>

      {/* 백업 워커 카드 */}
      <View
        style={{
          padding: 14,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1.5,
          borderColor: colors.success,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 6 }}>
          ⚡ 새 매칭 워커
        </Text>
        <Text style={[styles.title, { fontSize: 18 }]}>
          {result.backupWorkerName ?? '워커'}
        </Text>
        <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 4 }]}>
          PENDING 지원자 중 가장 먼저 지원한 워커가 자동 ACCEPT 됐습니다
        </Text>
      </View>

      <View
        style={{
          padding: 10,
          borderRadius: radius.md,
          backgroundColor: colors.warnSoft,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 11, color: colors.text, lineHeight: 17 }}>
          • 노쇼 워커({result.workerName})에 ★1 평가 자동 등록{'\n'}
          • 노쇼 워커에게 노쇼 등록 알림 발송{'\n'}
          • 백업 워커에게 매칭 확정 알림 발송
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {result.backupMatchId != null ? (
          <Pressable
            style={[styles.buttonSecondary, { flex: 1 }]}
            onPress={() => {
              onClose();
              // /worker 라우트는 점주가 진입 못함. 매칭이 시프트 화면에서 보이므로 그냥 닫기.
            }}
          >
            <Text style={styles.buttonSecondaryText}>닫기</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.buttonPrimary, { flex: 1 }]} onPress={onClose}>
          <Text style={styles.buttonPrimaryText}>확인</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReopenedView({ result, onClose }: { result: NoShowResult; onClose: () => void }) {
  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <View
          style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.warnSoft,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 26 }}>🔄</Text>
        </View>
        <Text style={[styles.h2, { fontSize: 18, textAlign: 'center' }]}>
          시프트 재모집 시작
        </Text>
        <Text style={[styles.bodyMuted, { fontSize: 12, textAlign: 'center', marginTop: 4 }]}>
          {result.workerName} 워커가 노쇼 처리됐고{'\n'}
          백업 후보가 없어 시프트가 OPEN 으로 돌아갔어요
        </Text>
      </View>

      {/* 단골 알림 카드 */}
      {result.favoritingWorkerCount > 0 ? (
        <View
          style={{
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: colors.warnSoft,
            borderWidth: 1.5,
            borderColor: colors.warn,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 6 }}>
            ⭐ 단골 워커 알림 발송
          </Text>
          <Text style={[styles.title, { fontSize: 18, color: colors.warn }]}>
            {result.favoritingWorkerCount}명에게 푸시
          </Text>
          <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 4 }]}>
            이 매장을 즐겨찾기한 워커들이 새 시프트 알림을 받습니다
          </Text>
        </View>
      ) : (
        <View
          style={{
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 6 }}>
            💡 안내
          </Text>
          <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
            아직 이 매장을 단골로 등록한 워커가 없어요.{'\n'}
            새 지원자가 들어올 때까지 대기합니다.
          </Text>
        </View>
      )}

      <View
        style={{
          padding: 10,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 17 }}>
          • 노쇼 워커({result.workerName})에 ★1 평가 자동 등록{'\n'}
          • 노쇼 워커에게 노쇼 등록 알림 발송{'\n'}
          • 시프트 상태: NO_SHOW → OPEN
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          style={[styles.buttonSecondary, { flex: 1 }]}
          onPress={() => {
            onClose();
            router.push('/owner/worker-pool' as never);
          }}
        >
          <Text style={styles.buttonSecondaryText}>워커풀 열기</Text>
        </Pressable>
        <Pressable style={[styles.buttonPrimary, { flex: 1 }]} onPress={onClose}>
          <Text style={styles.buttonPrimaryText}>확인</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DoneView({ result, onClose }: { result: NoShowResult; onClose: () => void }) {
  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <View
          style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 26 }}>📋</Text>
        </View>
        <Text style={[styles.h2, { fontSize: 18, textAlign: 'center' }]}>
          노쇼 등록 완료
        </Text>
        <Text style={[styles.bodyMuted, { fontSize: 12, textAlign: 'center', marginTop: 4 }]}>
          {result.workerName} 워커가 노쇼 처리되었습니다
        </Text>
      </View>

      <View
        style={{
          padding: 12,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 12, color: colors.text, lineHeight: 19 }}>
          • ★1 평가 자동 등록{'\n'}
          • 워커에게 노쇼 등록 알림 발송
        </Text>
      </View>

      <Pressable style={styles.buttonPrimary} onPress={onClose}>
        <Text style={styles.buttonPrimaryText}>확인</Text>
      </Pressable>
    </View>
  );
}
