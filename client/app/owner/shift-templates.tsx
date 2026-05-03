import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { SkeletonList } from '@/components/Skeleton';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Cafe, JobRole, JOB_ROLE_LABEL, REQUIREMENT_KEYS, REQUIREMENT_LABEL, SKILL_LEVEL_LABEL, SkillLevel, fmtKRW } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
const ALL_DOWS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DOW_LABEL: Record<DayOfWeek, string> = {
  MONDAY: '월', TUESDAY: '화', WEDNESDAY: '수', THURSDAY: '목', FRIDAY: '금', SATURDAY: '토', SUNDAY: '일',
};

type Template = {
  id: number;
  cafeId: number;
  cafeName: string;
  name?: string | null;
  daysOfWeek: DayOfWeek[];
  startHour: number;
  startMinute: number;
  durationHours: number;
  hourlyWage: number;
  headcount: number;
  description?: string | null;
  jobRole?: JobRole | null;
  minSkill?: SkillLevel | null;
  requirements: string[];
  active: boolean;
};

export default function ShiftTemplatesScreen() {
  const toast = useToast();
  const [items, setItems] = useState<Template[]>([]);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [tpls, cs] = await Promise.all([
        api<Template[]>('/api/owner/shift-templates'),
        api<Cafe[]>('/api/owner/cafes').catch(() => [] as Cafe[]),
      ]);
      setItems(tpls);
      setCafes(cs);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
      setInitialLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  async function setActive(t: Template, value: boolean) {
    try {
      await api<Template>(`/api/owner/shift-templates/${t.id}/active?value=${value}`, { method: 'POST' });
      setItems((prev) => prev.map((x) => x.id === t.id ? { ...x, active: value } : x));
    } catch (e) {
      notify((e as Error).message);
    }
  }

  async function remove(t: Template) {
    const ok = Platform.OS === 'web'
      ? window.confirm(`"${t.name || `${DOW_LABEL[t.daysOfWeek[0] ?? 'MONDAY']} ${t.startHour}시`}" 템플릿을 삭제할까요? (이미 생성된 시프트는 유지)`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert('템플릿 삭제', `"${t.name ?? '템플릿'}" 을(를) 삭제할까요?`, [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!ok) return;
    try {
      await api(`/api/owner/shift-templates/${t.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e) {
      notify((e as Error).message);
    }
  }

  async function materialize(t: Template) {
    try {
      const r = await api<{ created: number }>(`/api/owner/shift-templates/${t.id}/materialize?days=14`, { method: 'POST' });
      if (r.created > 0) {
        toast.push({
          title: `✅ ${r.created}건 시프트 등록 완료`,
          subtitle: '향후 14일치 시프트가 생성됐어요',
          severity: 'success',
        });
      } else {
        toast.push({ title: '신규 등록할 시프트가 없어요', subtitle: '이미 모두 등록되어 있습니다', severity: 'info' });
      }
    } catch (e) {
      notify((e as Error).message);
    }
  }

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.surfaceAlt }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        data={items}
        keyExtractor={(t) => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.h2}>시프트 템플릿</Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              매주 X요일에 자동으로 시프트가 등록됩니다 (매일 자정 cron + 즉시 적용)
            </Text>
            <Pressable
              onPress={() => setModalOpen(true)}
              style={({ pressed }) => [
                styles.buttonPrimary,
                { marginTop: 12, flexDirection: 'row', gap: 6 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Icon name="add" size={16} color="#fff" />
              <Text style={styles.buttonPrimaryText}>새 템플릿</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          !initialLoaded ? (
            <SkeletonList count={2} />
          ) : (
            <EmptyState
              emoji="🗓️"
              title="아직 템플릿이 없어요"
              subtitle="매주 같은 시간 시프트를 등록하면 자동 반복으로 시간 절약 — 매장 1개당 여러 개 가능"
              actions={[{ label: '첫 템플릿 만들기', onPress: () => setModalOpen(true) }]}
            />
          )
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              {
                opacity: item.active ? 1 : 0.55,
                borderLeftWidth: 4,
                borderLeftColor: item.active ? colors.success : colors.border,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { fontSize: 15 }]}>
                  {item.name || `${item.cafeName} ${item.startHour}:${String(item.startMinute).padStart(2, '0')}`}
                </Text>
                <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 2 }]}>
                  📍 {item.cafeName}
                </Text>
              </View>
              <Pressable
                onPress={() => setActive(item, !item.active)}
                hitSlop={8}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  backgroundColor: item.active ? colors.successSoft : colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: item.active ? colors.success : colors.border,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: item.active ? colors.success : colors.textMuted }}>
                  {item.active ? '● 활성' : '○ 비활성'}
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
              {ALL_DOWS.map((d) => {
                const on = item.daysOfWeek.includes(d);
                return (
                  <View
                    key={d}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: radius.pill,
                      backgroundColor: on ? colors.primarySoft : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: on ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: on ? colors.primaryDark : colors.textLight }}>
                      {DOW_LABEL[d]}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={[styles.bodyMuted, { fontSize: 12 }]}>
                🕒 {String(item.startHour).padStart(2, '0')}:{String(item.startMinute).padStart(2, '0')} 시작
                {' · '}{item.durationHours}h
                {' · 시급 '}{fmtKRW(item.hourlyWage)}
              </Text>
              {item.jobRole ? (
                <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 4 }]}>
                  {JOB_ROLE_LABEL[item.jobRole]?.emoji ?? ''} {JOB_ROLE_LABEL[item.jobRole]?.label ?? item.jobRole}
                  {item.minSkill ? ` · ${SKILL_LEVEL_LABEL[item.minSkill]?.short ?? item.minSkill}+` : ''}
                  {item.requirements.length > 0 ? ` · ${item.requirements.length}개 자격` : ''}
                </Text>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => materialize(item)}
                style={({ pressed }) => [
                  { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>지금 14일치 등록</Text>
              </Pressable>
              <Pressable
                onPress={() => remove(item)}
                style={({ pressed }) => [
                  { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.dangerSoft, alignItems: 'center' },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '800' }}>삭제</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <CreateModal
        visible={modalOpen}
        cafes={cafes}
        busy={busy}
        onClose={() => setModalOpen(false)}
        onCreated={async (req) => {
          setBusy(true);
          try {
            await api('/api/owner/shift-templates', { method: 'POST', body: req });
            toast.push({ title: '✅ 템플릿 추가 완료', subtitle: '내일 자정 cron 부터 자동 등록 시작', severity: 'success' });
            setModalOpen(false);
            await load();
          } catch (e) {
            notify((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function CreateModal({
  visible, cafes, busy, onClose, onCreated,
}: {
  visible: boolean;
  cafes: Cafe[];
  busy: boolean;
  onClose: () => void;
  onCreated: (req: any) => void;
}) {
  const [cafeId, setCafeId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [dows, setDows] = useState<Set<DayOfWeek>>(new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']));
  const [startHour, setStartHour] = useState('9');
  const [startMinute, setStartMinute] = useState('0');
  const [duration, setDuration] = useState('4');
  const [wage, setWage] = useState('11000');
  const [headcount, setHeadcount] = useState('1');
  const [description, setDescription] = useState('주간 반복');
  const [jobRole, setJobRole] = useState<JobRole | null>('BARISTA');
  const [minSkill, setMinSkill] = useState<SkillLevel>('L2_BASIC');
  const [requirements, setRequirements] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (cafes.length > 0 && cafeId == null) setCafeId(cafes[0].id);
  }, [cafes, cafeId]);

  function toggleDow(d: DayOfWeek) {
    setDows((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }

  function toggleReq(k: string) {
    setRequirements((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function submit() {
    if (!cafeId) return;
    if (dows.size === 0) return;
    onCreated({
      cafeId,
      name: name.trim() || null,
      daysOfWeek: Array.from(dows),
      startHour: parseInt(startHour, 10) || 0,
      startMinute: parseInt(startMinute, 10) || 0,
      durationHours: parseFloat(duration) || 4,
      hourlyWage: parseInt(wage, 10) || 11000,
      headcount: parseInt(headcount, 10) || 1,
      description: description.trim() || null,
      jobRole,
      minSkill,
      requirements: Array.from(requirements),
      active: true,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: 460, maxHeight: '90%' }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.h2, { fontSize: 18, marginBottom: 4 }]}>새 시프트 템플릿</Text>
            <Text style={[styles.subtitle, { marginBottom: 16 }]}>매주 X요일 자동 반복 등록</Text>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>📍 매장</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {cafes.map((c) => {
                const on = cafeId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCafeId(c.id)}
                    style={[styles.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.chipText, on && { color: '#fff' }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>이름 (선택)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="예: 평일 오프닝 / 주말 마감"
              placeholderTextColor={colors.textLight}
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>요일</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {ALL_DOWS.map((d) => {
                const on = dows.has(d);
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
                    <Text style={{ fontSize: 13, fontWeight: '800', color: on ? '#fff' : colors.text }}>
                      {DOW_LABEL[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>시작 시 (hour)</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={startHour} onChangeText={setStartHour} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>분</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={startMinute} onChangeText={setStartMinute} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>근무 시간</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={duration} onChangeText={setDuration} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>시급</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={wage} onChangeText={setWage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>인원</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={headcount} onChangeText={setHeadcount} />
              </View>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>설명</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="예: 평일 오프닝, 청소 + 오픈 준비"
              placeholderTextColor={colors.textLight}
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>직무</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
              {(Object.keys(JOB_ROLE_LABEL) as JobRole[]).map((r) => {
                const on = jobRole === r;
                const meta = JOB_ROLE_LABEL[r];
                return (
                  <Pressable
                    key={r}
                    onPress={() => setJobRole(on ? null : r)}
                    style={{
                      paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.pill,
                      borderWidth: 1, borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primarySoft : colors.surface,
                      flexDirection: 'row', gap: 4, alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>{meta.emoji}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: on ? colors.primaryDark : colors.textMuted }}>
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>최소 등급</Text>
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: 12 }}>
              {(Object.keys(SKILL_LEVEL_LABEL) as SkillLevel[]).map((lv) => {
                const on = minSkill === lv;
                const meta = SKILL_LEVEL_LABEL[lv];
                return (
                  <Pressable
                    key={lv}
                    onPress={() => setMinSkill(lv)}
                    style={{
                      flex: 1,
                      paddingVertical: 8, borderRadius: radius.md,
                      borderWidth: 1, borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primarySoft : colors.surface,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '900', color: on ? colors.primaryDark : colors.textMuted }}>
                      {meta.short}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 }}>요구 자격 (다중)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
              {REQUIREMENT_KEYS.map((k) => {
                const on = requirements.has(k);
                const meta = REQUIREMENT_LABEL[k];
                return (
                  <Pressable
                    key={k}
                    onPress={() => toggleReq(k)}
                    style={{
                      paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill,
                      borderWidth: 1, borderColor: on ? colors.warn : colors.border,
                      backgroundColor: on ? colors.warnSoft : colors.surface,
                      flexDirection: 'row', gap: 4, alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 11 }}>{meta.emoji}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: on ? colors.warn : colors.textMuted }}>
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.buttonSecondary, { flex: 1 }]} onPress={onClose} disabled={busy}>
                <Text style={styles.buttonSecondaryText}>취소</Text>
              </Pressable>
              <Pressable style={[styles.buttonPrimary, { flex: 1 }, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy}>
                <Text style={styles.buttonPrimaryText}>{busy ? '저장 중...' : '템플릿 저장'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
