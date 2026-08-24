import { getMaterial } from '../../data/combat/materials';
import { getWeaponTypeInfo } from '../../data/combat/weaponTypes';
import type { BaseCombatStats, ItemizedHealth, WeaponSkill } from '../../types/characters';
import type { Item } from '../../types/items';
import { calcItemWeight } from '../items/resolveItem';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import {
  calcHealthPenaltySimple,
  calcStaminaPenalty,
  calcWeightPenalty,
} from './penalties';

/** Optional blood remaining fraction (1 = full). Applied as stamina-first penalty. */
export type BloodFractionOpts = {
  bloodRemainingFraction?: number;
  bloodStaminaFactor?: number;
  bloodAttackFactor?: number;
};

const PHYSICAL_CONSTANT = 1;

export interface AttackValueResult {
  attackValue: number;
  /** Base used for weapon durability loss calcs (pre material/power/durability). */
  attackBase: number;
  weaponType: string;
  damageType: string;
  weaponWeight: number;
  weaponHardness: number;
  weaponSkill: number;
}

/**
 * Port of AttackTotals getAttackValue / getAttackBaseForDurabilityCalcs
 * for a single main-hand (or punch if empty).
 */
export function calcMainhandAttackValue(
  base: BaseCombatStats,
  itemizedHealth: ItemizedHealth,
  weaponSkill: WeaponSkill,
  mainhand: Item | null,
  offhandIsShield: boolean,
  offhandWeight: number,
  blood?: BloodFractionOpts
): AttackValueResult {
  const template = mainhand ? getItemTemplate(mainhand.templateId) : null;
  const weaponType =
    mainhand?.weaponType ??
    (mainhand?.itemType === 'weapon' ? 'dagger' : 'punch');
  const typeInfo = getWeaponTypeInfo(weaponType);
  const materialId = mainhand?.material ?? 'body';
  const material = getMaterial(materialId);

  const weight = mainhand && template
    ? Math.max(0.1, calcItemWeight(template))
    : typeInfo.sizeFactor * Math.max(0.1, material.weight);
  const skillRank =
    (weaponSkill as Record<string, number>)[weaponType] ??
    weaponSkill.unequipped ??
    1;
  const durabilityRatio = mainhand
    ? Math.max(0.05, mainhand.durability / Math.max(0.001, mainhand.maxDurability))
    : 1;

  const noOffhand = !offhandIsShield && offhandWeight <= 0;
  const twoHandOptional = !!template?.flags?.twoHandOptional;
  let twoHandedMultiplier = 1;
  if (noOffhand) {
    if (twoHandOptional) twoHandedMultiplier = 1.5;
    else if (!typeInfo.twoHanded) twoHandedMultiplier = 1.25;
  }

  const strength = Math.max(1, base.strength);
  const logStr = Math.log10(strength);
  const logW = Math.max(0, Math.log10(weight));

  const attackBase =
    (logStr * logW + logStr ** 2) * PHYSICAL_CONSTANT * twoHandedMultiplier;

  const adjusted =
    weight > strength ? attackBase * (strength / weight) : attackBase;

  const combinedWeight = weight + (offhandIsShield ? offhandWeight : 0);
  const weightPenalty = calcWeightPenalty(
    base.constitution,
    offhandIsShield ? combinedWeight : weight
  );
  const healthPenalty = calcHealthPenaltySimple(itemizedHealth);
  const staminaPenalty =
    calcStaminaPenalty(base.staminaCap, base.staminaCurrent) *
    (blood?.bloodStaminaFactor ?? 1);
  const bloodAttack = blood?.bloodAttackFactor ?? 1;

  const attackValue =
    adjusted *
    weightPenalty *
    healthPenalty *
    staminaPenalty *
    bloodAttack *
    material.strength *
    typeInfo.powerMultiplier *
    Math.sqrt(durabilityRatio);

  return {
    attackValue,
    attackBase,
    weaponType,
    damageType: typeInfo.damageType,
    weaponWeight: weight,
    weaponHardness: material.durability,
    weaponSkill: skillRank,
  };
}
