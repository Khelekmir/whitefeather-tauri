import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import { getMaterial } from '../../data/combat/materials';
import { getShieldTypeInfo } from '../../data/combat/shieldTypes';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { calcItemWeight } from '../items/resolveItem';
import {
  calcHealthPenalty,
  calcStaminaPenalty,
  calcWeightPenalty,
  roundToThousandths,
} from './penalties';
import { COMBAT_TUNING } from './combatTuning';
import { calcSensoryPerformance } from './sensoryPerformance';
import { calcTraumaPenalties } from './traumaFlags';

function safeLogRatio(stat: number, base: number): number {
  return Math.log(Math.max(1, stat)) / Math.log(base);
}

/** √(durability ratio) — port of CalcDurabilityPenalty for 0–1 integrity. */
export function calcDurabilityPenalty(ratio: number): number {
  return Math.sqrt(Math.max(0, Math.min(1, ratio)));
}

export interface BlockStatsBreakdown {
  baseChance: number;
  baseValue: number;
  healthPenaltyChance: number;
  healthPenaltyPower: number;
  staminaPenalty: number;
  weightPenalty: number;
  noMainhandMult: number;
  shieldBlock: number;
  characterBlock: number;
  shieldSkill: number;
}

export interface BlockStats {
  /** 0 if no usable shield. */
  chance: number;
  /** Absorb subtracted from attack value on successful block. */
  value: number;
  hasShield: boolean;
  breakdown: BlockStatsBreakdown;
}

/**
 * Port of utils_old DefenseTotals getBlockStats.
 * Requires offhand shield with durability &gt; 0.
 */
export function calcBlockStats(
  unit: DetailedUnit,
  itemsById: Record<string, Item>
): BlockStats {
  const emptyBreakdown: BlockStatsBreakdown = {
    baseChance: 0,
    baseValue: 0,
    healthPenaltyChance: 1,
    healthPenaltyPower: 1,
    staminaPenalty: 1,
    weightPenalty: 1,
    noMainhandMult: 1,
    shieldBlock: 0,
    characterBlock: 0,
    shieldSkill: 0,
  };

  const offId = unit.equipment.offhand;
  const offhand = offId ? itemsById[offId] ?? null : null;
  if (!offhand || offhand.itemType !== 'shield' || offhand.durability <= 0) {
    return {
      chance: 0,
      value: 0,
      hasShield: false,
      breakdown: emptyBreakdown,
    };
  }

  const base = unit.combatStats.base;
  const itemized = unit.combatStats.itemizedHealth;
  const template = getItemTemplate(offhand.templateId);
  const shieldTypeId = offhand.shieldType ?? template?.shieldType ?? 'heater';
  const shieldType = getShieldTypeInfo(shieldTypeId);
  const shieldMaterial = getMaterial(offhand.material);
  const durRatio = Math.max(
    0,
    offhand.durability / Math.max(0.001, offhand.maxDurability)
  );
  const durabilityPenalty = calcDurabilityPenalty(durRatio);
  const shieldWeight = Math.max(
    0.1,
    shieldType.sizeFactor * Math.max(0.1, shieldMaterial.weight)
  );

  const mainId = unit.equipment.mainhand;
  const mainhand = mainId ? itemsById[mainId] ?? null : null;
  const mainTemplate = mainhand ? getItemTemplate(mainhand.templateId) : null;
  const mainWeight =
    mainhand && mainTemplate ? calcItemWeight(mainTemplate) : 0;
  const noMainhand =
    !mainhand ||
    mainhand.material === 'body' ||
    mainhand.material === 'unequipped' ||
    mainhand.itemType !== 'weapon';

  const shieldSkill = Math.max(
    1,
    unit.combatStats.weaponSkill.shield ?? 1
  );

  const staminaPenalty = calcStaminaPenalty(
    base.staminaCap,
    base.staminaCurrent
  );
  const weightPenalty = calcWeightPenalty(
    base.constitution,
    mainWeight + shieldWeight
  );
  const healthPenaltyChance = calcHealthPenalty(itemized, 'blockChance');
  const healthPenaltyPower = calcHealthPenalty(itemized, 'blockPower');
  const noMainhandMult = noMainhand ? 1.25 : 1;

  const baseChanceRaw =
    (safeLogRatio(base.strength, 50) *
      safeLogRatio(base.reflex, 50) *
      safeLogRatio(shieldSkill, 100) +
      (base.agility - base.constitution) / 50) *
    shieldType.sizeFactor;

  const sensory = calcSensoryPerformance(itemized);
  let chance =
    baseChanceRaw *
      healthPenaltyChance *
      staminaPenalty *
      weightPenalty *
      sensory.skillMult *
      noMainhandMult +
    base.luck / 200;

  // Gear chance.block bonuses
  for (const slot of Object.keys(unit.equipment) as (keyof typeof unit.equipment)[]) {
    const id = unit.equipment[slot];
    if (!id) continue;
    const item = itemsById[id];
    chance += item?.combatStats?.chance?.block ?? 0;
  }

  const trauma = calcTraumaPenalties(itemized, unit.combatStats.organs);
  chance *= trauma.blockMult * trauma.globalCombatMult;
  chance = roundToThousandths(Math.max(0, Math.min(0.95, chance)));

  const baseValueCharacter =
    shieldWeight > base.strength
      ? Math.log10(Math.max(1, base.strength)) *
        3 *
        (base.strength / shieldWeight)
      : Math.log10(Math.max(1, base.strength)) * 3;

  const characterBlock =
    baseValueCharacter *
    healthPenaltyPower *
    staminaPenalty *
    weightPenalty *
    noMainhandMult;

  const shieldBlock =
    shieldType.blockMultiplier *
    shieldMaterial.strength *
    durabilityPenalty;

  let value = characterBlock * shieldBlock;
  for (const slot of Object.keys(unit.equipment) as (keyof typeof unit.equipment)[]) {
    const id = unit.equipment[slot];
    if (!id) continue;
    const item = itemsById[id];
    value += item?.combatStats?.value?.block ?? 0;
  }
  value *= trauma.blockMult * trauma.globalCombatMult;
  value *= COMBAT_TUNING.shieldBlock.blockValueScale;
  value = roundToThousandths(Math.max(0, value));

  return {
    chance,
    value,
    hasShield: true,
    breakdown: {
      baseChance: roundToThousandths(baseChanceRaw),
      baseValue: roundToThousandths(baseValueCharacter),
      healthPenaltyChance: roundToThousandths(healthPenaltyChance),
      healthPenaltyPower: roundToThousandths(healthPenaltyPower),
      staminaPenalty: roundToThousandths(staminaPenalty),
      weightPenalty: roundToThousandths(weightPenalty),
      noMainhandMult,
      shieldBlock: roundToThousandths(shieldBlock),
      characterBlock: roundToThousandths(characterBlock),
      shieldSkill,
    },
  };
}
