import { getArmorSlotSize } from '../../data/combat/armorSlotSize';
import { getWeaponTypeInfo } from '../../data/combat/weaponTypes';
import { getMaterial } from '../../data/combat/materials';
import { getShieldTypeInfo } from '../../data/combat/shieldTypes';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import type { Item, MaterialId } from '../../types/items';
import {
  COMBAT_TUNING,
  isHardMaterial,
  isOutfitSlot,
  isSoftMaterial,
} from './combatTuning';
import { roundToThousandths } from './penalties';

function hardnessClashMultiplier(
  weaponHardness: number,
  armorHardness: number
): number {
  if (armorHardness <= 0 || weaponHardness <= 0) return 1;
  const ratio = weaponHardness / armorHardness;
  const { metalClashRatioMin, metalClashRatioMax, metalClashBonus } = COMBAT_TUNING;
  if (ratio >= metalClashRatioMin && ratio <= metalClashRatioMax) {
    return metalClashBonus;
  }
  return 1;
}

export interface ArmorWearContext {
  attackerAtkValue: number;
  /** Prefer √attackValue for hard gear pacing; soft outfit uses fuller energy. */
  attackerWeaponHardness: number;
  layerIndex: number;
  /** True if this layer is the outermost protector on this hit. */
  isOutermost: boolean;
}

/**
 * Policy B armor wear:
 * - Soft outfit (especially outermost): shreds fast → hurt AND look ruined.
 * - Hard plate: paced wear + metal-clash bonus when hardness matches.
 */
export function calcArmorDurabilityLoss(
  item: Item,
  ctx: ArmorWearContext
): number {
  const material = getMaterial(item.material);
  const sizeMultiplier = Math.max(0.5, getArmorSlotSize(item.slot) || 1);
  const matDur = Math.max(0.5, material.durability);
  const soft = isSoftMaterial(item.material);
  const outfit = soft && isOutfitSlot(item.slot);

  const layerScaling =
    1 / Math.pow(COMBAT_TUNING.layerFalloffBase, Math.max(0, ctx.layerIndex));

  let loss: number;

  if (soft) {
    // Soft clothes: wear tracks wound energy more closely (outfit wreck).
    const energy = Math.max(0, ctx.attackerAtkValue);
    let scale = COMBAT_TUNING.softArmorWearScale;
    if (outfit && ctx.isOutermost) {
      scale *= COMBAT_TUNING.softOutermostOutfitBonus;
    }
    loss =
      (energy / sizeMultiplier / matDur) *
      (ctx.attackerWeaponHardness / matDur) *
      scale *
      layerScaling;
    loss = Math.max(loss, COMBAT_TUNING.softArmorMinChip * layerScaling);
  } else {
    // Hard armor: √damage pacing + clash when steel meets steel.
    const energy = Math.sqrt(Math.max(0, ctx.attackerAtkValue));
    const clash = hardnessClashMultiplier(
      ctx.attackerWeaponHardness,
      material.durability
    );
    loss =
      (energy / sizeMultiplier / matDur) *
      (ctx.attackerWeaponHardness / matDur) *
      COMBAT_TUNING.hardArmorWearScale *
      clash *
      layerScaling;
  }

  // Uncapped base chip — callers clamp to the struck panel (or scalar) remaining.
  // Capping by whole-item durability here would starve intact panels on a
  // partially shredded garment.
  return roundToThousandths(loss);
}

export type WeaponWearTarget = 'hard' | 'soft' | 'flesh';

export function classifyWeaponWearTarget(
  outermostArmorMaterial: MaterialId | null
): WeaponWearTarget {
  if (!outermostArmorMaterial || outermostArmorMaterial === 'unequipped') {
    return 'flesh';
  }
  if (isHardMaterial(outermostArmorMaterial)) return 'hard';
  if (isSoftMaterial(outermostArmorMaterial)) return 'soft';
  return 'flesh';
}

/** Weapon wear: costly vs plate, cheap vs cloth/flesh (energy goes into the body). */
export function calcWeaponDurabilityLoss(
  weapon: Item,
  attackerAtkBase: number,
  defendingMaterialHardness: number,
  target: WeaponWearTarget
): number {
  const material = getMaterial(weapon.material);
  const weaponType = weapon.weaponType ?? 'punch';
  const sizeMultiplier = getWeaponTypeInfo(weaponType).sizeFactor || 1;
  const matDur = Math.max(0.5, material.durability);

  const scale =
    target === 'hard'
      ? COMBAT_TUNING.weaponWearVsHardScale
      : target === 'soft'
        ? COMBAT_TUNING.weaponWearVsSoftScale
        : COMBAT_TUNING.weaponWearVsFleshScale;

  const clash =
    target === 'hard'
      ? hardnessClashMultiplier(material.durability, defendingMaterialHardness)
      : 1;

  const loss =
    ((Math.max(0, attackerAtkBase) / sizeMultiplier) / matDur) *
    (Math.max(0.5, defendingMaterialHardness) / matDur) *
    scale *
    clash;

  return Math.min(weapon.durability, roundToThousandths(loss));
}

/** Port of utils_old CalcShieldDurabilityLoss — chip on successful block. */
export function calcShieldDurabilityLoss(
  shield: Item,
  attackerAtkBase: number,
  attackerWeaponHardness: number
): number {
  const material = getMaterial(shield.material);
  const template = getItemTemplate(shield.templateId);
  const typeId = shield.shieldType ?? template?.shieldType ?? 'heater';
  const sizeMultiplier = Math.max(0.5, getShieldTypeInfo(typeId).sizeFactor);
  const matDur = Math.max(0.5, material.durability);
  const loss =
    ((Math.max(0, attackerAtkBase) / sizeMultiplier) / matDur) *
    (Math.max(0.5, attackerWeaponHardness) / matDur) *
    COMBAT_TUNING.shieldWearScale;
  return Math.min(shield.durability, roundToThousandths(loss));
}
