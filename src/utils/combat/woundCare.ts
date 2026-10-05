import {
  BODY_PARTS,
  type BodyPartHealth,
  type BodyPartId,
  type ItemizedHealth,
  type Unit as DetailedUnit,
} from '../../types/characters';
import type { Item } from '../../types/items';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { getBodypartVitality } from '../../data/combat/bodypartVitality';
import { getWeaponTypeInfo } from '../../data/combat/weaponTypes';
import {
  careExternalFlowMult,
  hypovolemiaFlowMult,
} from './bloodVolume';
import { COMBAT_TUNING } from './combatTuning';
import {
  calcPartBleedRate,
  getExternalBleedIntensity,
  getInternalBleedIntensity,
} from './deriveHealthPool';
import { roundToThousandths } from './penalties';
import { syncConcussionFlag } from './sensoryPerformance';

const WC = () => COMBAT_TUNING.woundCare;

export type WoundCareResult =
  | { ok: true; part: BodyPartId; already: boolean; warning?: string }
  | { ok: false; message: string };

/**
 * Natural heal rate for one part (health fraction per minute).
 * 0 if fully healthy, or ruined and undressed.
 */
export function healRatePerMinute(part: BodyPartHealth): number {
  const h = Math.max(0, Math.min(1, part.health));
  if (h >= 1) return 0;
  // Ruined parts need a bandage to start convalescence (pressure alone ≠ heal).
  if (h <= 0 && !part.dressed) return 0;

  let rate = WC().naturalHealPerMinute;
  if (h <= 0 && part.dressed) rate *= WC().ruinedDressedHealMult;
  if (part.dressed) rate *= WC().bandageHealMult;
  if (part.vulnerary) rate *= WC().vulneraryHealMult;
  if (part.fracture) rate *= WC().fractureHealMult;
  if (part.broken) rate *= WC().brokenHealMult;
  return rate;
}

/**
 * External clot intensity drop per minute (before × dt).
 * Care mults + bonus from slow effective flow (bandage/pressure/hypovolemia).
 */
export function clotRatePerMinute(
  part: BodyPartHealth,
  opts?: { bloodLostFraction?: number; bodyPartId?: BodyPartId }
): number {
  let rate = COMBAT_TUNING.clotRatePerMinute;
  if (part.dressed) {
    rate *= WC().bandageClotMult;
    if (part.directPressure) rate *= WC().pressureOverBandageClotMult;
  } else if (part.directPressure) {
    rate *= WC().pressureClotMult;
  }
  if (part.vulnerary) rate *= WC().vulneraryClotMult;

  const careFlow = careExternalFlowMult(part);
  const arterial =
    opts?.bodyPartId != null
      ? getBodypartVitality(opts.bodyPartId).bleedCriticality === 'arterial'
      : false;
  const hypo = hypovolemiaFlowMult(opts?.bloodLostFraction ?? 0, arterial);
  const effectiveFlow = Math.max(0, Math.min(1, careFlow * hypo));
  rate *=
    1 +
    COMBAT_TUNING.hypovolemia.clotBonusFromSlowFlow * (1 - effectiveFlow);

  return rate;
}

export function applyDirectPressure(
  itemized: ItemizedHealth,
  part: BodyPartId
): WoundCareResult {
  const s = itemized[part];
  if (!s) return { ok: false, message: `Unknown body part ${part}.` };
  if (s.directPressure) {
    return { ok: true, part, already: true };
  }
  s.directPressure = true;
  return { ok: true, part, already: false };
}

export function releaseDirectPressure(
  itemized: ItemizedHealth,
  part: BodyPartId
): WoundCareResult {
  const s = itemized[part];
  if (!s) return { ok: false, message: `Unknown body part ${part}.` };
  if (!s.directPressure) {
    return { ok: true, part, already: true };
  }
  s.directPressure = false;
  return { ok: true, part, already: false };
}

export function releaseAllDirectPressure(itemized: ItemizedHealth): number {
  let n = 0;
  for (const part of BODY_PARTS) {
    const s = itemized[part];
    if (s?.directPressure) {
      s.directPressure = false;
      n += 1;
    }
  }
  return n;
}

/** Worst active bleed by combined external+internal rate (0 if none). */
export function findWorstBleedPart(
  itemized: ItemizedHealth
): BodyPartId | null {
  return findWorstUntreatedBleedPart(itemized, 'any');
}

/**
 * Highest bleed by blood-flow rate (criticality × intensity × care).
 * - `bandage`: skip already dressed
 * - `vulnerary`: skip already salved
 * - `any`: any active bleed
 */
export function findWorstUntreatedBleedPart(
  itemized: ItemizedHealth,
  treatment: 'bandage' | 'vulnerary' | 'any'
): BodyPartId | null {
  let best: BodyPartId | null = null;
  let bestRate = 0;
  for (const part of BODY_PARTS) {
    const s = itemized[part];
    if (!s) continue;
    if (treatment === 'bandage' && s.dressed) continue;
    if (treatment === 'vulnerary' && s.vulnerary) continue;
    const rate = calcPartBleedRate(part, s);
    if (rate > bestRate) {
      bestRate = rate;
      best = part;
    }
  }
  return bestRate > 0 ? best : null;
}

/**
 * Gameplay rule: direct pressure needs a free hand.
 * Offhand occupied (weapon/shield) or a two-handed mainhand blocks it.
 */
export function hasFreeHandForPressure(
  unit: DetailedUnit,
  itemsById: Record<string, Item>
): boolean {
  const offId = unit.equipment.offhand;
  if (offId) {
    const off = itemsById[offId];
    if (off && off.itemType !== 'other') return false;
  }
  const mainId = unit.equipment.mainhand;
  if (!mainId) return true;
  const main = itemsById[mainId];
  if (!main || main.itemType !== 'weapon') return true;
  const template = getItemTemplate(main.templateId);
  const wType = main.weaponType ?? template?.weaponType;
  // True two-handers (lance, etc.) occupy both hands even with empty offhand slot.
  if (wType && getWeaponTypeInfo(wType).twoHanded) return false;
  return true;
}

/**
 * Sync hold-pressure stance onto the worst bleed (or clear all).
 * Returns the part pressed, or null if released / unavailable.
 */
export function syncDirectPressureHold(
  unit: DetailedUnit,
  itemsById: Record<string, Item>,
  holding: boolean
): { part: BodyPartId | null; ok: boolean; message: string } {
  const itemized = unit.combatStats.itemizedHealth;
  releaseAllDirectPressure(itemized);
  if (!holding) {
    return { part: null, ok: true, message: 'Released direct pressure.' };
  }
  if (!hasFreeHandForPressure(unit, itemsById)) {
    return {
      part: null,
      ok: false,
      message: `${unit.name} needs a free hand to apply direct pressure.`,
    };
  }
  const part = findWorstBleedPart(itemized);
  if (!part) {
    return {
      part: null,
      ok: false,
      message: `${unit.name} has no active bleed to press.`,
    };
  }
  applyDirectPressure(itemized, part);
  return {
    part,
    ok: true,
    message: `${unit.name} applies direct pressure to ${part}.`,
  };
}

/**
 * Internal clot — slower base; dressing ignored; vulnerary at reduced efficiency.
 */
export function clotRatePerMinuteInternal(part: BodyPartHealth): number {
  let rate =
    COMBAT_TUNING.clotRatePerMinute * COMBAT_TUNING.internalClotMult;
  if (part.vulnerary) {
    const full = WC().vulneraryClotMult;
    const eff = COMBAT_TUNING.vulneraryInternalEfficiency;
    // e.g. full ×2 → effective 1 + (2−1)×0.75 = 1.75
    rate *= 1 + (full - 1) * eff;
  }
  return rate;
}

export function applyBandage(
  itemized: ItemizedHealth,
  part: BodyPartId
): WoundCareResult {
  const s = itemized[part];
  if (!s) return { ok: false, message: `Unknown body part ${part}.` };
  if (s.dressed) {
    return { ok: true, part, already: true };
  }
  s.dressed = true;
  return { ok: true, part, already: false };
}

export function removeBandage(
  itemized: ItemizedHealth,
  part: BodyPartId
): WoundCareResult {
  const s = itemized[part];
  if (!s) return { ok: false, message: `Unknown body part ${part}.` };
  if (!s.dressed) {
    return { ok: true, part, already: true };
  }
  s.dressed = false;
  return { ok: true, part, already: false };
}

export function applyVulnerary(
  itemized: ItemizedHealth,
  part: BodyPartId
): WoundCareResult {
  const s = itemized[part];
  if (!s) return { ok: false, message: `Unknown body part ${part}.` };
  if (s.vulnerary) {
    return { ok: true, part, already: true };
  }
  s.vulnerary = true;
  // Ruined fountain still pinned without occlusion — salve helps rate a bit
  // once unpinned, but clot stays locked until pressure or bandage.
  const pinned =
    s.health <= 0 && !s.dressed && !s.directPressure;
  return {
    ok: true,
    part,
    already: false,
    warning: pinned
      ? 'Vulnerary needs pressure or a bandage to stop a ruined fountain (clot locked until then).'
      : undefined,
  };
}

export function removeVulnerary(
  itemized: ItemizedHealth,
  part: BodyPartId
): WoundCareResult {
  const s = itemized[part];
  if (!s) return { ok: false, message: `Unknown body part ${part}.` };
  if (!s.vulnerary) {
    return { ok: true, part, already: true };
  }
  s.vulnerary = false;
  return { ok: true, part, already: false };
}

/**
 * Advance part.health from natural healing (+ care mults).
 * Clears dressed/vulnerary when fully healthy and not bleeding.
 */
export function applyNaturalHealing(
  itemized: ItemizedHealth,
  minutes: number
): { healedParts: BodyPartId[]; clearedCare: BodyPartId[] } {
  const dt = Math.max(0, minutes);
  const healedParts: BodyPartId[] = [];
  const clearedCare: BodyPartId[] = [];
  if (dt <= 0) return { healedParts, clearedCare };

  for (const part of BODY_PARTS) {
    const s = itemized[part];
    if (!s) continue;

    const before = s.health;
    const rate = healRatePerMinute(s);
    if (rate > 0 && before < 1) {
      s.health = Math.min(1, roundToThousandths(before + rate * dt));
      if (s.health > before) healedParts.push(part);
    }

    if (
      s.health >= 1 &&
      getExternalBleedIntensity(s) <= 0 &&
      getInternalBleedIntensity(s) <= 0
    ) {
      s.health = 1;
      s.bleed = 0;
      s.internalBleed = 0;
      if (s.dressed || s.vulnerary || s.directPressure) {
        s.dressed = false;
        s.vulnerary = false;
        s.directPressure = false;
        clearedCare.push(part);
      }
    }
  }

  // Head heal may clear concussion once above threshold.
  syncConcussionFlag(itemized);

  return { healedParts, clearedCare };
}

export const BANDAGE_TEMPLATE_ID = 'field-bandage';
export const VULNERARY_TEMPLATE_ID = 'vulnerary-salve';

/** Find one owned consumable instance by template (unequipped or any). */
export function findOwnedConsumable(
  itemsById: Record<string, Item>,
  templateId: string
): Item | null {
  for (const item of Object.values(itemsById)) {
    if (item.templateId === templateId && item.itemType === 'consumable') {
      return item;
    }
  }
  return null;
}

/** Remove one consumable from the owned bank. */
export function consumeOwnedItem(
  itemsById: Record<string, Item>,
  itemId: string
): boolean {
  if (!itemsById[itemId]) return false;
  delete itemsById[itemId];
  return true;
}

/**
 * Apply bandage, consuming a field-bandage if present.
 * `allowLabFree`: if no item, still apply and report labFree.
 */
export function useBandageOnPart(
  itemized: ItemizedHealth,
  part: BodyPartId,
  itemsById: Record<string, Item>,
  opts?: { allowLabFree?: boolean }
): WoundCareResult & { consumedId?: string; labFree?: boolean } {
  const item = findOwnedConsumable(itemsById, BANDAGE_TEMPLATE_ID);
  if (!item && !opts?.allowLabFree) {
    return { ok: false, message: 'No field bandage in inventory.' };
  }
  const r = applyBandage(itemized, part);
  if (!r.ok) return r;
  if (item) {
    consumeOwnedItem(itemsById, item.id);
    return { ...r, consumedId: item.id };
  }
  return { ...r, labFree: true };
}

export function useVulneraryOnPart(
  itemized: ItemizedHealth,
  part: BodyPartId,
  itemsById: Record<string, Item>,
  opts?: { allowLabFree?: boolean }
): WoundCareResult & { consumedId?: string; labFree?: boolean } {
  const item = findOwnedConsumable(itemsById, VULNERARY_TEMPLATE_ID);
  if (!item && !opts?.allowLabFree) {
    return { ok: false, message: 'No vulnerary salve in inventory.' };
  }
  const r = applyVulnerary(itemized, part);
  if (!r.ok) return r;
  if (item) {
    consumeOwnedItem(itemsById, item.id);
    return { ...r, consumedId: item.id };
  }
  return { ...r, labFree: true };
}

/** Worst injured / bleeding parts for auto-tend (highest missing health, then bleed). */
export function listCarePriorityParts(
  itemized: ItemizedHealth,
  limit = 2
): BodyPartId[] {
  const scored = BODY_PARTS.map((part) => {
    const s = itemized[part];
    const missing = s ? 1 - s.health : 0;
    const bleed = s
      ? getExternalBleedIntensity(s) + getInternalBleedIntensity(s)
      : 0;
    return { part, score: missing * 2 + bleed };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((r) => r.part);
}
