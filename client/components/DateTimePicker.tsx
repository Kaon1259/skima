import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';

type Props = {
  /** ISO local string "YYYY-MM-DDTHH:mm" */
  value: string;
  onChange: (next: string) => void;
};

/**
 * 웹: HTML5 datetime-local input — 캘린더 + 시간 선택 UI 제공
 * 네이티브: @react-native-community/datetimepicker 사용 (iOS=datetime 모드, Android=date→time 순차)
 */
export function DateTimePicker({ value, onChange }: Props) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="datetime-local"
        value={value}
        onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
        style={{
          backgroundColor: colors.surfaceAlt,
          color: colors.text,
          borderRadius: radius.md,
          padding: 14,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          fontSize: 15,
          fontFamily: 'inherit',
          outlineStyle: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    );
  }
  return <NativeDateTimePicker value={value} onChange={onChange} />;
}

function NativeDateTimePicker({ value, onChange }: Props) {
  const RNPicker = require('@react-native-community/datetimepicker').default;
  const [stage, setStage] = useState<'idle' | 'date' | 'time'>('idle');
  const [draft, setDraft] = useState<Date | null>(null);

  const current = parseLocalIso(value) ?? new Date();
  const display = formatDisplay(current);

  function open() {
    setDraft(current);
    if (Platform.OS === 'ios') {
      setStage('date');  // iOS: datetime 모드 한 번
    } else {
      setStage('date');  // Android: date → time 순차
    }
  }

  function commit(d: Date) {
    onChange(toLocalIso(d));
    setStage('idle');
    setDraft(null);
  }

  function handleChange(_event: unknown, selected?: Date) {
    if (!selected) {
      setStage('idle');
      setDraft(null);
      return;
    }

    if (Platform.OS === 'ios') {
      setDraft(selected);
      return;  // iOS: 사용자가 "확인" 버튼 누를 때 commit
    }

    // Android: date → time 순차 처리
    if (stage === 'date') {
      const merged = new Date(draft ?? current);
      merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setDraft(merged);
      setStage('time');
    } else {
      const merged = new Date(draft ?? current);
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      commit(merged);
    }
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          {
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={{ fontSize: 15, color: colors.text }}>{display}</Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
          탭해서 달력/시계 열기
        </Text>
      </Pressable>

      {stage !== 'idle' ? (
        <>
          <RNPicker
            value={draft ?? current}
            mode={Platform.OS === 'ios' ? 'datetime' : stage}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            minuteInterval={5}
          />
          {Platform.OS === 'ios' ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={() => {
                  setStage('idle');
                  setDraft(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md,
                  padding: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '700' }}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => commit(draft ?? current)}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  padding: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>확인</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function parseLocalIso(localIso: string): Date | null {
  if (!localIso) return null;
  const [datePart, timePart = '00:00'] = localIso.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h = 0, m = 0] = timePart.split(':').map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getFullYear()}년 ${pad(d.getMonth() + 1)}월 ${pad(d.getDate())}일 (${dow}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 부분 입력 ("YYYY-MM-DDTHH" 등)을 정규화해 "YYYY-MM-DDTHH:mm:00" (서버 LocalDateTime) 형식으로 보정 */
export function toServerDateTime(localIso: string): string {
  if (!localIso) return '';
  const [datePart, timePart = ''] = localIso.split('T');
  if (!datePart || datePart.length < 10) return localIso;
  const [hh = '00', mm = '00', ss = '00'] = timePart.split(':');
  const pad = (s: string) => (s.length === 1 ? '0' + s : s).slice(0, 2);
  return `${datePart}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/** 기본값: 내일 오전 9시 — 일반적인 매장 운영 시작 시각.
 *  (오늘 1시간 후로 잡으면 데모/시드 환경에서 시드 시프트와 거의 항상 겹침,
 *   실 운영에서도 점주가 1시간 안에 매칭 가능한 워커 모집은 드문 케이스.) */
export function defaultStartLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalIso(d);
}

/** 시작 시각 + 시간 → 종료 시각 (LocalDateTime 형식) */
export function addHours(localIso: string, hours: number): string {
  if (!localIso) return '';
  const base = parseLocalIso(localIso);
  if (!base) return '';
  const next = new Date(base);
  next.setMinutes(next.getMinutes() + Math.round(hours * 60));
  return toLocalIso(next);
}
