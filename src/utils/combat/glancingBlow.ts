/**
 * Glancing blow — armor-class × attack-mode wound fraction after mitigation.
 */

import type { BodyPartId } from '../../types/characters';
import type { ArmorClass, ArrowHeadStyle, EquipmentLoadout, Item } from '../../types/items';
import { getProtectingArmor, type ResolvedItem } from '../items/resolveItem';
import { COMBAT_TUNING } from './combatTuning';
import type { AttackMode } from './damageTypes';
import { roundToThousandths } from './penalties';

export type GlanceArmorClass = Exclude<ArmorClass, 'cloth'>;

export interface GlanceLayerPick {
  armorClass: GlanceArmorClass;
  coverage: number;
  layerName: string;
  resolved: ResolvedItem;
}

export interface GlancingBlowInput {
  bodypart: BodyPartId;
  equipment: EquipmentLoadout;
  itemsById: Record<string, Item>;
  attackMode: AttackMode;
  /** Required for projectile vs mail/leather bodkin exception. */
  arrowHeadStyle?: ArrowHeadStyle | null;
  rng?: () => number;
}

export interface GlancingBlowResult {
  glanced: boolean;
  /** Multiplier on post-mitigation wound energy (1 = no glance). */
  fraction: number;
  armorClass: GlanceArmorClass | null;
  coverage: number;
  /** Set when a coverage RNG was rolled. */
  coverageRoll?: number;
  layerName?: string;
  reason?: string;
}

function isGlanceClass(ac: ArmorClass | undefined): ac is GlanceArmorClass {
  return ac === 'plate' || ac === 'chainmail' || ac === 'leather';
}

/**
 * Outermost protecting layer with a real armor class (skips cloth / unclassed).
 */
export function pickGlanceArmorLayer(
  bodypart: BodyPartId,
  equipment: EquipmentLoadout,
  itemsById: Record<string, Item>
): GlanceLayerPick | null {
  const layers = getProtectingArmor(bodypart, equipment, itemsById);
  for (const layer of layers) {
    const ac = layer.template.armorClass;
    if (!isGlanceClass(ac)) continue;
    const coverage = Math.max(0, Math.min(1, layer.coverage[bodypart] ?? 1));
    return {
      armorClass: ac,
      coverage,
      layerName: layer.instance.name,
      resolved: layer,
    };
  }
  return null;
}

/**
 * Table fraction if this mode glances on this class; null if no glance rule.
 */
export function glanceFractionFor(
  armorClass: GlanceArmorClass,
  attackMode: AttackMode,
  arrowHeadStyle?: ArrowHeadStyle | null
): number | null {
  const T = COMBAT_TUNING.glancingBlow;
  const mode = attackMode === 'unarmed' ? 'blunt' : attackMode;

  if (armorClass === 'plate') {
    if (mode === 'slash') return T.plate.slash;
    if (mode === 'thrust') return T.plate.thrust;
    if (mode === 'projectile') return T.plate.projectile;
    if (mode === 'blunt') return T.plate.blunt;
    return null;
  }

  if (armorClass === 'chainmail') {
    if (mode === 'slash') return T.chainmail.slash;
    if (mode === 'projectile') {
      if (arrowHeadStyle === 'bodkin') return null;
      return T.chainmail.projectile;
    }
    return null;
  }

  if (armorClass === 'leather') {
    if (mode === 'slash') return T.leather.slash;
    if (mode === 'projectile') {
      if (arrowHeadStyle === 'bodkin') return null;
      return T.leather.projectile;
    }
    return null;
  }

  return null;
}

/**
 * Resolve whether a connecting hit glances and by how much.
 * Coverage < 1: glance only if rng() < coverage (gap found otherwise).
 */
export function resolveGlancingBlow(input: GlancingBlowInput): GlancingBlowResult {
  const pick = pickGlanceArmorLayer(
    input.bodypart,
    input.equipment,
    input.itemsById
  );
  if (!pick) {
    return {
      glanced: false,
      fraction: 1,
      armorClass: null,
      coverage: 0,
      reason: 'no classed armor on part',
    };
  }

  const tableFrac = glanceFractionFor(
    pick.armorClass,
    input.attackMode,
    input.arrowHeadStyle
  );
  if (tableFrac == null) {
    return {
      glanced: false,
      fraction: 1,
      armorClass: pick.armorClass,
      coverage: pick.coverage,
      layerName: pick.layerName,
      reason: `${input.attackMode} does not glance on ${pick.armorClass}`,
    };
  }

  const rng = input.rng ?? Math.random;
  const coverage = pick.coverage;
  if (coverage < 1) {
    const coverageRoll = rng();
    if (coverageRoll >= coverage) {
      return {
        glanced: false,
        fraction: 1,
        armorClass: pick.armorClass,
        coverage,
        coverageRoll: roundToThousandths(coverageRoll),
        layerName: pick.layerName,
        reason: `coverage gap (p=${coverage.toFixed(2)}, roll=${coverageRoll.toFixed(2)})`,
      };
    }
    return {
      glanced: true,
      fraction: tableFrac,
      armorClass: pick.armorClass,
      coverage,
      coverageRoll: roundToThousandths(coverageRoll),
      layerName: pick.layerName,
      reason: `${pick.armorClass} ×${tableFrac}`,
    };
  }

  return {
    glanced: true,
    fraction: tableFrac,
    armorClass: pick.armorClass,
    coverage,
    layerName: pick.layerName,
    reason: `${pick.armorClass} ×${tableFrac}`,
  };
}
