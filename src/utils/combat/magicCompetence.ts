/**
 * Magical cast competence — spell practice + school floor (no offensive stances).
 * SPD is intentionally unused: mages use speed for defense / movement, not cast rhythm.
 */

import {
  getSpellDef,
  type MagicSchoolId,
  type SpellId,
} from '../../data/combat/spellCatalog';
import type {
  SpellSkill,
  Unit as DetailedUnit,
  WeaponSkill,
} from '../../types/characters';
import { COMBAT_TUNING } from './combatTuning';
import { stanceRankFactor } from './calcStanceMatchup';
import { roundToThousandths } from './penalties';
import { statFactor } from './rhythmCompetence';
import { calcSensoryPerformance } from './sensoryPerformance';

const C = COMBAT_TUNING.magicCompetence;
const Q = COMBAT_TUNING.magicDirectionalQte;

export interface MagicDirectionalWindowBase {
  durationMs: number;
  successWindowMs: number;
  startScale: number;
  endScale: number;
}

export interface MagicCompetenceBreakdown {
  spellId: SpellId;
  school: MagicSchoolId;
  spellSpecific: number;
  schoolEff: number;
  /** max(spellSpecific, schoolEff × schoolFloor) */
  spellEff: number;
  baseSkillFactor: number;
  /** 0..1-ish from LCK — widens crit fraction of the hit window. */
  luckFactor: number;
  competence: number;
  rawCompetence: number;
  sensorySkillMult: number;
  sensoryAccuracyMult: number;
}

function spellRank(skills: SpellSkill, spellId: SpellId): number {
  return skills[spellId] ?? 1;
}

function schoolRank(skills: WeaponSkill, school: MagicSchoolId): number {
  return (skills as Record<string, number>)[school] ?? 1;
}

/**
 * Hierarchical spell competence: specific spell rank with school transfer floor.
 * Nosferatu with high dark / low nosferatu still gets a school floor;
 * Flux with high flux stays specific-led.
 */
export function calcSpellEff(
  spellSkill: SpellSkill,
  weaponSkill: WeaponSkill,
  spellId: SpellId
): Pick<
  MagicCompetenceBreakdown,
  'spellId' | 'school' | 'spellSpecific' | 'schoolEff' | 'spellEff'
> {
  const def = getSpellDef(spellId);
  if (!def) {
    throw new Error(`Unknown spell id: ${spellId}`);
  }
  const spellSpecific = stanceRankFactor(spellRank(spellSkill, spellId));
  const schoolEff = stanceRankFactor(schoolRank(weaponSkill, def.school));
  const spellEff = Math.max(spellSpecific, schoolEff * C.schoolFloor);
  return {
    spellId,
    school: def.school,
    spellSpecific: roundToThousandths(spellSpecific),
    schoolEff: roundToThousandths(schoolEff),
    spellEff: roundToThousandths(spellEff),
  };
}

/**
 * Attacker magic competence for casting `spellId`.
 * No strike stance blend; no SPD term.
 */
export function calcMagicCompetence(
  caster: DetailedUnit,
  spellId: SpellId
): MagicCompetenceBreakdown {
  const spellPart = calcSpellEff(
    caster.combatStats.spellSkill,
    caster.combatStats.weaponSkill,
    spellId
  );
  const base = caster.combatStats.base;
  const baseSkillFactor = statFactor(base.skill, 12);
  const luckFactor = statFactor(base.luck, 14);

  const blended =
    C.spellWeight * spellPart.spellEff + C.baseSkillWeight * baseSkillFactor;
  const sensory = calcSensoryPerformance(caster.combatStats.itemizedHealth);
  const rawCompetence = roundToThousandths(
    Math.max(0, blended * sensory.focusMult)
  );
  const competence = roundToThousandths(Math.min(1.25, rawCompetence));

  return {
    ...spellPart,
    baseSkillFactor,
    luckFactor,
    competence,
    rawCompetence,
    sensorySkillMult: sensory.skillMult,
    sensoryAccuracyMult: sensory.accuracyMult,
  };
}

export interface ScaledMagicDirectionalWindow extends MagicDirectionalWindowBase {
  /** Crit half-width as a fraction of hit half-width (≤ 1). */
  critFraction: number;
  competence: number;
  luckFactor: number;
}

export function defaultMagicWindowBase(): MagicDirectionalWindowBase {
  return {
    durationMs: Q.durationMs,
    successWindowMs: Q.successWindowMs,
    startScale: Q.startScale,
    endScale: Q.endScale,
  };
}

/**
 * Scale magic QTE hit window from competence; crit = % of hit window × luck.
 * Collapse duration uses untrained haste only — SPD does not ease cast rhythm.
 */
export function scaleMagicDirectionalWindow(
  competence: MagicCompetenceBreakdown,
  base: MagicDirectionalWindowBase = defaultMagicWindowBase()
): ScaledMagicDirectionalWindow {
  const comp = Math.max(0, Math.min(1.25, competence.competence));
  const luckFactor = Math.max(0, Math.min(1.15, competence.luckFactor));

  const bandScale = C.bandFloor + (1 - C.bandFloor) * Math.min(1, comp);
  const untrainedHaste = 1 + (1 - Math.min(1, comp)) * C.untrainedHaste;
  const durationMs = Math.max(
    C.minDurationMs,
    Math.round(base.durationMs / untrainedHaste)
  );
  const successWindowMs = Math.max(
    C.minSuccessWindowMs,
    Math.round(base.successWindowMs * bandScale)
  );

  const luckCrit = 1 + luckFactor * C.luckCritBonus;
  const critFraction = Math.min(1, C.baseCritFraction * luckCrit);

  return {
    durationMs,
    successWindowMs,
    startScale: base.startScale,
    endScale: base.endScale,
    critFraction,
    competence: comp,
    luckFactor,
  };
}

/** Multiplicative crit stack: critPowerMult ^ critBeatCount (1 if none). */
export function magicCritPowerMultiplier(critBeatCount: number): number {
  const n = Math.max(0, Math.floor(critBeatCount));
  if (n === 0) return 1;
  return Math.pow(C.critPowerMult, n);
}

/**
 * Final cast power before ink:
 * (timedHits / beatCount) * critPowerMult ^ critCount
 * Mistimed / wrong / timeout beats reduce base; they do not void the cast.
 */
export function magicSequencePowerMultiplier(
  timedHitCount: number,
  beatCount: number,
  critBeatCount: number
): number {
  const n = Math.max(0, beatCount);
  if (n === 0) return 0;
  const base = Math.max(0, Math.min(1, timedHitCount / n));
  return base * magicCritPowerMultiplier(critBeatCount);
}

export interface WildMagicBacklash {
  triggered: boolean;
  /** early/late with correct direction */
  mistimedCount: number;
  /** timeouts — excluded from mistime ratio */
  skippedCount: number;
  wrongDirectionCount: number;
  /** mistimed / (beats − skipped); 0 if no non-skipped beats */
  mistimeRatio: number;
  /**
   * Stub caster-damage magnitude in “full spell power” units:
   * (1 / beatCount) * (1 + wrongDirectionCount).
   * Real MAG damage apply is not implemented yet.
   */
  backlashPower01: number;
}

/**
 * Wild magic when mistimes exceed half of non-skipped beats.
 * Punishes under-skilled casters on advanced formulas.
 */
export function calcWildMagicBacklash(input: {
  beatCount: number;
  mistimedCount: number;
  skippedCount: number;
  wrongDirectionCount: number;
  threshold?: number;
}): WildMagicBacklash {
  const beatCount = Math.max(0, input.beatCount);
  const mistimedCount = Math.max(0, input.mistimedCount);
  const skippedCount = Math.max(0, Math.min(beatCount, input.skippedCount));
  const wrongDirectionCount = Math.max(0, input.wrongDirectionCount);
  const nonSkipped = beatCount - skippedCount;
  const mistimeRatio = nonSkipped > 0 ? mistimedCount / nonSkipped : 0;
  const threshold = input.threshold ?? C.wildMistimeThreshold;
  const triggered = nonSkipped > 0 && mistimeRatio > threshold;
  const backlashPower01 = triggered
    ? (1 / Math.max(1, beatCount)) * (1 + wrongDirectionCount)
    : 0;
  return {
    triggered,
    mistimedCount,
    skippedCount,
    wrongDirectionCount,
    mistimeRatio,
    backlashPower01,
  };
}
