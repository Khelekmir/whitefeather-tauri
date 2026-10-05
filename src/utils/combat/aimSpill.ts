/**
 * Skill discrepancy on aim-zone hit ratios:
 * attacker weapon skill + SKL vs defender cover-stance skill
 * tightens or loosens core vs spill (e.g. chest vs arms/shoulders).
 */

import type { BodyPartId } from '../../types/characters';
import type { AttackTargetKey } from '../../data/combat/attackTargets';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';

const S = () => COMBAT_TUNING.aimSpill;

/**
 * Intended landing mass for each aim zone.
 * Everything else in that zone's hitRatio is "spill" the defender can spoil into.
 */
export const AIM_CORE_PARTS: Record<AttackTargetKey, readonly BodyPartId[]> = {
  head: ['head', 'face', 'neck'],
  chest: ['chestLeft', 'chestRight'],
  stomach: ['stomachUpper', 'stomachLower', 'obliqueLeft', 'obliqueRight'],
  armLeft: ['shoulderLeft', 'upperArmLeft', 'lowerArmLeft', 'handLeft'],
  armRight: ['shoulderRight', 'upperArmRight', 'lowerArmRight', 'handRight'],
  groin: ['groin', 'hipLeft', 'hipRight'],
  legLeft: ['thighOuterLeft', 'thighInnerLeft', 'kneeLeft', 'lowerLegLeft'],
  legRight: ['thighOuterRight', 'thighInnerRight', 'kneeRight', 'lowerLegRight'],
};

export interface AimSpillSkillInput {
  /** Attacker weapon skill rank for the equipped type. */
  attackerWeaponSkill: number;
  /** Attacker base SKL (1–30 scale). */
  attackerSkill: number;
  /** Defender rank in the active cover stance. */
  defenderCoverSkill: number;
  /**
   * Eyes/ears × concussion focus (default 1).
   * Lowers attacker aim score → more spill.
   */
  attackerFocusMult?: number;
}

function log01(rank: number, softCap: number): number {
  return Math.min(
    1,
    Math.log10(Math.max(1, rank) + 1) / Math.log10(softCap + 1)
  );
}

/** Attacker score 0–1 from weapon proficiency + SKL (+ optional sensory focus). */
export function attackerAimScore(input: {
  weaponSkill: number;
  skill: number;
  focusMult?: number;
}): number {
  const w = log01(input.weaponSkill, S().weaponSkillSoftCap);
  const skl = Math.max(1, Math.min(30, input.skill));
  const skl01 = (skl - 1) / 29;
  const sw = S().sklWeight;
  const focus = Math.max(0.15, Math.min(1.25, input.focusMult ?? 1));
  return roundToThousandths(((1 - sw) * w + sw * skl01) * focus);
}

/** Defender score 0–1 from cover stance rank. */
export function defenderAimSpoilScore(coverSkill: number): number {
  return roundToThousandths(log01(coverSkill, S().coverSkillSoftCap));
}

/**
 * Positive delta → attacker wins → less spill.
 * Negative → defender spoils → more spill.
 */
export function aimSpillDelta(skills: AimSpillSkillInput): number {
  return roundToThousandths(
    attackerAimScore({
      weaponSkill: skills.attackerWeaponSkill,
      skill: skills.attackerSkill,
      focusMult: skills.attackerFocusMult,
    }) - defenderAimSpoilScore(skills.defenderCoverSkill)
  );
}

function sumWeights(
  map: Partial<Record<BodyPartId, number>>,
  parts?: ReadonlySet<BodyPartId>
): number {
  let s = 0;
  for (const [part, w] of Object.entries(map) as [BodyPartId, number][]) {
    if (parts && !parts.has(part)) continue;
    s += w ?? 0;
  }
  return s;
}

/**
 * Rebalance core vs spill mass, then renormalize.
 * No-ops when the aim table has no spill (or no core).
 */
export function applySkillAimSpill(
  ratios: Partial<Record<BodyPartId, number>>,
  aim: AttackTargetKey,
  skills: AimSpillSkillInput
): Partial<Record<BodyPartId, number>> {
  const coreList = AIM_CORE_PARTS[aim];
  if (!coreList || coreList.length === 0) return ratios;

  const coreSet = new Set<BodyPartId>(coreList);
  const coreSum = sumWeights(ratios, coreSet);
  let spillSum = 0;
  for (const [part, w] of Object.entries(ratios) as [BodyPartId, number][]) {
    if (!coreSet.has(part)) spillSum += w ?? 0;
  }
  const total = coreSum + spillSum;
  if (total <= 1e-9 || spillSum <= 1e-9 || coreSum <= 1e-9) {
    return ratios;
  }

  const baseSpillShare = spillSum / total;
  const delta = aimSpillDelta(skills);
  // Attacker ahead (delta > 0) → shrink spill; defender ahead → grow spill.
  let spillShare =
    baseSpillShare * (1 - delta * S().spillShiftPerDelta);
  const relMin = baseSpillShare * S().spillShareMinMult;
  const relMax = baseSpillShare * S().spillShareMaxMult;
  spillShare = Math.max(relMin, Math.min(relMax, spillShare));
  spillShare = Math.max(
    S().spillShareAbsMin,
    Math.min(S().spillShareAbsMax, spillShare)
  );
  const coreShare = 1 - spillShare;

  const out: Partial<Record<BodyPartId, number>> = {};
  for (const [part, w] of Object.entries(ratios) as [BodyPartId, number][]) {
    if (w <= 0) continue;
    if (coreSet.has(part)) {
      out[part] = (w / coreSum) * coreShare;
    } else {
      out[part] = (w / spillSum) * spillShare;
    }
  }
  return out;
}

export function formatAimSpillPreview(skills: AimSpillSkillInput): string {
  const atk = attackerAimScore({
    weaponSkill: skills.attackerWeaponSkill,
    skill: skills.attackerSkill,
    focusMult: skills.attackerFocusMult,
  });
  const def = defenderAimSpoilScore(skills.defenderCoverSkill);
  const delta = atk - def;
  const lean =
    delta > 0.08
      ? 'attacker tightens line'
      : delta < -0.08
        ? 'defender spoils line'
        : 'even aim contest';
  return `Aim spill ${lean} (atk ${atk.toFixed(2)} vs def ${def.toFixed(2)})`;
}
