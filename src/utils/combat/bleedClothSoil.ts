import { BODY_PARTS, type BodyPartId, type Unit as DetailedUnit } from '../../types/characters';
import type { Item, ItemSlot } from '../../types/items';
import { applyWetSoil, bagIntensity } from '../lewd/fluidSoil';
import { getProtectingArmor } from '../items/resolveItem';
import { getBloodStatus } from './bloodVolume';
import { COMBAT_TUNING, isSoftMaterial } from './combatTuning';
import { calcPartExternalBleedRate } from './deriveHealthPool';
import { roundToThousandths } from './penalties';

export interface BleedSoilEntry {
  part: BodyPartId;
  slot: ItemSlot;
  name: string;
  /** amount01 deposited this tick (before ×100 wet points). */
  amount01: number;
  coverage: number;
}

export interface BleedSoilResult {
  entries: BleedSoilEntry[];
  /** Distinct garment names that took blood this tick. */
  soiledNames: string[];
}

/**
 * While parts are actively bleeding, soak covering armor/clothing with blood.
 *
 * - Runs on Pass Time (`tickBleed`), not on the striking hit.
 * - Per bleeding part: flow starts at rate × minutes × scale.
 * - Layers are visited **innermost first** (wound → skin → cloth → outer).
 * - Each layer sticks `flow × coverage × absorb`; remainder × bleedThrough continues out.
 * - Soft materials absorb more than hard plate (surface stain only).
 * - Mutates items in `itemsById` (fighter-local bank).
 */
export function applyBleedSoilToLoadout(
  unit: DetailedUnit,
  itemsById: Record<string, Item>,
  minutes: number
): BleedSoilResult {
  const dt = Math.max(0, minutes);
  const entries: BleedSoilEntry[] = [];
  if (dt <= 0) return { entries, soiledNames: [] };

  const itemized = unit.combatStats.itemizedHealth;
  const lostFrac = getBloodStatus(unit).lostFraction;
  const scale = COMBAT_TUNING.bleedSoilPerRateMinute;
  const through = COMBAT_TUNING.bleedSoilBleedThrough;
  const softAbs = COMBAT_TUNING.bleedSoilSoftAbsorb;
  const hardAbs = COMBAT_TUNING.bleedSoilHardAbsorb;

  for (const part of BODY_PARTS) {
    const state = itemized[part];
    if (!state) continue;
    // Cloth soil only from external (open) bleeding — not internal.
    const rate = calcPartExternalBleedRate(part, state, lostFrac);
    if (rate <= 0) continue;

    let flow = rate * dt * scale;
    if (flow < 1e-6) continue;

    // getProtectingArmor is outer → inner; reverse so wound soaks inner cloth first.
    const layers = [...getProtectingArmor(part, unit.equipment, itemsById)].reverse();

    for (const layer of layers) {
      if (flow < 1e-6) break;
      const item = itemsById[layer.instance.id];
      if (!item || item.itemType !== 'armor') continue;

      const coverage = Math.max(0, Math.min(1, layer.coverage[part] ?? 0));
      if (coverage <= 0) continue;

      const absorb = (isSoftMaterial(item.material) ? softAbs : hardAbs) * coverage;
      const stuck = roundToThousandths(flow * Math.min(1, Math.max(0, absorb)));
      if (stuck < 1e-5) {
        flow *= through;
        continue;
      }

      item.lewdStats = {
        ...item.lewdStats,
        soiled: applyWetSoil(item.lewdStats.soiled, 'blood', stuck),
      };

      entries.push({
        part,
        slot: item.slot,
        name: item.name,
        amount01: stuck,
        coverage,
      });

      // What continues past this layer (soak + through).
      flow = roundToThousandths(flow * through * (1 - Math.min(0.85, absorb)));
    }
  }

  const soiledNames = [...new Set(entries.map((e) => e.name))];
  return { entries, soiledNames };
}

/** Blood stain intensity 0–100 on an item (wet+dry). */
export function itemBloodSoilIntensity(item: Item | undefined): number {
  if (!item?.lewdStats.soiled) return 0;
  return bagIntensity(item.lewdStats.soiled, 'blood');
}
