import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import {
  JOB_ROLE_LABEL,
  JobRole,
  REQUIREMENT_KEYS,
  REQUIREMENT_LABEL,
  SKILL_LEVEL_LABEL,
  SkillLevel,
  MyProfile,
} from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

export default function MyProfileEditScreen() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [level, setLevel] = useState<SkillLevel>('L2_BASIC');
  const [roles, setRoles] = useState<Set<JobRole>>(new Set());
  const [certs, setCerts] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  const load = useCallback(async () => {
    try {
      const me = await api<MyProfile>('/api/me');
      setProfile(me);
      if (me.selfReportedLevel) setLevel(me.selfReportedLevel);
      else setLevel('L2_BASIC');
      setRoles(new Set(me.capableRoles ?? []));
      setCerts(new Set(me.certifications ?? []));
    } catch (e) {
      notify((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleRole(r: JobRole) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  }

  function toggleCert(k: string) {
    setCerts((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    try {
      await api('/api/me/worker-profile', {
        method: 'PUT',
        body: {
          selfReportedLevel: level,
          capableRoles: Array.from(roles),
          certifications: Array.from(certs),
        },
      });
      notify('프로필 저장 완료');
      router.back();
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
        <Text style={styles.h2}>내 능력 등록</Text>
        <Text style={[styles.subtitle, { marginTop: 4 }]}>
          자기신고 — 본인 능력에 맞는 시프트가 우선 노출됩니다
        </Text>
      </View>

      {/* 등급 */}
      <View style={styles.card}>
        <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 8 }]}>능력 등급</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(SKILL_LEVEL_LABEL) as SkillLevel[]).map((lv) => {
            const meta = SKILL_LEVEL_LABEL[lv];
            const selected = level === lv;
            return (
              <Pressable
                key={lv}
                onPress={() => setLevel(lv)}
                style={{
                  flex: 1,
                  minWidth: 70,
                  paddingHorizontal: 10,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '900', color: selected ? colors.primaryDark : colors.textMuted }}>
                  {meta.short}
                </Text>
                <Text style={{
                  fontSize: 13,
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
        <Text style={[styles.bodyMuted, { fontSize: 12, marginTop: 8 }]}>
          {SKILL_LEVEL_LABEL[level].desc}
        </Text>
      </View>

      {/* 가능 직무 */}
      <View style={styles.card}>
        <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 8 }]}>가능한 직무 (다중 선택)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(JOB_ROLE_LABEL) as JobRole[]).map((r) => {
            const meta = JOB_ROLE_LABEL[r];
            const on = roles.has(r);
            return (
              <Pressable
                key={r}
                onPress={() => toggleRole(r)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primarySoft : colors.surface,
                  flexDirection: 'row',
                  gap: 5,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: on ? colors.primaryDark : colors.text,
                }}>
                  {meta.label}
                </Text>
                {on ? <Text style={{ fontSize: 12, color: colors.primary }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
        {roles.size === 0 ? (
          <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 8 }]}>
            아무것도 안 고르면 모든 직무 가능 (디폴트)
          </Text>
        ) : null}
      </View>

      {/* 보유 자격 */}
      <View style={styles.card}>
        <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 8 }]}>보유 자격</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {REQUIREMENT_KEYS.map((k) => {
            const meta = REQUIREMENT_LABEL[k];
            const on = certs.has(k);
            return (
              <Pressable
                key={k}
                onPress={() => toggleCert(k)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: on ? colors.success : colors.border,
                  backgroundColor: on ? colors.successSoft : colors.surface,
                  flexDirection: 'row',
                  gap: 5,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12 }}>{meta.emoji}</Text>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: on ? colors.success : colors.textMuted,
                }}>
                  {meta.label}
                </Text>
                {on ? <Text style={{ fontSize: 11, color: colors.success }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 8 }]}>
          자기신고 — 점주 인증은 추후 도입 예정 (Phase 2)
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable
          style={[styles.buttonSecondary, { flex: 1 }]}
          onPress={() => router.back()}
          disabled={busy}
        >
          <Text style={styles.buttonSecondaryText}>취소</Text>
        </Pressable>
        <Pressable
          style={[styles.buttonPrimary, { flex: 1, flexDirection: 'row', gap: 6 }, busy && { opacity: 0.7 }]}
          onPress={save}
          disabled={busy}
        >
          <Icon name="checkmark" size={16} color="#fff" />
          <Text style={styles.buttonPrimaryText}>{busy ? '저장 중...' : '저장'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
