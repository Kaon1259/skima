import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { GradientButton } from '@/components/Gradient';
import { Icon } from '@/components/Icon';

import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import {
  Cafe,
  JobRole,
  JOB_ROLE_LABEL,
  REQUIREMENT_KEYS,
  REQUIREMENT_LABEL,
  SkillLevel,
  SKILL_LEVEL_LABEL,
  fmtKRW,
} from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';
import {
  DateTimePicker,
  addHours,
  defaultStartLocal,
  toServerDateTime,
} from '@/components/DateTimePicker';

const MIN_WAGE_KR_2026 = 10030;

export default function NewShiftScreen() {
  const toast = useToast();
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [cafeId, setCafeId] = useState<number | null>(null);
  const [startAt, setStartAt] = useState<string>(defaultStartLocal());
  const [durationHours, setDurationHours] = useState('4');
  const [hourlyWage, setHourlyWage] = useState('11000');
  const [description, setDescription] = useState('피크타임 4시간');
  const [jobRole, setJobRole] = useState<JobRole | null>('BARISTA');
  const [minSkill, setMinSkill] = useState<SkillLevel>('L2_BASIC');
  const [requirements, setRequirements] = useState<Set<string>>(new Set());
  const toggleReq = (k: string) =>
    setRequirements((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  const [busy, setBusy] = useState(false);
  const [existingShiftCount, setExistingShiftCount] = useState<number | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritesOnlyMinutes, setFavoritesOnlyMinutes] = useState(30);
  const [overlap, setOverlap] = useState<{ count: number; overlaps: { id: number; startAt: string; endAt: string; status: string }[] } | null>(null);
  const [bulk, setBulk] = useState(false);
  const [bulkDays, setBulkDays] = useState('7');
  const ALL_DOWS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
  type Dow = (typeof ALL_DOWS)[number];
  const DOW_LABEL: Record<Dow, string> = {
    MONDAY: '월', TUESDAY: '화', WEDNESDAY: '수', THURSDAY: '목',
    FRIDAY: '금', SATURDAY: '토', SUNDAY: '일',
  };
  const [selectedDows, setSelectedDows] = useState<Dow[]>([...ALL_DOWS]);
  const toggleDow = (d: Dow) =>
    setSelectedDows((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  // 매장 목록 + 기존 시프트 카운트 — 화면 진입 시마다 새로고침 (탭 전환·온보딩 흐름 후 매장 등록 즉시 반영)
  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [data, shifts] = await Promise.all([
          api<Cafe[]>('/api/owner/cafes'),
          api<{ id: number }[]>('/api/owner/shifts').catch(() => [] as { id: number }[]),
        ]);
        setCafes(data);
        // 현재 선택된 cafeId 가 새 데이터에 없으면 첫 번째로 fallback
        setCafeId((prev) => {
          if (prev != null && data.some((c) => c.id === prev)) return prev;
          return data.length > 0 ? data[0].id : null;
        });
        setExistingShiftCount(shifts.length);
      } catch (e) {
        notify((e as Error).message);
      }
    })();
  }, []));

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  const dur = parseFloat(durationHours) || 0;
  const wage = parseInt(hourlyWage, 10) || 0;
  const totalEst = Math.round(dur * wage);
  const fee = Math.round(totalEst * 0.12);

  const endPreview = useMemo(() => addHours(startAt, dur), [startAt, dur]);

  // 중복 시프트 검증 — 단건 등록일 때만, 디바운스
  useEffect(() => {
    if (bulk || !cafeId || !startAt || !dur) {
      setOverlap(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const url = `/api/owner/shifts/check-overlap?cafeId=${cafeId}`
          + `&startAt=${encodeURIComponent(toServerDateTime(startAt))}`
          + `&endAt=${encodeURIComponent(toServerDateTime(endPreview))}`;
        const r = await api<{ hasOverlap: boolean; count: number; overlaps: { id: number; startAt: string; endAt: string; status: string }[] }>(url);
        setOverlap(r.hasOverlap ? { count: r.count, overlaps: r.overlaps } : null);
      } catch {
        setOverlap(null);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [bulk, cafeId, startAt, dur, endPreview]);

  // 일괄 등록 시 실제 생성될 시프트 개수 — 시작일 DOW 기준으로 윈도우 walk
  const bulkShiftCount = useMemo(() => {
    if (!bulk) return 1;
    const window = Math.max(1, Math.min(60, parseInt(bulkDays, 10) || 7));
    if (selectedDows.length === 7) return window;
    if (selectedDows.length === 0) return 0;
    const start = new Date(startAt);
    const dowNames: Dow[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    let count = 0;
    for (let i = 0; i < window; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      if (selectedDows.includes(dowNames[d.getDay()])) count++;
    }
    return count;
  }, [bulk, bulkDays, selectedDows, startAt]);

  async function submit() {
    if (!cafeId) {
      notify('매장을 선택해주세요. 매장이 없으면 "내 매장" 탭에서 먼저 등록하세요');
      return;
    }
    if (!startAt) {
      notify('시작 시각을 입력해주세요');
      return;
    }
    if (!dur || !wage) {
      notify('근무 시간과 시급은 양수여야 합니다');
      return;
    }
    // 최저시급 검증 — 미만이어도 등록은 가능, 단 확인 필요
    if (wage < MIN_WAGE_KR_2026) {
      const ok = Platform.OS === 'web'
        ? window.confirm(
            `시급 ${wage.toLocaleString()}원은 2026년 최저시급(${MIN_WAGE_KR_2026.toLocaleString()}원) 미만입니다.\n` +
            `이대로 등록하시면 워커들이 지원을 꺼릴 수 있습니다. 진행할까요?`,
          )
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              '최저시급 경고',
              `시급 ${wage.toLocaleString()}원은 2026 최저시급(${MIN_WAGE_KR_2026.toLocaleString()}원) 미만입니다.`,
              [
                { text: '취소', style: 'cancel', onPress: () => resolve(false) },
                { text: '그대로 등록', onPress: () => resolve(true) },
              ],
            );
          });
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (bulk) {
        const days = Math.max(1, Math.min(60, parseInt(bulkDays, 10) || 7));
        if (selectedDows.length === 0) {
          notify('요일을 1개 이상 선택해주세요');
          setBusy(false);
          return;
        }
        const allSelected = selectedDows.length === 7;
        const res = await api<unknown[]>('/api/owner/shifts/bulk', {
          method: 'POST',
          body: {
            cafeId,
            firstStartAt: toServerDateTime(startAt),
            durationHours: dur,
            hourlyWage: wage,
            headcount: 1,
            description,
            repeatDays: days,
            daysOfWeek: allSelected ? null : selectedDows,
            jobRole,
            minSkill,
            requirements: Array.from(requirements),
          },
        });
        const created = Array.isArray(res) ? res.length : days;
        notify(allSelected
          ? `${created}일 일괄 등록 완료!`
          : `${created}건 일괄 등록 완료 (${days}일 윈도우 / ${selectedDows.length}개 요일)`);
      } else {
        // 중복 시프트 경고 — 사용자 한 번 더 확인
        if (overlap && overlap.count > 0) {
          const ok = Platform.OS === 'web'
            ? window.confirm(`이 매장에 같은 시간대 시프트가 ${overlap.count}건 이미 있습니다. 그래도 등록할까요?`)
            : await new Promise<boolean>((resolve) => {
                Alert.alert(
                  '중복 시프트 경고',
                  `같은 매장·시간 시프트가 ${overlap.count}건 있습니다.\n그래도 등록할까요?`,
                  [
                    { text: '취소', style: 'cancel', onPress: () => resolve(false) },
                    { text: '그대로 등록', onPress: () => resolve(true) },
                  ],
                );
              });
          if (!ok) return;
        }
        const created = await api<{ id: number }>('/api/owner/shifts', {
          method: 'POST',
          body: {
            cafeId,
            startAt: toServerDateTime(startAt),
            endAt: toServerDateTime(endPreview),
            hourlyWage: wage,
            headcount: 1,
            description,
            jobRole,
            minSkill,
            requirements: Array.from(requirements),
            favoritesOnlyMinutes: favoritesOnly ? favoritesOnlyMinutes : null,
          },
        });
        notify(favoritesOnly
          ? `시프트 등록 완료! 단골 워커에게만 ${favoritesOnlyMinutes}분 우선 노출`
          : '시프트 등록 완료! 1시간 매칭 SLA 시작');
        // 단골 워커 알림 토스트
        api<{ count: number }>(`/api/owner/cafes/${cafeId}/favoriting-count`)
          .then((r) => {
            if (r.count > 0) {
              toast.push({
                title: `⭐ 단골 워커 ${r.count}명에게 알림 발송`,
                subtitle: '단골로 등록한 워커가 새 시프트를 즉시 확인할 수 있어요',
                severity: 'success',
                ttl: 6000,
              });
            }
          })
          .catch(() => {});
        // 첫 시프트면 시프트 상세로 진입 + firstTime 배너
        if (existingShiftCount === 0 && created?.id) {
          router.replace(`/owner/shift/${created.id}?firstTime=1`);
          return;
        }
        router.replace('/owner/shifts');
        return;
      }
      // 일괄 등록은 그냥 시프트 목록으로
      router.replace('/owner/shifts');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={styles.h2}>시프트 등록</Text>
        <Text style={[styles.subtitle, { marginTop: 4 }]}>
          등록하는 순간 1시간 매칭 SLA가 시작됩니다
        </Text>
      </View>

      {cafes.length === 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: colors.warn },
          ]}
        >
          <Text style={{ color: colors.warn, fontWeight: '700', marginBottom: 4 }}>
            등록된 매장이 없습니다
          </Text>
          <Text style={{ color: colors.warn, fontSize: 13 }}>
            "내 매장" 탭에서 먼저 매장을 등록해주세요.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={[styles.subtitle, { marginBottom: 8 }]}>매장</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cafes.map((c) => {
            const selected = c.id === cafeId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCafeId(c.id)}
                style={[
                  styles.chip,
                  selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.chipText, selected && { color: '#fff' }]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[styles.subtitle, { marginBottom: 6 }]}>시작 시각</Text>
        <DateTimePicker value={startAt} onChange={setStartAt} />

        <Text style={[styles.subtitle, { marginBottom: 6 }]}>근무 시간 (h)</Text>
        <TextInput
          style={styles.input}
          value={durationHours}
          onChangeText={setDurationHours}
          keyboardType="numeric"
          placeholderTextColor={colors.textLight}
        />

        <Text style={[styles.subtitle, { marginBottom: 6 }]}>시급 (원)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {[10000, 11000, 12000, 13000, 15000].map((w) => {
            const active = hourlyWage === String(w);
            return (
              <Pressable
                key={w}
                onPress={() => setHourlyWage(String(w))}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#fff' : colors.text }}>
                  {(w / 1000).toFixed(0)}k
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          value={hourlyWage}
          onChangeText={setHourlyWage}
          keyboardType="numeric"
          placeholderTextColor={colors.textLight}
        />
        {wage > 0 && wage < MIN_WAGE_KR_2026 ? (
          <View
            style={{
              marginTop: -8,
              marginBottom: 12,
              padding: 10,
              borderRadius: radius.md,
              backgroundColor: colors.warnSoft,
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.warn }}>
              2026 최저시급({MIN_WAGE_KR_2026.toLocaleString()}원) 미만입니다 — 워커 지원이 적을 수 있어요
            </Text>
          </View>
        ) : null}

        <Text style={[styles.subtitle, { marginBottom: 6 }]}>설명</Text>
        <TextInput
          style={[styles.input, { marginBottom: 0 }]}
          value={description}
          onChangeText={setDescription}
          placeholderTextColor={colors.textLight}
        />
      </View>

      {/* 직무 카테고리 */}
      <View style={styles.card}>
        <Text style={[styles.subtitle, { marginBottom: 8, fontWeight: '700' }]}>직무 (어떤 일?)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(JOB_ROLE_LABEL) as JobRole[]).map((r) => {
            const meta = JOB_ROLE_LABEL[r];
            const selected = jobRole === r;
            return (
              <Pressable
                key={r}
                onPress={() => setJobRole(selected ? null : r)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  flexDirection: 'row',
                  gap: 5,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: selected ? colors.primaryDark : colors.text,
                }}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {jobRole ? (
          <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 8 }]}>
            {JOB_ROLE_LABEL[jobRole].desc}
          </Text>
        ) : null}
      </View>

      {/* 능력 등급 */}
      <View style={styles.card}>
        <Text style={[styles.subtitle, { marginBottom: 8, fontWeight: '700' }]}>최소 요구 등급</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(SKILL_LEVEL_LABEL) as SkillLevel[]).map((lv) => {
            const meta = SKILL_LEVEL_LABEL[lv];
            const selected = minSkill === lv;
            return (
              <Pressable
                key={lv}
                onPress={() => setMinSkill(lv)}
                style={{
                  flex: 1,
                  minWidth: 70,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: selected ? colors.primaryDark : colors.textMuted }}>
                  {meta.short}
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: 2,
                  color: selected ? colors.primaryDark : colors.text,
                }}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 8 }]}>
          {SKILL_LEVEL_LABEL[minSkill].desc}
        </Text>
      </View>

      {/* 요구 자격 (다중) */}
      <View style={styles.card}>
        <Text style={[styles.subtitle, { marginBottom: 8, fontWeight: '700' }]}>요구 자격 (다중 선택)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {REQUIREMENT_KEYS.map((k) => {
            const meta = REQUIREMENT_LABEL[k];
            const on = requirements.has(k);
            return (
              <Pressable
                key={k}
                onPress={() => toggleReq(k)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primary100 : colors.surface,
                  flexDirection: 'row',
                  gap: 5,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12 }}>{meta.emoji}</Text>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: on ? colors.primary700 : colors.textMuted,
                }}>
                  {meta.label}
                </Text>
                {on ? <Text style={{ fontSize: 11, color: colors.primary }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
        {requirements.size === 0 ? (
          <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 8 }]}>
            선택 안 하면 자격 제약 없음 (모든 워커 지원 가능)
          </Text>
        ) : null}
      </View>

      {/* 일괄 등록 토글 */}
      <View style={styles.card}>
        <Pressable
          onPress={() => setBulk(!bulk)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: bulk ? colors.primary : colors.border,
              backgroundColor: bulk ? colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {bulk ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>✓</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              일괄 등록 (같은 시간대 반복)
            </Text>
            <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 2 }]}>
              주간 패턴 빠르게 등록하기 — 요일까지 골라서
            </Text>
          </View>
        </Pressable>
        {bulk ? (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.subtitle, { marginBottom: 6 }]}>윈도우 (며칠 동안)</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {['7', '14', '30', '60'].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setBulkDays(d)}
                  style={[
                    styles.chip,
                    bulkDays === d && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.chipText, bulkDays === d && { color: '#fff' }]}>{d}일</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.subtitle, { marginBottom: 6 }]}>요일 (탭으로 토글)</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              {ALL_DOWS.map((d) => {
                const on = selectedDows.includes(d);
                const isWeekend = d === 'SATURDAY' || d === 'SUNDAY';
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggleDow(d)}
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primary : colors.surface,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 13, fontWeight: '800',
                      color: on ? '#fff' : (isWeekend ? colors.danger : colors.text),
                    }}>
                      {DOW_LABEL[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={() => setSelectedDows([...ALL_DOWS])}
                style={[styles.chip]}
              >
                <Text style={styles.chipText}>매일</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedDows(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'])}
                style={[styles.chip]}
              >
                <Text style={styles.chipText}>주중만</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedDows(['SATURDAY', 'SUNDAY'])}
                style={[styles.chip]}
              >
                <Text style={styles.chipText}>주말만</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* 단골 우선 노출 토글 — 단건 등록 시만 */}
      {!bulk ? (
        <View style={styles.card}>
          <Pressable
            onPress={() => setFavoritesOnly(!favoritesOnly)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: favoritesOnly ? colors.primary : colors.border,
                backgroundColor: favoritesOnly ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {favoritesOnly ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                ⭐ 단골 워커에게 우선 노출
              </Text>
              <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 2 }]}>
                즐겨찾기한 워커만 N분간 먼저 지원 가능 — 그 이후 전체 공개
              </Text>
            </View>
          </Pressable>
          {favoritesOnly ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              {[10, 30, 60, 120].map((m) => {
                const active = favoritesOnlyMinutes === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setFavoritesOnlyMinutes(m)}
                    style={[
                      styles.chip,
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>{m}분</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 중복 시프트 경고 */}
      {!bulk && overlap && overlap.count > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.dangerSoft, borderWidth: 1.5, borderColor: colors.danger },
          ]}
        >
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 18 }}>⚠️</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.danger, flex: 1 }}>
              같은 매장·시간 시프트가 {overlap.count}건 있어요
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.text, lineHeight: 16 }}>
            {overlap.overlaps.slice(0, 3).map((o) => {
              const s = o.startAt.replace('T', ' ').slice(5, 16);
              const e = o.endAt.replace('T', ' ').slice(11, 16);
              return `• ${s}~${e} (${o.status})`;
            }).join('\n')}
            {overlap.overlaps.length > 3 ? `\n• 외 ${overlap.overlaps.length - 3}건` : ''}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: colors.primarySoft, padding: spacing.lg },
        ]}
      >
        <Text style={{ fontSize: 12, color: colors.primaryDark, fontWeight: '700' }}>
          예상 비용 (임금 + 수수료 12%)
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '900', color: colors.primaryDark, marginTop: 4 }}>
          {fmtKRW((totalEst + fee) * bulkShiftCount)}
        </Text>
        <Text style={{ fontSize: 12, color: colors.primaryDark, marginTop: 4, fontWeight: '600' }}>
          {bulk
            ? `1건당 ${fmtKRW(totalEst + fee)} × ${bulkShiftCount}건 (${bulkDays}일 윈도우)`
            : `임금 ${fmtKRW(totalEst)} + 수수료 ${fmtKRW(fee)}`}
        </Text>
        <Text style={{ fontSize: 12, color: colors.primaryDark, marginTop: 8 }}>
          {bulk ? `첫 시프트 종료: ${endPreview.replace('T', ' ')}` : `종료 예정: ${endPreview.replace('T', ' ')}`}
        </Text>
      </View>

      <View style={{ marginTop: 8 }}>
        <GradientButton
          onPress={submit}
          disabled={busy || cafes.length === 0}
          label={busy ? '등록 중...' : '시프트 등록 (1시간 매칭 시작)'}
          icon={<Icon name="rocket" size={16} color="#fff" />}
          size="lg"
        />
      </View>
    </ScrollView>
  );
}
