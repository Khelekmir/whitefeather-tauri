import type { BodyPartId } from '../../types/characters';
import type {
  CoverageMap,
  Item,
  PanelDurabilityMap,
} from '../../types/items';

import { roundToThousandths } from '../combat/penalties';

/**
 * Area-panel durability for armor garments.
 *
 * Coverage maps (template / presets) define which BodyPartIds a piece covers
 * and at what fraction (0–1). Panels are initialized for every part with
 * coverage > 0. Combat wear scales loss by coverage[part] so a 35% hip hem
 * takes 35% of the base chip; one shredded panel must not zero the whole
 * garment. Mitigation uses that part’s panel fraction so a ruined
 * `chestRight` no longer protects `chestRight` while `chestLeft` still can.
 *
 * Shields are out of scope — they do not use this schema yet.
 */

/** Build a full-integrity sparse panel map from a coverage map. */
export function initPanelDurability(
  coverage: CoverageMap,
  maxDurability: number
): PanelDurabilityMap {
  const maxD = Math.max(0, maxDurability);
  const panels: PanelDurabilityMap = {};
  for (const [part, cov] of Object.entries(coverage) as [BodyPartId, number | undefined][]) {
    if (cov != null && cov > 0) {
      panels[part] = maxD;
    }
  }
  return panels;
}

/**
 * Coverage-weighted average of panel fractions → summary durability.
 * Missing panels for a covered part count as 0 (fully shredded / never init).
 */
export function deriveItemDurability(
  panels: PanelDurabilityMap | undefined,
  coverage: CoverageMap,
  maxDurability: number,
  fallbackScalar?: number
): number {
  const maxD = Math.max(0, maxDurability);
  if (maxD <= 0) return 0;

  let weightSum = 0;
  let weightedFrac = 0;
  for (const [part, cov] of Object.entries(coverage) as [BodyPartId, number | undefined][]) {
    if (cov == null || cov <= 0) continue;
    weightSum += cov;
    const panel = panels?.[part] ?? 0;
    weightedFrac += (Math.max(0, Math.min(maxD, panel)) / maxD) * cov;
  }

  if (weightSum <= 0) {
    return fallbackScalar != null
      ? Math.max(0, Math.min(maxD, fallbackScalar))
      : maxD;
  }

  return Math.max(0, Math.min(maxD, maxD * (weightedFrac / weightSum)));
}

export function getPanelDurability(item: Item, part: BodyPartId): number {
  return item.panelDurability?.[part] ?? 0;
}

export function getPanelFraction(item: Item, part: BodyPartId): number {
  const maxD = Math.max(0, item.maxDurability);
  if (maxD <= 0) return 0;
  return Math.max(0, Math.min(1, getPanelDurability(item, part) / maxD));
}

/**
 * Integrity used for mitigation at a hit location.
 * Prefers the area panel when `panelDurability` exists; otherwise scalar ratio.
 */
export function getArmorMitigationFraction(item: Item, part: BodyPartId): number {
  const maxD = Math.max(0, item.maxDurability);
  if (maxD <= 0) return 0;
  if (item.panelDurability) {
    return getPanelFraction(item, part);
  }
  return Math.max(0, Math.min(1, item.durability / maxD));
}

export function isPanelIntact(item: Item, part: BodyPartId): boolean {
  return getPanelDurability(item, part) > 0;
}

/** Ensure sparse panels exist for all covered parts (mutates item). */
export function ensureArmorPanels(item: Item, coverage: CoverageMap): void {
  if (item.itemType !== 'armor') return;
  if (item.panelDurability && Object.keys(item.panelDurability).length > 0) {
    // Fill any newly covered keys missing from an older instance.
    for (const part of listCoveredPanels(coverage)) {
      if (item.panelDurability[part] == null) {
        item.panelDurability[part] = item.maxDurability;
      }
    }
    return;
  }
  const maxD = item.maxDurability;
  const frac = maxD > 0 ? Math.max(0, Math.min(1, item.durability / maxD)) : 1;
  item.panelDurability = applyPanelWearFractions(
    initPanelDurability(coverage, maxD),
    maxD,
    Object.fromEntries(
      listCoveredPanels(coverage).map((p) => [p, frac])
    ) as Partial<Record<BodyPartId, number>>
  );
}

export interface PanelHitWearResult {
  /** Unscaled loss from material / attack policy. */
  baseLoss: number;
  /** coverage[hitPart] used as the wear scale (0–1). */
  coverageScale: number;
  /** Actual chip applied to the panel (= baseLoss × coverageScale). */
  panelLoss: number;
  panelBefore: number;
  panelAfter: number;
  derivedDurability: number;
  /** Soft-outfit beat: this panel crossed from >0 to 0. */
  panelRuined: boolean;
}

/**
 * Apply one hit’s wear to the struck panel, then refresh derived scalar durability.
 * Mutates `item`. No-op (zero loss) when coverage for the part is 0.
 */
export function applyArmorPanelHitWear(
  item: Item,
  coverage: CoverageMap,
  hitPart: BodyPartId,
  baseLoss: number
): PanelHitWearResult {
  ensureArmorPanels(item, coverage);
  const coverageScale = Math.max(0, Math.min(1, coverage[hitPart] ?? 0));
  const base = Math.max(0, baseLoss);
  const panelBefore = item.panelDurability?.[hitPart] ?? 0;
  const panelLoss = Math.min(
    panelBefore,
    roundToThousandths(base * coverageScale)
  );
  const panelAfter = Math.max(0, roundToThousandths(panelBefore - panelLoss));

  if (!item.panelDurability) item.panelDurability = {};
  if (coverageScale > 0 || item.panelDurability[hitPart] != null) {
    item.panelDurability[hitPart] = panelAfter;
  }

  const derivedDurability = roundToThousandths(
    deriveItemDurability(
      item.panelDurability,
      coverage,
      item.maxDurability,
      item.durability
    )
  );
  item.durability = derivedDurability;

  return {
    baseLoss: roundToThousandths(base),
    coverageScale,
    panelLoss,
    panelBefore,
    panelAfter,
    derivedDurability,
    panelRuined: panelBefore > 0 && panelAfter <= 0,
  };
}

export function listCoveredPanels(
  coverage: CoverageMap
): BodyPartId[] {
  return (Object.entries(coverage) as [BodyPartId, number | undefined][])
    .filter(([, cov]) => cov != null && cov > 0)
    .map(([part]) => part);
}

/**
 * Apply optional per-part remaining fractions (0–1) onto a fresh panel map.
 * Used by starter kits that want uneven wear without hand-authoring absolutes.
 */
export function applyPanelWearFractions(
  panels: PanelDurabilityMap,
  maxDurability: number,
  wear?: Partial<Record<BodyPartId, number>>
): PanelDurabilityMap {
  if (!wear) return panels;
  const maxD = Math.max(0, maxDurability);
  const next: PanelDurabilityMap = { ...panels };
  for (const [part, frac] of Object.entries(wear) as [BodyPartId, number | undefined][]) {
    if (frac == null || next[part] == null) continue;
    next[part] = Math.max(0, Math.min(maxD, maxD * Math.max(0, Math.min(1, frac))));
  }
  return next;
}

