import { lewdTargetToBodyParts } from '../../data/lewd/lewdPartCoverage';
import type { BodyPartId, Unit as DetailedUnit } from '../../types/characters';
import type { Item, ItemSlot } from '../../types/items';
import {
  isHardMaterial,
  isSoftMaterial,
} from '../combat/combatTuning';
import { getProtectingArmor } from '../items/resolveItem';
import { LEWD_TUNING as T } from './lewdTuning';

export type ClothingAccessMode = 'over' | 'under' | 'displace';

export interface ClothingBarrierLayer {
  slot: ItemSlot;
  itemId: string;
  name: string;
  material: string;
  soft: boolean;
  hard: boolean;
  effectiveCov: number;
}

export interface ClothingBarrier {
  bodyParts: BodyPartId[];
  /** 0 = bare … 1 = fully blocked by remaining soft+hard layers. */
  barrier01: number;
  softBarrier01: number;
  hardBlocked: boolean;
  skinClear: boolean;
  layers: ClothingBarrierLayer[];
  /** Soft layer that was displaced this query (if any). */
  displaced?: { itemId: string; part: BodyPartId; amount: number };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function underSkipSet(): Set<string> {
  return new Set(T.clothing.underSkipSlots as readonly string[]);
}

/**
 * Effective coverage of one item for a body part, after garment displace.
 */
export function effectiveItemCoverage(
  item: Item,
  coverage: Partial<Record<BodyPartId, number | undefined>>,
  part: BodyPartId
): number {
  const base = coverage[part] ?? 0;
  if (base <= 0) return 0;
  const d = item.garmentState?.displace?.[part] ?? 0;
  return Math.max(0, base * (1 - clamp01(d)));
}

/**
 * Query clothing barrier at a lewd target.
 * When mode is `displace` and `applyDisplace` is true (default), mutates soft layers.
 * Pass `applyDisplace: false` for UI preview without side effects.
 */
export function clothingBarrierForLewdTarget(
  unit: DetailedUnit,
  itemsById: Record<string, Item> | undefined,
  targetPart: string,
  mode: ClothingAccessMode = 'over',
  opts?: { applyDisplace?: boolean }
): ClothingBarrier {
  const applyDisplace = opts?.applyDisplace !== false;
  const bodyParts = lewdTargetToBodyParts(targetPart);
  const empty: ClothingBarrier = {
    bodyParts,
    barrier01: 0,
    softBarrier01: 0,
    hardBlocked: false,
    skinClear: true,
    layers: [],
  };
  if (!itemsById || bodyParts.length === 0) return empty;

  const skip = mode === 'under' ? underSkipSet() : new Set<string>();
  const eps = T.clothing.clearEpsilon;
  const hardEps = T.clothing.hardBlockEpsilon;

  // Aggregate layers across mapped body parts (union by item id, max cov).
  const byItem = new Map<string, ClothingBarrierLayer>();
  let hardBlocked = false;
  let displaced: ClothingBarrier['displaced'];

  for (const part of bodyParts) {
    const protecting = getProtectingArmor(part, unit.equipment, itemsById);
    for (const layer of protecting) {
      const item = itemsById[layer.instance.id];
      if (!item || item.itemType !== 'armor') continue;
      if (skip.has(item.slot)) continue;

      let eff = effectiveItemCoverage(item, layer.coverage, part);
      const soft = isSoftMaterial(item.material);
      const hard = isHardMaterial(item.material) && !soft;

      // Displace: clear every soft covering layer for this part (hem + panty, etc.).
      if (applyDisplace && mode === 'displace' && soft && eff > eps) {
        const amount = T.clothing.displaceAmount;
        const nextDisp = {
          ...(item.garmentState?.displace ?? {}),
          [part]: Math.max(item.garmentState?.displace?.[part] ?? 0, amount),
        };
        item.garmentState = {
          ...item.garmentState,
          displace: nextDisp,
          macros: {
            ...item.garmentState?.macros,
            ...(part === 'groin' ? { crotchAside: true } : {}),
            ...(part === 'chestLeft' || part === 'chestRight'
              ? { cupsDown: true }
              : {}),
            ...(item.slot === 'shirt' || item.slot === 'leg'
              ? { hemRaised: true }
              : {}),
          },
        };
        eff = effectiveItemCoverage(item, layer.coverage, part);
        displaced = { itemId: item.id, part, amount };
      }

      if (eff <= eps) continue;

      const prev = byItem.get(item.id);
      const entry: ClothingBarrierLayer = {
        slot: item.slot,
        itemId: item.id,
        name: item.name,
        material: item.material,
        soft,
        hard,
        effectiveCov: Math.max(prev?.effectiveCov ?? 0, eff),
      };
      byItem.set(item.id, entry);
      if (hard && eff >= hardEps) hardBlocked = true;
    }
  }

  const layers = [...byItem.values()].sort((a, b) => {
    // Rough outer-first: chest/shirt/leg before underwear
    const order = (s: string) =>
      ({ chest: 0, shirt: 1, leg: 2, back: 3, undershirt: 4, underwear: 5, waist: 6 }[
        s
      ] ?? 9);
    return order(a.slot) - order(b.slot);
  });

  let softBarrier01 = 0;
  let barrier01 = 0;
  for (const L of layers) {
    if (L.soft) softBarrier01 = Math.min(1, softBarrier01 + L.effectiveCov * (1 - softBarrier01));
    barrier01 = Math.min(1, barrier01 + L.effectiveCov * (1 - barrier01));
  }

  const skinClear = !hardBlocked && softBarrier01 < eps && barrier01 < eps;

  return {
    bodyParts,
    barrier01,
    softBarrier01,
    hardBlocked,
    skinClear,
    layers,
    displaced,
  };
}

/** Clear all displace state on equipped armor. */
export function resetGarmentDisplace(
  unit: DetailedUnit,
  itemsById: Record<string, Item>
): number {
  let n = 0;
  for (const slot of Object.keys(unit.equipment) as (keyof typeof unit.equipment)[]) {
    const id = unit.equipment[slot];
    if (!id) continue;
    const item = itemsById[id];
    if (!item?.garmentState?.displace) continue;
    item.garmentState = {
      ...item.garmentState,
      displace: {},
      macros: {},
    };
    n += 1;
  }
  return n;
}

export function clothingStimMult(softBarrier01: number): number {
  const p = T.clothing.stimPenaltyAtFullSoft;
  return Math.max(0.15, 1 - p * clamp01(softBarrier01));
}

export function clothingIntimacyMult(softBarrier01: number): number {
  const r = T.clothing.intimacyReliefAtFullSoft;
  return Math.max(0.35, 1 - r * clamp01(softBarrier01));
}
