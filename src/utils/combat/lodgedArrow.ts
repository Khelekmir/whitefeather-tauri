/**
 * Lodged arrow shafts: plug external bleed, aggravate internal on movement,
 * spike bleed on extract (head style × head material).
 */

import type {
  BodyPartHealth,
  BodyPartId,
  ItemizedHealth,
  LodgedArrow,
} from '../../types/characters';
import type { Item } from '../../types/items';
import {
  arrowHeadMaterialScale,
  formatArrowComposition,
  getArrowHeadStyleProfile,
  getArrowShaftProfile,
} from '../../data/combat/arrowHeadStyles';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { roundToThousandths } from './penalties';

export type LodgeArrowResult =
  | { ok: true; lodged: LodgedArrow; alreadyOccupied: false }
  | { ok: true; lodged: LodgedArrow; alreadyOccupied: true }
  | { ok: false; message: string };

export type ExtractLodgedArrowResult =
  | {
      ok: true;
      part: BodyPartId;
      removed: LodgedArrow;
      externalSpike: number;
      internalSpike: number;
    }
  | { ok: false; message: string };

export function resolveArrowComposition(arrow: Item): LodgedArrow {
  const t = getItemTemplate(arrow.templateId);
  const headStyle = arrow.arrowHeadStyle ?? t?.arrowHeadStyle ?? 'hunting';
  const shaftGrade = arrow.shaftGrade ?? t?.shaftGrade ?? 'mid';
  const material = arrow.material ?? t?.material ?? 'iron';
  return {
    headStyle,
    shaftGrade: shaftGrade,
    material,
    templateId: arrow.templateId,
    name: arrow.name,
  };
}

/** External bleed rate multiplier while a shaft occupies the wound. */
export function lodgedExternalBleedMult(
  state: Pick<BodyPartHealth, 'lodgedArrow'> | null | undefined
): number {
  const lodged = state?.lodgedArrow;
  if (!lodged) return 1;
  return getArrowHeadStyleProfile(lodged.headStyle).lodgedExternalBleedMult;
}

/**
 * Lodge an arrow on a part after a penetrating hit.
 * One shaft per part — occupied wounds stay occupied.
 */
export function lodgeArrowInPart(
  itemized: ItemizedHealth,
  part: BodyPartId,
  arrow: Item
): LodgeArrowResult {
  const s = itemized[part];
  if (!s) return { ok: false, message: `Unknown body part ${part}.` };

  if (s.lodgedArrow) {
    return {
      ok: true,
      lodged: s.lodgedArrow,
      alreadyOccupied: true,
    };
  }

  const lodged = resolveArrowComposition(arrow);
  s.lodgedArrow = lodged;
  // External flow is plugged via lodgedExternalBleedMult on rate (intensity stays).
  return { ok: true, lodged, alreadyOccupied: false };
}

export interface AggravateLodgedOptions {
  /** Pass Time minutes. */
  minutes?: number;
  /** Attack / dodge / parry counts this beat. */
  actions?: number;
}

export interface AggravateLodgedResult {
  parts: BodyPartId[];
  log: string[];
}

/**
 * Wiggle lodged shafts: raise internalBleed (style × material).
 */
export function aggravateLodgedArrows(
  itemized: ItemizedHealth,
  opts: AggravateLodgedOptions = {}
): AggravateLodgedResult {
  const minutes = Math.max(0, opts.minutes ?? 0);
  const actions = Math.max(0, opts.actions ?? 0);
  const parts: BodyPartId[] = [];
  const log: string[] = [];
  if (minutes <= 0 && actions <= 0) return { parts, log };

  for (const [part, state] of Object.entries(itemized) as [
    BodyPartId,
    BodyPartHealth,
  ][]) {
    const lodged = state.lodgedArrow;
    if (!lodged) continue;
    const style = getArrowHeadStyleProfile(lodged.headStyle);
    const mat = arrowHeadMaterialScale(lodged.material);
    const delta =
      (style.aggravateInternalPerMinute * minutes +
        style.aggravateInternalOnAction * actions) *
      mat;
    if (delta <= 1e-6) continue;
    const before = state.internalBleed ?? 0;
    state.internalBleed = roundToThousandths(
      Math.min(1, before + delta)
    );
    parts.push(part);
    log.push(
      `${part}: lodged ${formatArrowComposition(lodged)} wriggled — internal ${(before * 100).toFixed(0)}% → ${((state.internalBleed ?? 0) * 100).toFixed(0)}%.`
    );
  }
  return { parts, log };
}

/**
 * Pull the shaft: spike bleed by style × material, clear lodgedArrow.
 */
export function extractLodgedArrow(
  itemized: ItemizedHealth,
  part: BodyPartId
): ExtractLodgedArrowResult {
  const s = itemized[part];
  if (!s) return { ok: false, message: `Unknown body part ${part}.` };
  if (!s.lodgedArrow) {
    return { ok: false, message: `No arrow lodged in ${part}.` };
  }

  const removed = s.lodgedArrow;
  const style = getArrowHeadStyleProfile(removed.headStyle);
  const mat = arrowHeadMaterialScale(removed.material);
  const externalSpike = roundToThousandths(style.extractExternalSpike * mat);
  const internalSpike = roundToThousandths(style.extractInternalSpike * mat);

  s.bleed = roundToThousandths(
    Math.min(1, Math.max(s.bleed ?? 0, (s.bleed ?? 0) + externalSpike))
  );
  s.internalBleed = roundToThousandths(
    Math.min(
      1,
      Math.max(s.internalBleed ?? 0, (s.internalBleed ?? 0) + internalSpike)
    )
  );
  s.lodgedArrow = null;

  return {
    ok: true,
    part,
    removed,
    externalSpike,
    internalSpike,
  };
}

export function describeLodgedArrow(lodged: LodgedArrow): string {
  const shaft = getArrowShaftProfile(lodged.shaftGrade);
  return `${lodged.name} (${formatArrowComposition(lodged)}; ${shaft.label})`;
}

export function listLodgedArrowParts(
  itemized: ItemizedHealth
): { part: BodyPartId; lodged: LodgedArrow }[] {
  const out: { part: BodyPartId; lodged: LodgedArrow }[] = [];
  for (const [part, state] of Object.entries(itemized) as [
    BodyPartId,
    BodyPartHealth,
  ][]) {
    if (state.lodgedArrow) out.push({ part, lodged: state.lodgedArrow });
  }
  return out;
}
