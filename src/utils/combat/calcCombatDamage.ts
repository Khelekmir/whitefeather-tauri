import { getArmorSlotSize } from '../../data/combat/armorSlotSize';
import { getBodypartSize } from '../../data/combat/bodypartSizes';
import type { BodyPartId } from '../../types/characters';
import type { EquipmentLoadout, Item } from '../../types/items';
import { getArmorMitigationFraction } from '../items/panelDurability';
import { getProtectingArmor } from '../items/resolveItem';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';

const TUNING = 1;

export interface CombatDamageBlockOpts {
  /** Precomputed block chance (already part-scaled if desired). */
  blockChance: number;
  /** Absorb subtracted from attack value on success. */
  blockValue: number;
  /** Injected RNG for tests; default Math.random. */
  rng?: () => number;
}

export interface CombatDamageResult {
  damagePercent: number;
  attackerAtkValue: number;
  totalMitigation: number;
  mitigationMultiplier: number;
  bodypartSize: number;
  /** True when shield block absorbed (armor mit skipped). */
  blocked: boolean;
  /** Attack value remaining after block subtract (only set when blocked). */
  damageThroughBlock: number;
  blockRoll: number;
}

/**
 * Port of utils_old CalcCombatDamage including shield block.
 * On block: damage = max(0, atk − blockValue) — **no armor mitigation**.
 * Else: atk × armor mitigation (panel strength × coverage × slot size).
 */
export function calcCombatDamage(
  attackerAtkValue: number,
  defenderHealthCap: number,
  bodypart: BodyPartId,
  equipment: EquipmentLoadout,
  itemsById: Record<string, Item>,
  block?: CombatDamageBlockOpts
): CombatDamageResult {
  const rng = block?.rng ?? Math.random;
  const blockChance = Math.max(0, block?.blockChance ?? 0);
  const blockValue = Math.max(0, block?.blockValue ?? 0);
  const blockRoll = rng();
  let blocked = false;
  let damageThroughBlock = 0;

  if (blockValue > 0 && blockChance > 0 && blockRoll < blockChance) {
    blocked = true;
    damageThroughBlock = Math.max(0, attackerAtkValue - blockValue);
  }

  const layers = getProtectingArmor(bodypart, equipment, itemsById);
  let totalMitigation = 0;

  for (const layer of layers) {
    const sizeMultiplier = getArmorSlotSize(layer.instance.slot);
    const panelFrac = getArmorMitigationFraction(layer.instance, bodypart);
    const strength = layer.material.strength;
    const mitigation = strength * panelFrac * sizeMultiplier * TUNING;
    const cov = layer.coverage[bodypart] ?? 1;
    totalMitigation += mitigation * cov;
  }

  const mitigationMultiplier =
    COMBAT_TUNING.armorEffectiveness *
    Math.min(
      1,
      Math.max(
        0,
        1 -
          Math.pow(
            Math.max(0, Math.log(Math.max(1, totalMitigation)) / Math.log(100)),
            3
          )
      )
    );

  const damageReceived = blocked
    ? damageThroughBlock
    : attackerAtkValue * mitigationMultiplier;
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
    blocked,
    damageThroughBlock: roundToThousandths(damageThroughBlock),
    blockRoll: roundToThousandths(blockRoll),
  };
}
