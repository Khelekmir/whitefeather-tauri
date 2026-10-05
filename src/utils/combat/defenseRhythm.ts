import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import type { AttackTargetKey } from '../../data/combat/attackTargets';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { COMBAT_TUNING } from './combatTuning';
import {
  evaluateStanceMatchupFromSkills,
  type StanceMatchupResult,
} from './calcStanceMatchup';
import type { RhythmWindow } from './attackRhythm';
import { calcBloodCombatPenalties, getBloodStatus } from './bloodVolume';
import { calcPerformanceFromItemized } from './performanceFromItemized';
import { calcRhythmCompetence } from './rhythmCompetence';
import { calcBlockStats } from './calcBlockStats';
import { roundToThousandths } from './penalties';
import {
  getWeaponTypeFeelMods,
  weaponFeelQteScale,
} from './weaponTypeFeel';

export type DefenseVerb = 'dodge' | 'parry' | 'block';

/** Mistimed dodge/parry press before a shield-block QTE opens. */
export type BlockPriorAttempt = 'none' | 'dodge' | 'parry';

const D = () => COMBAT_TUNING.defenseRhythm;
const B = () => COMBAT_TUNING.blockRhythm;

export function canParryWith(
  unit: DetailedUnit,
  itemsById: Record<string, Item>
): boolean {
  const id = unit.equipment.mainhand;
  if (!id) return false;
  const item = itemsById[id];
  if (!item || item.itemType !== 'weapon') return false;
  if (item.durability <= 0) return false;
  if (item.material === 'body' || item.material === 'unequipped') return false;
  return true;
}

/** Offhand shield with remaining durability. */
export function canBlockWith(
  unit: DetailedUnit,
  itemsById: Record<string, Item>
): boolean {
  const id = unit.equipment.offhand;
  if (!id) return false;
  const item = itemsById[id];
  return !!item && item.itemType === 'shield' && item.durability > 0;
}

export function resolveDefenderShieldTypeId(
  unit: DetailedUnit,
  itemsById: Record<string, Item>
): string | null {
  const id = unit.equipment.offhand;
  if (!id) return null;
  const item = itemsById[id];
  if (!item || item.itemType !== 'shield') return null;
  const template = getItemTemplate(item.templateId);
  return item.shieldType ?? template?.shieldType ?? 'heater';
}

/**
 * Apply situational block-chance taxes used by both the player QTE window
 * and the NPC/RNG block roll (legs aim). Prior dodge/parry attempts only
 * tax the player path (passed in when a mistimed press preceded the block).
 */
export function modifyBlockChance(
  baseChance: number,
  opts: {
    priorAttempt?: BlockPriorAttempt;
    aim?: AttackTargetKey;
    shieldTypeId?: string | null;
  } = {}
): number {
  const tun = B();
  let chance = Math.max(0, baseChance);
  const prior = opts.priorAttempt ?? 'none';
  if (prior === 'dodge') {
    chance *= tun.afterDodgeAttemptMult;
  } else if (prior === 'parry') {
    const buckler = opts.shieldTypeId === 'buckler';
    if (!buckler) chance *= tun.afterParryAttemptMult;
  }
  if (opts.aim === 'legLeft' || opts.aim === 'legRight') {
    chance *= tun.legsAimMult;
  }
  return roundToThousandths(Math.max(0, Math.min(0.95, chance)));
}

export interface ScaleDefenseRhythmInput {
  verb: 'dodge' | 'parry';
  defender: DetailedUnit;
  itemsById: Record<string, Item>;
  attacker: DetailedUnit;
  attackerItemsById: Record<string, Item>;
}

/**
 * Build a RhythmWindow for player Dodge / Parry QTE.
 */
export function scaleDefenseRhythmWindow(
  input: ScaleDefenseRhythmInput
): { window: RhythmWindow; matchup: StanceMatchupResult } {
  const { verb, defender, attacker, attackerItemsById } = input;
  const tun = D();

  const atkMainId = attacker.equipment.mainhand;
  const atkMain = atkMainId ? attackerItemsById[atkMainId] : null;
  const weaponType =
    atkMain?.weaponType ??
    (atkMain ? getItemTemplate(atkMain.templateId)?.weaponType : undefined) ??
    'unequipped';

  const strike = attacker.combatStats.currentStance.strike;
  const matchup = evaluateStanceMatchupFromSkills(
    strike,
    defender.combatStats.currentStance.cover,
    attacker.combatStats.stanceSkill,
    defender.combatStats.stanceSkill,
    weaponType
  );

  const atkComp = calcRhythmCompetence(attacker, weaponType, strike, {
    itemsById: attackerItemsById,
  });
  const competence = Math.max(0, Math.min(1.25, atkComp.competence));
  // High attacker skill → harder defense (same bandFloor shape as attack QTE, inverted).
  const competenceBandScale =
    tun.attackerCompetenceBandFloor +
    (1 - tun.attackerCompetenceBandFloor) * ((1.25 - competence) / 1.25);
  const skillHaste = 1 + competence * tun.attackerCompetenceHaste;

  let durationMs: number = Math.round(tun.durationMs / skillHaste);
  let critBand: number = tun.critBand * competenceBandScale;
  let hitBand: number = tun.hitBand * competenceBandScale;

  const cover = defender.combatStats.currentStance.cover;
  const coverParryMult =
    cover === 'coverHigh' ? COMBAT_TUNING.stance.coverHighParryMult : 1;
  const coverDodgeMult =
    cover === 'coverLow' ? COMBAT_TUNING.stance.coverLowDodgeMult : 1;

  if (verb === 'parry') {
    const pf = matchup.parryWindowFactor;
    const bandScale = 1 - (1 - pf) * tun.parryWindowInfluence;
    critBand *= bandScale;
    hitBand *= bandScale;
    // Low parry window → faster collapse
    durationMs = Math.round(durationMs * (0.75 + 0.25 * pf));
    // coverHigh: inherent parry ease (~+10% bands & duration)
    critBand *= coverParryMult;
    hitBand *= coverParryMult;
    durationMs = Math.round(durationMs * coverParryMult);
  } else {
    // Dodge: easier base
    critBand *= tun.dodgeBandEase;
    hitBand *= tun.dodgeBandEase;
    durationMs = Math.round(durationMs * tun.dodgeDurationEase);
    // coverLow: inherent dodge ease (~+10% bands & duration)
    critBand *= coverDodgeMult;
    hitBand *= coverDodgeMult;
    durationMs = Math.round(durationMs * coverDodgeMult);

    const perf = calcPerformanceFromItemized(
      defender.combatStats.itemizedHealth,
      defender.combatStats.organs
    );
    const blood = getBloodStatus(defender);
    const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
    const mobilityEffective = Math.max(
      0,
      Math.min(1, perf.dodge * bloodPen.dodge)
    );
    const mobScale =
      tun.dodgeMobilityFloor + (1 - tun.dodgeMobilityFloor) * mobilityEffective;
    critBand *= mobScale;
    hitBand *= mobScale;

    const av = matchup.avoidanceDelta;
    if (av >= 0) {
      durationMs = Math.round(durationMs * (1 + av * tun.avoidanceEase));
      const b = 1 + av * tun.avoidanceBand;
      critBand *= b;
      hitBand *= b;
    } else {
      durationMs = Math.round(
        durationMs / (1 + Math.abs(av) * tun.avoidanceHaste)
      );
      const b = 1 - Math.abs(av) * tun.avoidanceTighten;
      critBand *= Math.max(0.35, b);
      hitBand *= Math.max(0.35, b);
    }
  }

  // Attacker weapon-type feel → same flat chance adds mapped onto QTE bands.
  const weaponFeel = getWeaponTypeFeelMods(weaponType);
  const feelAdd =
    verb === 'parry' ? weaponFeel.parryChanceAdd : weaponFeel.dodgeChanceAdd;
  const feelScale = weaponFeelQteScale(feelAdd);
  critBand *= feelScale.bandMult;
  hitBand *= feelScale.bandMult;
  durationMs = Math.round(durationMs * feelScale.durationMult);

  const window: RhythmWindow = {
    durationMs: Math.max(350, durationMs),
    startScale: tun.startScale,
    endScale: tun.endScale,
    critBand: Math.max(0.015, critBand),
    hitBand: Math.max(0.04, hitBand),
    rotationDegrees: tun.rotationDegrees,
    critAttackMultiplier: 1,
    windowFactor: verb === 'parry' ? matchup.parryWindowFactor : 1,
    /** Echo: attacker competence pressuring this defense window. */
    competence,
  };

  return { window, matchup };
}

export interface ScaleBlockRhythmInput {
  defender: DetailedUnit;
  itemsById: Record<string, Item>;
  attacker: DetailedUnit;
  attackerItemsById: Record<string, Item>;
  /** Mistimed dodge/parry on the preceding defense QTE (`none` if timeout). */
  priorAttempt?: BlockPriorAttempt;
  /** Attacker aim zone — legs shrink the window. */
  aim: AttackTargetKey;
}

export interface ScaleBlockRhythmResult {
  window: RhythmWindow;
  /** Raw calcBlockStats chance before situational taxes. */
  baseChance: number;
  /** Chance after attempt/legs modifiers — drives window scale. */
  adjustedChance: number;
  blockValue: number;
  shieldTypeId: string | null;
  hasShield: boolean;
  /** Strike vs cover matchup used for block window ease. */
  matchup: StanceMatchupResult;
  /** Applied stance scale on bands (1 = neutral). */
  stanceBandMult: number;
}

/**
 * Build a RhythmWindow for the player shield-block QTE.
 * Adjusted block chance scales bands/duration; strike-vs-cover eases/tightens;
 * `blockRhythm.playerEase` is the master difficulty knob.
 * Shield size reaches the window only via block chance (no extra duration echo).
 */
export function scaleBlockRhythmWindow(
  input: ScaleBlockRhythmInput
): ScaleBlockRhythmResult {
  const {
    defender,
    itemsById,
    attacker,
    attackerItemsById,
    priorAttempt = 'none',
    aim,
  } = input;
  const tun = B();
  const stats = calcBlockStats(defender, itemsById);
  const shieldTypeId = resolveDefenderShieldTypeId(defender, itemsById);
  const adjustedChance = modifyBlockChance(stats.chance, {
    priorAttempt,
    aim,
    shieldTypeId,
  });

  const atkMainId = attacker.equipment.mainhand;
  const atkMain = atkMainId ? attackerItemsById[atkMainId] : null;
  const weaponType =
    atkMain?.weaponType ??
    (atkMain ? getItemTemplate(atkMain.templateId)?.weaponType : undefined) ??
    'unequipped';
  const strike = attacker.combatStats.currentStance.strike;
  const cover = defender.combatStats.currentStance.cover;
  const matchup = evaluateStanceMatchupFromSkills(
    strike,
    cover,
    attacker.combatStats.stanceSkill,
    defender.combatStats.stanceSkill,
    weaponType
  );

  const atkComp = calcRhythmCompetence(attacker, weaponType, strike, {
    itemsById: attackerItemsById,
  });
  const competence = Math.max(0, Math.min(1.25, atkComp.competence));
  const competenceBandScale =
    tun.attackerCompetenceBandFloor +
    (1 - tun.attackerCompetenceBandFloor) * ((1.25 - competence) / 1.25);
  const skillHaste = 1 + competence * tun.attackerCompetenceHaste;

  const chanceNorm = Math.max(
    0,
    Math.min(1, adjustedChance / Math.max(0.05, tun.chanceFullAt))
  );
  const bandFromChance =
    tun.chanceBandFloor + (1 - tun.chanceBandFloor) * chanceNorm;
  const durationFromChance =
    tun.chanceDurationFloor + (1 - tun.chanceDurationFloor) * chanceNorm;

  // Guarded attack line (windowFactor < 1) → easier block; opposite → harder.
  const stanceBandMult = Math.max(
    tun.stanceBandMultFloor,
    1 + (1 - matchup.windowFactor) * tun.stanceWindowInfluence
  );
  const stanceDurationMult = Math.max(
    tun.stanceDurationMultFloor,
    1 + (1 - matchup.windowFactor) * tun.stanceWindowInfluence
  );

  const ease = Math.max(0.35, tun.playerEase);
  const durationMs = Math.round(
    (tun.durationMs *
      durationFromChance *
      ease *
      stanceDurationMult) /
      skillHaste
  );
  const critBand =
    tun.critBand *
    bandFromChance *
    competenceBandScale *
    ease *
    stanceBandMult;
  const hitBand =
    tun.hitBand *
    bandFromChance *
    competenceBandScale *
    ease *
    stanceBandMult;

  const window: RhythmWindow = {
    durationMs: Math.max(320, durationMs),
    startScale: tun.startScale,
    endScale: tun.endScale,
    critBand: Math.max(0.012, critBand),
    hitBand: Math.max(0.035, hitBand),
    rotationDegrees: tun.rotationDegrees,
    critAttackMultiplier: 1,
    windowFactor: bandFromChance * ease * stanceBandMult,
    competence,
  };

  return {
    window,
    baseChance: stats.chance,
    adjustedChance,
    blockValue: stats.value,
    shieldTypeId,
    hasShield: stats.hasShield,
    matchup,
    stanceBandMult: roundToThousandths(stanceBandMult),
  };
}
