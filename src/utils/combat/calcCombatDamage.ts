import { getArmorSlotSize } from '../../data/combat/armorSlotSize';
import { getBodypartSize } from '../../data/combat/bodypartSizes';
import type { BodyPartId } from '../../types/characters';
import type { EquipmentLoadout, Item } from '../../types/items';
import { getProtectingArmor } from '../items/resolveItem';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';

const TUNING = 1;

export interface CombatDamageResult {
  damagePercent: number;
  attackerAtkValue: number;
  totalMitigation: number;
  mitigationMultiplier: number;
  bodypartSize: number;
}

/**
 * Port of utils_old CalcCombatDamage (no block — Battleground v1).
 * Mitigation from protecting armor layers via material strength × durability × slot size.
 */
export function calcCombatDamage(
  attackerAtkValue: number,
  defenderHealthCap: number,
  bodypart: BodyPartId,
  equipment: EquipmentLoadout,
  itemsById: Record<string, Item>
): CombatDamageResult {
  const layers = getProtectingArmor(bodypart, equipment, itemsById);
  let totalMitigation = 0;

  for (const layer of layers) {
    const sizeMultiplier = getArmorSlotSize(layer.instance.slot);
    const durabilityRatio = Math.max(0, Math.min(1, layer.durabilityRatio));
    const strength = layer.material.strength;
    const mitigation = strength * durabilityRatio * sizeMultiplier * TUNING;
    // Scale by how much this piece covers the hit location
    const cov = layer.coverage[bodypart] ?? 1;
    totalMitigation += mitigation * cov;
  }

  // Same curve as old CalcCombatDamage
  const mitigationMultiplier =
    COMBAT_TUNING.armorEffectiveness *
    Math.min(
      1,
      Math.max(
        0,
        1 - Math.pow(Math.max(0, Math.log(Math.max(1, totalMitigation)) / Math.log(100)), 3)
      )
    );

  const damageReceived = attackerAtkValue * mitigationMultiplier;
  const bodypartSize = getBodypartSize(bodypart);
  const damagePercent = Math.min(
    1,
    damageReceived / Math.max(0.1, defenderHealthCap * bodypartSize)
  );

  return {
    damagePercent: roundToThousandths(damagePercent),
    attackerAtkValue,
    totalMitigation: roundToThousandths(totalMitigation),
    mitigationMultiplier: roundToThousandths(mitigationMultiplier),
    bodypartSize,
  };
}
