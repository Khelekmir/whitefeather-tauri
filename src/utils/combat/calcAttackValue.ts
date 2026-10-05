import { getMaterial } from '../../data/combat/materials';
import { getWeaponTypeInfo } from '../../data/combat/weaponTypes';
import type {
  BaseCombatStats,
  DominantHand,
  ItemizedHealth,
  WeaponSkill,
} from '../../types/characters';
import type { Item } from '../../types/items';
import { calcItemWeight } from '../items/resolveItem';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { COMBAT_TUNING } from './combatTuning';
import {
  calcLimbAttackMult,
  isTwoHandGrip,
  type AttackWeaponSlot,
  type LimbAttackMultResult,
} from './limbAttack';
import {
  calcHealthPenaltySimple,
  calcStaminaPenalty,
  calcWeightPenalty,
} from './penalties';
import { calcTraumaPenalties } from './traumaFlags';

/** Optional blood remaining fraction (1 = full). Applied as stamina-first penalty. */
export type BloodFractionOpts = {
  bloodRemainingFraction?: number;
  bloodStaminaFactor?: number;
  bloodAttackFactor?: number;
};

export type LimbAttackOpts = {
  dominantHand?: DominantHand;
  attackSlot?: AttackWeaponSlot;
  /** Offhand occupied by shield or weapon (blocks two-hand grip). */
  offhandOccupied?: boolean;
};

export interface AttackValueResult {
  attackValue: number;
  /** Base used for weapon durability loss calcs (pre material/power/durability). */
  attackBase: number;
  weaponType: string;
  damageType: string;
  weaponWeight: number;
  weaponHardness: number;
  weaponSkill: number;
  /** True when equipped mainhand was ignored (broken → punch fallback). */
  weaponBroken: boolean;
  /** Attack mult from durability while intact (1 if punch / broken fallback). */
  durabilityAttackMult: number;
  /** Weapon-arm integrity mult (1 if limb opts omitted). */
  limbAttackMult: number;
  limbAttack: LimbAttackMultResult | null;
}

/** durability / maxDurability for an item (0 if missing). */
export function weaponDurabilityRatio(item: Item | null | undefined): number {
  if (!item) return 1;
  const max = Math.max(0.001, item.maxDurability);
  return Math.max(0, item.durability / max);
}

export function isWeaponBroken(item: Item | null | undefined): boolean {
  if (!item || item.itemType !== 'weapon') return false;
  return weaponDurabilityRatio(item) <= COMBAT_TUNING.weaponDurabilityAttack.brokenRatio;
}

/**
 * Intact weapons: linear curve through (referenceRatio, referenceMult) → (1, 1).
 * Default: 5% durability → 80% attack; full → 100%.
 * At/below broken ratio callers should use punch fallback instead.
 */
export function weaponDurabilityAttackMult(ratio: number): number {
  const { brokenRatio, referenceRatio, referenceMult } =
    COMBAT_TUNING.weaponDurabilityAttack;
  if (ratio <= brokenRatio) return 0;
  if (ratio >= 1) return 1;
  const span = Math.max(1e-6, 1 - referenceRatio);
  const mult =
    referenceMult + ((1 - referenceMult) * (ratio - referenceRatio)) / span;
  // Above break, never go below a hair under referenceMult when extrapolating
  // slightly below the anchor (e.g. 3% wear).
  return Math.max(0, Math.min(1, mult));
}

/**
 * Port of AttackTotals getAttackValue / getAttackBaseForDurabilityCalcs
 * for a single main-hand (or punch if empty / broken).
 */
export function calcMainhandAttackValue(
  base: BaseCombatStats,
  itemizedHealth: ItemizedHealth,
  weaponSkill: WeaponSkill,
  mainhandIn: Item | null,
  offhandIsShield: boolean,
  offhandWeight: number,
  blood?: BloodFractionOpts,
  limb?: LimbAttackOpts
): AttackValueResult {
  const broken = isWeaponBroken(mainhandIn);
  // Broken blade → unequipped/punch for power (still equipped for inventory/UI).
  const mainhand = broken ? null : mainhandIn;
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

  const ratio = mainhandIn ? weaponDurabilityRatio(mainhandIn) : 1;
  const durabilityAttackMult = mainhand
    ? weaponDurabilityAttackMult(ratio)
    : 1;

  const offhandOccupied =
    limb?.offhandOccupied ?? (offhandIsShield || offhandWeight > 0);
  const noOffhand = !offhandOccupied;
  const attackSlot = limb?.attackSlot ?? 'mainhand';
  const twoHandOptional = !!template?.flags?.twoHandOptional;
  let twoHandedMultiplier = 1;
  // Empty-offhand power bonus only when swinging from mainhand (dominant).
  // Offhand-slot attacks are awkward single-hand grips, not reinforced two-hand.
  if (noOffhand && attackSlot === 'mainhand') {
    if (twoHandOptional) twoHandedMultiplier = 1.5;
    else if (!typeInfo.twoHanded) twoHandedMultiplier = 1.25;
  }

  const strength = Math.max(1, base.strength);
  const logStr = Math.log10(strength);
  const logW = Math.max(0, Math.log10(weight));

  const attackBase =
    (logStr * logW + logStr ** 2) *
    COMBAT_TUNING.physicalConstant *
    twoHandedMultiplier;

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

  const twoHandGrip =
    attackSlot === 'mainhand' && isTwoHandGrip(mainhand, offhandOccupied);
  const limbAttack = calcLimbAttackMult({
    itemized: itemizedHealth,
    dominantHand: limb?.dominantHand ?? 'right',
    attackSlot,
    twoHandGrip,
    weaponWeight: weight,
    strength: base.strength,
    constitution: base.constitution,
  });
  // If one-hand fallback engaged, drop the empty-offhand power bonus somewhat.
  const gripAfterFallback =
    limbAttack.mode === 'oneHandFallback'
      ? Math.min(twoHandedMultiplier, 1.1)
      : twoHandedMultiplier;
  const gripAdjust =
    twoHandedMultiplier > 0 ? gripAfterFallback / twoHandedMultiplier : 1;

  const trauma = calcTraumaPenalties(itemizedHealth);
  const attackValue =
    adjusted *
    gripAdjust *
    weightPenalty *
    healthPenalty *
    staminaPenalty *
    bloodAttack *
    material.strength *
    typeInfo.powerMultiplier *
    durabilityAttackMult *
    limbAttack.mult *
    trauma.attackMult *
    trauma.globalCombatMult;

  return {
    attackValue,
    attackBase,
    weaponType,
    damageType: typeInfo.damageType,
    weaponWeight: weight,
    weaponHardness: material.durability,
    weaponSkill: skillRank,
    weaponBroken: broken,
    durabilityAttackMult,
    limbAttackMult: limbAttack.mult,
    limbAttack,
  };
}
