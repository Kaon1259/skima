import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';

import { HealthCertBadge } from '@/components/HealthCertBadge';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { deleteImage, pickAndUploadImage } from '@/lib/imageUpload';
import {
  HEALTH_CERT_STATUS_META,
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
  const [busyHealth, setBusyHealth] = useState(false);
  const [level, setLevel] = useState<SkillLevel>('L2_BASIC');
  const [roles, setRoles] = useState<Set<JobRole>>(new Set());
  const [certs, setCerts] = useState<Set<string>>(new Set());
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [availableHours, setAvailableHours] = useState('');
  const [bankAccount, setBankAccount] = useState('');
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
      setBio(me.bio ?? '');
      setExperienceYears(me.experienceYears != null ? String(me.experienceYears) : '');
      setAvailableHours(me.availableHours ?? '');
      setBankAccount(me.bankAccount ?? '');
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
    const expNum = experienceYears.trim() === '' ? null : Number(experienceYears);
    if (expNum != null && (Number.isNaN(expNum) || expNum < 0 || expNum > 60)) {
      notify('경력은 0~60년 사이의 숫자여야 합니다');
      return;
    }
    setBusy(true);
    try {
      await api('/api/me/worker-profile', {
        method: 'PUT',
        body: {
          selfReportedLevel: level,
          capableRoles: Array.from(roles),
          certifications: Array.from(certs),
          bio: bio.trim() || null,
          experienceYears: expNum,
          availableHours: availableHours.trim() || null,
          updateBio: true,
          bankAccount: bankAccount.trim() || null,
          updateBankAccount: true,
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
        <Text style={styles.h2}>내 프로필</Text>
        <Text style={[styles.subtitle, { marginTop: 4 }]}>
          능력 + 자기소개 + 경력 자기신고 — 점주가 검토할 정보입니다
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

      {/* 보건증 인증 — 식품 위생법상 필수, 이미지 등록으로 검증 */}
      <View style={[
        styles.card,
        profile?.healthCertStatus !== 'VERIFIED' && {
          borderWidth: 1.5,
          borderColor: profile?.healthCertStatus === 'EXPIRED' || profile?.healthCertStatus === 'REJECTED'
            ? colors.danger : colors.warn,
        },
      ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Text style={[styles.subtitle, { fontWeight: '700' }]}>보건증</Text>
          <HealthCertBadge status={profile?.healthCertStatus} size="sm" />
        </View>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>
          식품 위생법상 카페·베이커리 종사자는 보건증이 필수입니다. 이미지를 등록하면 자동 검증됩니다 (1년 유효).
          {profile?.healthCertExpiresAt ? `\n만료일: ${profile.healthCertExpiresAt.slice(0, 10)}` : ''}
        </Text>

        {profile?.healthCertImage ? (
          <View>
            <ExpoImage
              source={{ uri: profile.healthCertImage }}
              style={{ width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
              contentFit="cover"
            />
            {profile.healthCertRejectReason ? (
              <Text style={{ fontSize: 11, color: colors.danger, marginTop: 6 }}>
                ❌ 거부 사유: {profile.healthCertRejectReason}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={async () => {
                  setBusyHealth(true);
                  try {
                    await pickAndUploadImage('/api/me/health-cert');
                    await load();
                  } catch (e) {
                    const msg = (e as Error).message;
                    if (msg !== 'cancelled') notify(msg);
                  } finally { setBusyHealth(false); }
                }}
                disabled={busyHealth}
                style={[styles.buttonSecondary, { flex: 1, flexDirection: 'row', gap: 6 }]}
              >
                <Text style={{ fontSize: 14 }}>🔁</Text>
                <Text style={styles.buttonSecondaryText}>새 사진으로 교체</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const ok = Platform.OS === 'web'
                    ? window.confirm('보건증을 삭제하시겠습니까? 보건증 필수 시프트 지원이 차단됩니다.')
                    : await new Promise<boolean>((resolve) => {
                        Alert.alert('보건증 삭제', '보건증 필수 시프트 지원이 차단됩니다.', [
                          { text: '취소', style: 'cancel', onPress: () => resolve(false) },
                          { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
                        ]);
                      });
                  if (!ok) return;
                  setBusyHealth(true);
                  try {
                    await deleteImage('/api/me/health-cert');
                    await load();
                  } catch (e) {
                    notify((e as Error).message);
                  } finally { setBusyHealth(false); }
                }}
                disabled={busyHealth}
                style={[styles.buttonSecondary, { paddingHorizontal: 14, flexDirection: 'row', gap: 6, borderColor: colors.dangerSoft }]}
              >
                <Text style={{ fontSize: 14 }}>🗑️</Text>
                <Text style={[styles.buttonSecondaryText, { color: colors.danger }]}>삭제</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={async () => {
              setBusyHealth(true);
              try {
                await pickAndUploadImage('/api/me/health-cert');
                await load();
              } catch (e) {
                const msg = (e as Error).message;
                if (msg !== 'cancelled') notify(msg);
              } finally { setBusyHealth(false); }
            }}
            disabled={busyHealth}
            style={({ pressed }) => [
              {
                paddingVertical: 16,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.warn,
                backgroundColor: colors.warnSoft,
                alignItems: 'center',
                gap: 4,
              },
              (busyHealth || pressed) && { opacity: 0.7 },
            ]}
          >
            <Text style={{ fontSize: 24 }}>📋</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.warn }}>
              {busyHealth ? '업로드 중...' : '보건증 사진 업로드'}
            </Text>
            <Text style={{ fontSize: 10, color: colors.textMuted }}>
              JPG/PNG · 보건증 전체가 잘 보이는 사진
            </Text>
          </Pressable>
        )}
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
        <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 8 }]}>
          자기신고 — 점주 인증은 추후 도입 예정 (Phase 2)
        </Text>
      </View>

      {/* 자기소개 / 경력 / 가능 시간대 */}
      <View style={styles.card}>
        <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 4 }]}>자기소개</Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
          점주에게 보여질 어필 멘트입니다 (선택)
        </Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={bio}
          onChangeText={setBio}
          placeholder="예: 카페 알바 2년차 / 라떼아트 가능 / 주말 위주로 일합니다"
          placeholderTextColor={colors.textLight}
          multiline
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>
              💼 경력 (년)
            </Text>
            <TextInput
              style={styles.input}
              value={experienceYears}
              onChangeText={setExperienceYears}
              keyboardType="number-pad"
              placeholder="예: 2"
              placeholderTextColor={colors.textLight}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>
              🕒 가능 시간대
            </Text>
            <TextInput
              style={styles.input}
              value={availableHours}
              onChangeText={setAvailableHours}
              placeholder="예: 주말 / 평일 야간 / 새벽 가능"
              placeholderTextColor={colors.textLight}
            />
          </View>
        </View>
      </View>

      {/* 입금 계좌 — 정산 입금받을 계좌. 근로계약서·원천징수영수증에 표기됨 */}
      <View style={styles.card}>
        <Text style={[styles.subtitle, { fontWeight: '700', marginBottom: 4 }]}>💰 입금 계좌</Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
          정산 시 이 계좌로 입금됩니다. 근로계약서·원천징수영수증에 표기되므로 정확히 입력하세요.
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 0 }]}
          value={bankAccount}
          onChangeText={setBankAccount}
          placeholder="예: 토스뱅크 1234-5678-9012"
          placeholderTextColor={colors.textLight}
        />
        {!bankAccount.trim() ? (
          <Text style={{ fontSize: 11, color: colors.warn, fontWeight: '700', marginTop: 6 }}>
            ⚠️ 계좌 미입력 — 정산 입금 불가능
          </Text>
        ) : null}
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
