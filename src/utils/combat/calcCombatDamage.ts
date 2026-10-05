import { getArmorSlotSize } from '../../data/combat/armorSlotSize';
import { getBodypartSize } from '../../data/combat/bodypartSizes';
import type { BodyPartId } from '../../types/characters';
import type { ArrowHeadStyle, EquipmentLoadout, Item } from '../../types/items';
import { getArmorMitigationFraction } from '../items/panelDurability';
import { getProtectingArmor } from '../items/resolveItem';
import { COMBAT_TUNING } from './combatTuning';
import type { AttackMode } from './damageTypes';
import {
  resolveGlancingBlow,
  type GlancingBlowResult,
} from './glancingBlow';
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

export interface CombatDamageGlanceOpts {
  attackMode: AttackMode;
  arrowHeadStyle?: ArrowHeadStyle | null;
  /** Shared with block roll when provided. */
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
  /**
   * Diagnostic: max(0, atk − blockValue) when blocked.
   * Not applied as aimed-part wound — see resolveShieldBlock.
   */
  damageThroughBlock: number;
  blockRoll: number;
  /** Post-mitigation glance (null when blocked). */
  glance: GlancingBlowResult | null;
}

/**
 * Port of utils_old CalcCombatDamage including shield block.
 * On block: aimed-part wound is 0 (shield covers the aim). Excess atk vs
 * blockValue is diagnostic only — arm overload is resolveShieldBlock.
 * Else: atk × armor mitigation × optional glance fraction.
 */
export function calcCombatDamage(
  attackerAtkValue: number,
  defenderHealthCap: number,
  bodypart: BodyPartId,
  equipment: EquipmentLoadout,
  itemsById: Record<string, Item>,
  block?: CombatDamageBlockOpts,
  glanceOpts?: CombatDamageGlanceOpts
): CombatDamageResult {
  const rng = block?.rng ?? glanceOpts?.rng ?? Math.random;
  const blockChance = Math.max(0, block?.blockChance ?? 0);
  const blockValue = Math.max(0, block?.blockValue ?? 0);
  const blockRoll = rng();
  let blocked = false;
  /** Diagnostic excess energy above capacity (not applied as aimed wound). */
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

  let glance: GlancingBlowResult | null = null;
  let glanceFrac = 1;
  if (!blocked && glanceOpts) {
    glance = resolveGlancingBlow({
      bodypart,
      equipment,
      itemsById,
      attackMode: glanceOpts.attackMode,
      arrowHeadStyle: glanceOpts.arrowHeadStyle,
      rng,
    });
    glanceFrac = glance.fraction;
  }

  const damageReceived = blocked
    ? 0
    : attackerAtkValue * mitigationMultiplier * glanceFrac;
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
    glance,
  };
}
