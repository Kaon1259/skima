import { Text, View } from 'react-native';

import {
  JOB_ROLE_LABEL,
  JobRole,
  REQUIREMENT_LABEL,
  SKILL_LEVEL_LABEL,
  SkillLevel,
} from '@/lib/types';
import { colors, radius } from '@/lib/theme';

type Props = {
  jobRole?: JobRole | null;
  minSkill?: SkillLevel | null;
  requirements?: string[];
  /** 워커 측에서 본인 등급/자격 비교 — 미달이면 ⚠️ 표시 */
  myLevel?: SkillLevel | null;
  myCertifications?: string[];
  myRoles?: JobRole[];
  /** 컴팩트 모드 — 카드용 (작게) */
  compact?: boolean;
};

const SKILL_ORDER: SkillLevel[] = ['L1_TRAINEE', 'L2_BASIC', 'L3_SKILLED', 'L4_EXPERT'];

export default function ShiftSkillBadges({
  jobRole,
  minSkill,
  requirements,
  myLevel,
  myCertifications,
  myRoles,
  compact,
}: Props) {
  const hasAny = jobRole || minSkill || (requirements && requirements.length > 0);
  if (!hasAny) return null;

  // 매칭 매트릭스 — 워커 비교
  const skillShortfall = myLevel && minSkill
    ? SKILL_ORDER.indexOf(myLevel) < SKILL_ORDER.indexOf(minSkill)
    : false;
  const roleMismatch = myRoles && myRoles.length > 0 && jobRole && !myRoles.includes(jobRole);
  const missingCerts = (requirements ?? []).filter(
    (r) => !(myCertifications ?? []).includes(r),
  );
  const myProvided = myLevel != null || myRoles != null || myCertifications != null;

  const fontSize = compact ? 10 : 11;
  const iconSize = compact ? 12 : 14;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: compact ? 6 : 8 }}>
      {jobRole ? (
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: roleMismatch ? colors.dangerSoft : colors.primarySoft,
            flexDirection: 'row',
            gap: 3,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: iconSize }}>{JOB_ROLE_LABEL[jobRole].emoji}</Text>
          <Text style={{ fontSize, fontWeight: '700', color: roleMismatch ? colors.danger : colors.primaryDark }}>
            {JOB_ROLE_LABEL[jobRole].label}
          </Text>
        </View>
      ) : null}

      {minSkill ? (
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: skillShortfall ? colors.dangerSoft : colors.infoSoft,
            flexDirection: 'row',
            gap: 3,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize, fontWeight: '900', color: skillShortfall ? colors.danger : colors.info }}>
            {SKILL_LEVEL_LABEL[minSkill].short}
          </Text>
          <Text style={{ fontSize, fontWeight: '700', color: skillShortfall ? colors.danger : colors.info }}>
            {SKILL_LEVEL_LABEL[minSkill].label}
          </Text>
          {skillShortfall ? <Text style={{ fontSize: iconSize }}>⚠️</Text> : null}
        </View>
      ) : null}

      {(requirements ?? []).map((r) => {
        const meta = REQUIREMENT_LABEL[r];
        if (!meta) return null;
        const missing = myProvided && missingCerts.includes(r);
        return (
          <View
            key={r}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: radius.pill,
              backgroundColor: missing ? colors.dangerSoft : colors.warnSoft,
              flexDirection: 'row',
              gap: 3,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: iconSize }}>{meta.emoji}</Text>
            <Text style={{ fontSize, fontWeight: '700', color: missing ? colors.danger : colors.warn }}>
              {meta.label}
            </Text>
            {missing ? <Text style={{ fontSize: iconSize }}>❌</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
