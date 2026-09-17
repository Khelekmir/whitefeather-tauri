import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { EQUIPMENT_SLOTS } from '../../types/items';
import { calcBloodCombatPenalties, getBloodStatus } from './bloodVolume';
import {
  evaluateStanceMatchupFromSkills,
  type StanceMatchupResult,
} from './calcStanceMatchup';
import {
  calcHealthPenalty,
  calcStaminaPenalty,
  calcWeightPenalty,
  roundToThousandths,
} from './penalties';
import { calcItemWeight } from '../items/resolveItem';
import { calcBlockStats } from './calcBlockStats';
import { calcTraumaPenalties } from './traumaFlags';
import { COMBAT_TUNING } from './combatTuning';

function safeLogRatio(stat: number, base: number): number {
  const s = Math.max(1, stat);
  return Math.log(s) / Math.log(base);
}

function sumGearChance(
  unit: DetailedUnit,
  itemsById: Record<string, Item>,
  key: 'dodge' | 'parry'
): number {
  let sum = 0;
  for (const slot of EQUIPMENT_SLOTS) {
    const id = unit.equipment[slot];
    if (!id) continue;
    const item = itemsById[id];
    if (!item) continue;
    sum += item.combatStats?.chance?.[key] ?? 0;
  }
  return sum;
}

export interface DefenseChanceBreakdown {
  baseDodge: number;
  baseParry: number;
  healthPenaltyDodge: number;
  healthPenaltyParry: number;
  staminaPenalty: number;
  weightPenaltyDodge: number;
  weightPenaltyParry: number;
  gripMult: number;
  gearDodge: number;
  gearParry: number;
  bloodDodge: number;
  avoidanceDelta: number;
  parryWindowFactor: number;
  /** coverLow → dodge bias; else 1 */
  coverDodgeMult: number;
  /** coverHigh → parry bias; else 1 */
  coverParryMult: number;
}

export interface DefenseChances {
  dodge: number;
  parry: number;
  /** Shield block chance (0 if no shield). */
  block: number;
  /** Shield absorb value (atk − blockValue on success). */
  blockValue: number;
  breakdown: DefenseChanceBreakdown;
  matchup: StanceMatchupResult | null;
}

export interface DefenseChanceInput {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
  /** Attacker weapon type + strike vs this unit's cover (stance fold-in). */
  attackerWeaponType?: string;
  attackerStrike?: DetailedUnit['combatStats']['currentStance']['strike'];
  attackerStanceSkill?: DetailedUnit['combatStats']['stanceSkill'];
}

/**
 * Port of utils_old DefenseTotals getDodgeChance / getParryChance,
 * plus reboot stance avoidance / parry window and blood dodge factor.
 */
export function calcDefenseChances(input: DefenseChanceInput): DefenseChances {
  const { unit, itemsById } = input;
  const base = unit.combatStats.base;
  const itemized = unit.combatStats.itemizedHealth;

  const mainId = unit.equipment.mainhand;
  const offId = unit.equipment.offhand;
  const mainhand = mainId ? itemsById[mainId] ?? null : null;
  const offhand = offId ? itemsById[offId] ?? null : null;
  const mainTemplate = mainhand ? getItemTemplate(mainhand.templateId) : null;
  const offTemplate = offhand ? getItemTemplate(offhand.templateId) : null;

  const mainWeight =
    mainhand && mainTemplate ? calcItemWeight(mainTemplate) : 0;
  const offWeight =
    offhand && offTemplate ? calcItemWeight(offTemplate) : 0;
  const offhandOccupied = !!offhand;

  const unequipped =
    !mainhand ||
    mainhand.material === 'body' ||
    mainhand.material === 'unequipped' ||
    mainhand.itemType !== 'weapon';

  const healthPenaltyDodge = calcHealthPenalty(itemized, 'dodgeChance');
  const healthPenaltyParry = calcHealthPenalty(itemized, 'parryChance');
  const staminaPenalty = calcStaminaPenalty(base.staminaCap, base.staminaCurrent);
  const weightPenaltyDodge = calcWeightPenalty(
    base.constitution,
    mainWeight + offWeight
  );
  const weightPenaltyParry = calcWeightPenalty(base.constitution, mainWeight);

  // --- Dodge base (old) ---
  const baseDodge = roundToThousandths(
    safeLogRatio(base.agility, 50) * safeLogRatio(base.reflex, 50) +
      (base.speed - base.constitution) / 100 +
      base.luck / 200
  );

  let dodge = baseDodge * healthPenaltyDodge * staminaPenalty * weightPenaltyDodge;
  const gearDodge = sumGearChance(unit, itemsById, 'dodge');
  dodge += gearDodge;

  const blood = getBloodStatus(unit);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
  const bloodDodge = bloodPen.dodge;
  dodge *= bloodDodge;

  // --- Parry base (old) ---
  let baseParry = 0;
  let gripMult = 1;
  if (!unequipped && mainhand) {
    const weaponType =
      mainhand.weaponType ?? mainTemplate?.weaponType ?? 'unequipped';
    const wSkill = unit.combatStats.weaponSkill[weaponType] ?? 1;
    baseParry = roundToThousandths(
      safeLogRatio(base.skill, 500) * safeLogRatio(wSkill, 500)
    );
    const twoHanding =
      !!mainTemplate?.flags?.twoHandOptional && !offhandOccupied;
    if (twoHanding) gripMult = 1.5;
    else if (offhandOccupied) gripMult = 1.25;
    else gripMult = 1;
  }

  let parry =
    baseParry * weightPenaltyParry * healthPenaltyParry * staminaPenalty * gripMult;
  const gearParry = sumGearChance(unit, itemsById, 'parry');
  parry += gearParry;

  // --- Stance fold-in ---
  let matchup: StanceMatchupResult | null = null;
  let avoidanceDelta = 0;
  let parryWindowFactor = 1;
  if (
    input.attackerWeaponType &&
    input.attackerStrike &&
    input.attackerStanceSkill
  ) {
    matchup = evaluateStanceMatchupFromSkills(
      input.attackerStrike,
      unit.combatStats.currentStance.cover,
      input.attackerStanceSkill,
      unit.combatStats.stanceSkill,
      input.attackerWeaponType
    );
    avoidanceDelta = matchup.avoidanceDelta;
    parryWindowFactor = matchup.parryWindowFactor;
    dodge += avoidanceDelta;
    parry *= parryWindowFactor;
  }

  // Inherent cover bias: high → parry, low → dodge.
  const cover = unit.combatStats.currentStance.cover;
  const coverDodgeMult =
    cover === 'coverLow' ? COMBAT_TUNING.stance.coverLowDodgeMult : 1;
  const coverParryMult =
    cover === 'coverHigh' ? COMBAT_TUNING.stance.coverHighParryMult : 1;
  dodge *= coverDodgeMult;
  parry *= coverParryMult;

  dodge = roundToThousandths(Math.max(0, Math.min(0.95, dodge)));
  parry = unequipped
    ? 0
    : roundToThousandths(Math.max(0, Math.min(0.95, parry)));

  const trauma = calcTraumaPenalties(itemized);
  dodge = roundToThousandths(
    Math.max(
      0,
      Math.min(0.95, dodge * trauma.dodgeMult * trauma.globalCombatMult)
    )
  );
  if (!unequipped) {
    parry = roundToThousandths(
      Math.max(
        0,
        Math.min(0.95, parry * trauma.parryMult * trauma.globalCombatMult)
      )
    );
  }

  // Block stats already include arm/chest trauma mults.
  const blockStats = calcBlockStats(unit, itemsById);

  return {
    dodge,
    parry,
    block: blockStats.chance,
    blockValue: blockStats.value,
    matchup,
    breakdown: {
      baseDodge,
      baseParry,
      healthPenaltyDodge: roundToThousandths(healthPenaltyDodge),
      healthPenaltyParry: roundToThousandths(healthPenaltyParry),
      staminaPenalty: roundToThousandths(staminaPenalty),
      weightPenaltyDodge: roundToThousandths(weightPenaltyDodge),
      weightPenaltyParry: roundToThousandths(weightPenaltyParry),
      gripMult,
      gearDodge: roundToThousandths(gearDodge),
      gearParry: roundToThousandths(gearParry),
      bloodDodge: roundToThousandths(bloodDodge),
      avoidanceDelta: roundToThousandths(avoidanceDelta),
      parryWindowFactor: roundToThousandths(parryWindowFactor),
      coverDodgeMult,
      coverParryMult,
    },
  };
}

/** Convenience: defense chances for a defender facing a specific attacker. */
export function calcDefenseChancesVsAttacker(
  defender: { unit: DetailedUnit; itemsById: Record<string, Item> },
  attacker: { unit: DetailedUnit; itemsById: Record<string, Item> }
): DefenseChances {
  const mainId = attacker.unit.equipment.mainhand;
  const mainhand = mainId ? attacker.itemsById[mainId] ?? null : null;
  const weaponType =
    mainhand?.weaponType ??
    (mainhand ? getItemTemplate(mainhand.templateId)?.weaponType : undefined) ??
    'unequipped';
  return calcDefenseChances({
    unit: defender.unit,
    itemsById: defender.itemsById,
    attackerWeaponType: weaponType,
    attackerStrike: attacker.unit.combatStats.currentStance.strike,
    attackerStanceSkill: attacker.unit.combatStats.stanceSkill,
  });
}
