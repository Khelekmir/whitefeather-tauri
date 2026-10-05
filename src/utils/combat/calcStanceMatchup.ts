import {
  ATTACK_TARGETS,
  type AttackTargetKey,
} from '../../data/combat/attackTargets';
import {
  BODY_PART_REGION,
  COVER_REGION_WEIGHTS,
  STRIKE_LINE,
  getWeaponStanceProfile,
  stanceRelation,
  type StanceRelation,
} from '../../data/combat/stances';
import type {
  BodyPartId,
  CoverStanceId,
  StanceSkill,
  StrikeStanceId,
} from '../../types/characters';
import { COMBAT_TUNING } from './combatTuning';
import {
  applySkillAimSpill,
  type AimSpillSkillInput,
} from './aimSpill';
import { roundToThousandths } from './penalties';

const T = COMBAT_TUNING.stance;

export interface StanceMatchupInput {
  strike: StrikeStanceId;
  cover: CoverStanceId;
  strikeRank: number;
  coverRank: number;
  weaponType: string;
}

export interface StanceMatchupResult {
  strike: StrikeStanceId;
  cover: CoverStanceId;
  relation: StanceRelation;
  strikeRank: number;
  coverRank: number;
  strikeFactor: number;
  coverFactor: number;
  weaponPreferredStrike: StrikeStanceId;
  weaponAffinity: number;
  weaponOnPreferredLine: boolean;
  ranged: boolean;
  /** clamp(coverFactor − strikeFactor × affinity) on same/adjacent; 0 on opposite. */
  netGuard: number;
  /**
   * Multiplier on the old attack-window width.
   * Preview only while Battleground assumes 100% hit.
   */
  windowFactor: number;
  /** Preview-only; not rolled while 100% hit. */
  avoidanceDelta: number;
  /**
   * Multiplier on the defender's narrow parry QTE band.
   * Low strikes use a smaller factor → harder to parry.
   * Preview until defense QTE is wired.
   */
  parryWindowFactor: number;
}

/** Same log-curve as old weapon-skill hit term: rank 1 → 0, 1000 → 1. */
export function stanceRankFactor(rank: number): number {
  const r = Math.max(1, rank);
  return (Math.log(r) / Math.log(1000)) ** 1.5;
}

function lineAffinity(
  preferred: StrikeStanceId,
  used: StrikeStanceId
): number {
  const a = STRIKE_LINE[preferred];
  const b = STRIKE_LINE[used];
  if (a === b) return T.onLineAffinity;
  if (a === 'mid' || b === 'mid') return T.adjacentLineAffinity;
  return T.oppositeLineAffinity;
}

export function evaluateStanceMatchup(
  input: StanceMatchupInput
): StanceMatchupResult {
  const profile = getWeaponStanceProfile(input.weaponType);
  const relation = stanceRelation(input.strike, input.cover);
  const strikeFactor = stanceRankFactor(input.strikeRank);
  const coverFactor = stanceRankFactor(input.coverRank);
  const weaponAffinity = lineAffinity(profile.preferredStrike, input.strike);
  const breakthrough = strikeFactor * weaponAffinity;
  const strikeLine = STRIKE_LINE[input.strike];
  const parryWindowFactor = T.parryWindowByStrikeLine[strikeLine];
  const parryGuardScale = T.parryGuardByStrikeLine[strikeLine];

  let netGuard = 0;
  let windowFactor = 1;
  let avoidanceDelta = 0;

  if (relation === 'same') {
    netGuard =
      Math.max(0, Math.min(1, coverFactor - breakthrough)) * parryGuardScale;
    const penaltyScale = profile.ranged ? T.rangedSamePenaltyScale : 1;
    windowFactor = 1 - T.sameWindowPenalty * netGuard * penaltyScale;
    avoidanceDelta = T.sameAvoidanceAdd * netGuard * penaltyScale;
  } else if (relation === 'adjacent') {
    netGuard =
      Math.max(0, Math.min(1, coverFactor - breakthrough)) *
      T.adjacentNetScale *
      parryGuardScale;
    windowFactor = 1 - T.adjacentWindowPenalty * netGuard;
    avoidanceDelta = T.adjacentAvoidanceAdd * netGuard;
  } else {
    const bonusScale = profile.ranged ? T.rangedOppositeBonusScale : 1;
    windowFactor = 1 + T.oppositeWindowBonus * bonusScale;
    avoidanceDelta = T.oppositeAvoidanceAdd * bonusScale;
    // Opposite line: little to no parry geometry — keep window tiny
    // (dodge is the better verb; parryWindowFactor still applies if they try)
  }

  return {
    strike: input.strike,
    cover: input.cover,
    relation,
    strikeRank: input.strikeRank,
    coverRank: input.coverRank,
    strikeFactor: roundToThousandths(strikeFactor),
    coverFactor: roundToThousandths(coverFactor),
    weaponPreferredStrike: profile.preferredStrike,
    weaponAffinity: roundToThousandths(weaponAffinity),
    weaponOnPreferredLine: weaponAffinity >= T.onLineAffinity,
    ranged: profile.ranged,
    netGuard: roundToThousandths(netGuard),
    windowFactor: roundToThousandths(windowFactor),
    avoidanceDelta: roundToThousandths(avoidanceDelta),
    parryWindowFactor: roundToThousandths(parryWindowFactor),
  };
}

export function evaluateStanceMatchupFromSkills(
  strike: StrikeStanceId,
  cover: CoverStanceId,
  attackerSkills: StanceSkill,
  defenderSkills: StanceSkill,
  weaponType: string
): StanceMatchupResult {
  return evaluateStanceMatchup({
    strike,
    cover,
    strikeRank: attackerSkills[strike] ?? 1,
    coverRank: defenderSkills[cover] ?? 1,
    weaponType,
  });
}

/** Cover-remap an arbitrary hit-ratio map, then renormalize. */
export function remapHitRatioMap(
  base: Partial<Record<BodyPartId, number>>,
  cover: CoverStanceId
): Partial<Record<BodyPartId, number>> {
  const weights = COVER_REGION_WEIGHTS[cover];
  const scaled: Partial<Record<BodyPartId, number>> = {};
  let sum = 0;
  for (const [part, ratio] of Object.entries(base) as [BodyPartId, number][]) {
    const region = BODY_PART_REGION[part] ?? 'mid';
    const next = (ratio ?? 0) * (weights[region] ?? 1);
    if (next <= 0) continue;
    scaled[part] = next;
    sum += next;
  }
  if (sum <= 0) return { ...base };
  const normalized: Partial<Record<BodyPartId, number>> = {};
  for (const [part, value] of Object.entries(scaled) as [BodyPartId, number][]) {
    normalized[part] = value / sum;
  }
  return normalized;
}

/**
 * Aim-zone hitRatio:
 * 1) optional override / base table
 * 2) skill spill (weapon+SKL vs cover skill) — core vs arms/shoulders
 * 3) cover region remap
 */
export function remapAimHitRatio(
  aim: AttackTargetKey,
  cover: CoverStanceId,
  hitRatioOverride?: Partial<Record<BodyPartId, number>>,
  spillSkills?: AimSpillSkillInput | null
): Partial<Record<BodyPartId, number>> {
  let base = hitRatioOverride ?? ATTACK_TARGETS[aim]?.hitRatio ?? {};
  if (spillSkills) {
    base = applySkillAimSpill(base, aim, spillSkills);
  }
  return remapHitRatioMap(base, cover);
}

export function pickFromHitRatio(
  ratios: Partial<Record<BodyPartId, number>>,
  rng: () => number = Math.random
): BodyPartId {
  const entries = Object.entries(ratios) as [BodyPartId, number][];
  if (entries.length === 0) return 'chestLeft';
  const roll = rng();
  let cumulative = 0;
  for (const [zone, ratio] of entries) {
    cumulative += ratio;
    if (roll < cumulative) return zone;
  }
  return entries[entries.length - 1]![0];
}

export function pickBodyPartWithStance(
  aim: AttackTargetKey,
  cover: CoverStanceId,
  hitRatioOverride?: Partial<Record<BodyPartId, number>>,
  rng?: () => number,
  spillSkills?: AimSpillSkillInput | null
): BodyPartId {
  return pickFromHitRatio(
    remapAimHitRatio(aim, cover, hitRatioOverride, spillSkills),
    rng
  );
}

export function summarizeRemappedAim(
  aim: AttackTargetKey,
  cover: CoverStanceId,
  topN = 4,
  hitRatioOverride?: Partial<Record<BodyPartId, number>>,
  spillSkills?: AimSpillSkillInput | null
): { part: BodyPartId; ratio: number }[] {
  const ratios = remapAimHitRatio(aim, cover, hitRatioOverride, spillSkills);
  return (Object.entries(ratios) as [BodyPartId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([part, ratio]) => ({ part, ratio }));
}

export function formatMatchupPreview(m: StanceMatchupResult): string {
  const line =
    m.relation === 'same'
      ? 'same line (guarded)'
      : m.relation === 'adjacent'
        ? 'adjacent line'
        : 'opposite line (exposed)';
  const weaponNote = m.weaponOnPreferredLine
    ? `weapon prefers ${m.weaponPreferredStrike}`
    : `weapon prefers ${m.weaponPreferredStrike} (off-line, affinity ${m.weaponAffinity})`;
  const ranged = m.ranged ? '; ranged' : '';
  const parryNote =
    m.parryWindowFactor < 0.95
      ? `; parry window ×${m.parryWindowFactor} (harder)`
      : `; parry window ×${m.parryWindowFactor}`;
  return `${m.strike} vs ${m.cover} — ${line}; ${weaponNote}${ranged}; net guard ${m.netGuard}; attack window ×${m.windowFactor};${parryNote} (preview)`;
}
