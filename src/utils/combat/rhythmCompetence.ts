import { getWeaponsInFamily } from '../../data/combat/weaponFamilies';
import {
  STRIKE_STANCES,
  WEAPON_TYPES,
  type StanceSkill,
  type StrikeStanceId,
  type Unit as DetailedUnit,
  type WeaponSkill,
  type WeaponTypeId,
} from '../../types/characters';
import { stanceRankFactor } from './calcStanceMatchup';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';

const C = COMBAT_TUNING.rhythm.competence;

export interface RhythmCompetenceBreakdown {
  weaponType: string;
  strike: StrikeStanceId;
  /** f(specific weapon rank) */
  weaponSpecific: number;
  /** avg f(family weapon ranks) */
  weaponFamily: number;
  /** avg f(top general melee ranks) */
  weaponGeneral: number;
  /** specific with family/general transfer floors */
  weaponEff: number;
  strikeSpecific: number;
  strikeFamily: number;
  strikeEff: number;
  /** small hand-eye from base skill */
  baseSkillFactor: number;
  /** 0..1-ish from SPD — eases collapse when high */
  speedFactor: number;
  /** 0..1-ish from LCK — widens crit band when high */
  luckFactor: number;
  /**
   * Final attacker competence for this swing (≈0..1+).
   * Drives QTE hit/crit bands and untrained collapse haste.
   */
  competence: number;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function weaponRank(skills: WeaponSkill, type: string): number {
  return (skills as Record<string, number>)[type] ?? 1;
}

/**
 * Hierarchical weapon competence:
 * specific rank, with floors from family avg and general melee avg.
 */
export function calcWeaponEff(
  skills: WeaponSkill,
  weaponType: string
): Pick<
  RhythmCompetenceBreakdown,
  'weaponSpecific' | 'weaponFamily' | 'weaponGeneral' | 'weaponEff'
> {
  const specific = stanceRankFactor(weaponRank(skills, weaponType));
  const familyTypes = getWeaponsInFamily(weaponType);
  const family = avg(familyTypes.map((t) => stanceRankFactor(weaponRank(skills, t))));

  const allFactors = WEAPON_TYPES.map((t: WeaponTypeId) => ({
    t,
    f: stanceRankFactor(weaponRank(skills, t)),
    rank: weaponRank(skills, t),
  })).sort((a, b) => b.rank - a.rank);
  const top = allFactors.slice(0, C.generalTopN);
  const general = avg(top.map((x) => x.f));

  const transferFloor = Math.max(
    family * C.weaponFamilyFloor,
    general * C.weaponGeneralFloor
  );
  const weaponEff = Math.max(specific, transferFloor);

  return {
    weaponSpecific: roundToThousandths(specific),
    weaponFamily: roundToThousandths(family),
    weaponGeneral: roundToThousandths(general),
    weaponEff: roundToThousandths(weaponEff),
  };
}

/**
 * Hierarchical strike competence for the chosen strike line.
 */
export function calcStrikeEff(
  stanceSkill: StanceSkill,
  strike: StrikeStanceId
): Pick<
  RhythmCompetenceBreakdown,
  'strikeSpecific' | 'strikeFamily' | 'strikeEff'
> {
  const specific = stanceRankFactor(stanceSkill[strike] ?? 1);
  const family = avg(
    STRIKE_STANCES.map((id) => stanceRankFactor(stanceSkill[id] ?? 1))
  );
  const floorMult =
    strike === 'strikeMid' ? C.strikeFamilyFloorMid : C.strikeFamilyFloor;
  const strikeEff = Math.max(specific, family * floorMult);

  return {
    strikeSpecific: roundToThousandths(specific),
    strikeFamily: roundToThousandths(family),
    strikeEff: roundToThousandths(strikeEff),
  };
}

/** Map a raw base stat (typical ~1–40) onto a soft 0..1 curve. */
export function statFactor(stat: number, pivot = 12): number {
  const s = Math.max(1, stat);
  // log-ish: pivot → ~0.5, 30 → ~0.75, 5 → ~0.3
  return roundToThousandths(Math.min(1.15, Math.log10(s + 1) / Math.log10(pivot + 1)));
}

/**
 * Attacker rhythm competence for the equipped weapon + current strike stance.
 * Weapon skill is the primary landing axis; strike is the trained angle;
 * base skill / speed / luck are light modifiers (luck → crit later).
 */
export function calcRhythmCompetence(
  attacker: DetailedUnit,
  weaponType: string,
  strike: StrikeStanceId = attacker.combatStats.currentStance.strike
): RhythmCompetenceBreakdown {
  const weapon = calcWeaponEff(attacker.combatStats.weaponSkill, weaponType);
  const strikePart = calcStrikeEff(attacker.combatStats.stanceSkill, strike);
  const base = attacker.combatStats.base;
  const baseSkillFactor = statFactor(base.skill, 12);
  const speedFactor = statFactor(base.speed, 14);
  const luckFactor = statFactor(base.luck, 14);

  const blended =
    C.weaponWeight * weapon.weaponEff + C.strikeWeight * strikePart.strikeEff;
  // Small hand-eye bump from base skill (does not replace weapon training)
  const withSkill = blended + C.baseSkillWeight * baseSkillFactor;
  const competence = roundToThousandths(
    Math.max(0, Math.min(1.25, withSkill))
  );

  return {
    weaponType,
    strike,
    ...weapon,
    ...strikePart,
    baseSkillFactor,
    speedFactor,
    luckFactor,
    competence,
  };
}
