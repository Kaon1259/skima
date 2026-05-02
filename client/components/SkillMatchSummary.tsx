import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import {
  JOB_ROLE_LABEL,
  JobRole,
  REQUIREMENT_LABEL,
  SKILL_LEVEL_LABEL,
  SKILL_LEVEL_ORDER,
  SkillLevel,
} from '@/lib/types';
import { colors, radius } from '@/lib/theme';

type Props = {
  /** 시프트의 요구 능력 */
  shiftJobRole?: JobRole | null;
  shiftMinSkill?: SkillLevel | null;
  shiftRequirements?: string[];
  /** 지원자(워커) 자기신고 능력 */
  workerLevel?: SkillLevel | null;
  workerRoles?: JobRole[];
  workerCertifications?: string[];
};

/**
 * 점주 측 지원자 카드용 — 시프트 요구 vs 워커 자기신고 한 줄 매칭 요약.
 * "✅ 모두 충족" / "⚠️ L2 (요구 L3) · 보건증 미보유" / "ℹ️ 능력 미신고"
 */
export default function SkillMatchSummary({
  shiftJobRole,
  shiftMinSkill,
  shiftRequirements,
  workerLevel,
  workerRoles,
  workerCertifications,
}: Props) {
  const reqs = shiftRequirements ?? [];
  const hasAnyShiftSpec = shiftJobRole || shiftMinSkill || reqs.length > 0;
  if (!hasAnyShiftSpec) return null;

  const wRoles = workerRoles ?? [];
  const wCerts = workerCertifications ?? [];
  const workerUnreported =
    workerLevel == null && wRoles.length === 0 && wCerts.length === 0;

  if (workerUnreported) {
    return (
      <Pill bg={colors.surfaceMuted} fg={colors.textMuted}>
        ℹ️ 능력 미신고
      </Pill>
    );
  }

  // 직무 일치: capableRoles 가 비어있으면 "모든 직무 가능" 으로 해석 (User 도메인 주석 기준)
  const roleOk =
    !shiftJobRole || wRoles.length === 0 || wRoles.includes(shiftJobRole);
  const skillOk =
    !shiftMinSkill || (workerLevel != null
      && SKILL_LEVEL_ORDER[workerLevel] >= SKILL_LEVEL_ORDER[shiftMinSkill]);
  const missingCerts = reqs.filter((r) => !wCerts.includes(r));

  const allOk = roleOk && skillOk && missingCerts.length === 0;
  const totalReqs = (shiftJobRole ? 1 : 0) + (shiftMinSkill ? 1 : 0) + reqs.length;
  const okCount =
    (shiftJobRole && roleOk ? 1 : 0)
    + (shiftMinSkill && skillOk ? 1 : 0)
    + (reqs.length - missingCerts.length);

  if (allOk) {
    return (
      <Pill bg={colors.successSoft} fg={colors.success}>
        ✅ 매칭 충족 ({okCount}/{totalReqs})
      </Pill>
    );
  }

  const issues: string[] = [];
  if (!roleOk && shiftJobRole) {
    issues.push(`${JOB_ROLE_LABEL[shiftJobRole].label} 미신고`);
  }
  if (!skillOk && shiftMinSkill) {
    if (workerLevel) {
      issues.push(
        `${SKILL_LEVEL_LABEL[workerLevel].short} (요구 ${SKILL_LEVEL_LABEL[shiftMinSkill].short})`,
      );
    } else {
      issues.push(`등급 미신고 (요구 ${SKILL_LEVEL_LABEL[shiftMinSkill].short})`);
    }
  }
  for (const r of missingCerts) {
    const meta = REQUIREMENT_LABEL[r];
    if (meta) issues.push(`${meta.label} 미보유`);
  }

  // 등급/직무 미달은 critical, 자격만 미달은 warning
  const critical = !roleOk || !skillOk;
  return (
    <Pill
      bg={critical ? colors.dangerSoft : colors.warnSoft}
      fg={critical ? colors.danger : colors.warn}
    >
      ⚠️ {issues.join(' · ')} ({okCount}/{totalReqs})
    </Pill>
  );
}

function Pill({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: bg,
        marginTop: 8,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: fg }}>{children}</Text>
    </View>
  );
}
