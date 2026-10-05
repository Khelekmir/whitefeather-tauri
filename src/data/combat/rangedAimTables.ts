import type { BodyPartId } from '../../types/characters';

/**
 * Relative weights for ranged chest center-mass (normalized at use time).
 * Shoulders stay in primary mass; extremities live in the fringe pool.
 */
export const RANGED_CHEST_PRIMARY: Partial<Record<BodyPartId, number>> = {
  chestLeft: 0.18,
  chestRight: 0.18,
  stomachUpper: 0.12,
  stomachLower: 0.1,
  obliqueLeft: 0.08,
  obliqueRight: 0.08,
  shoulderLeft: 0.13,
  shoulderRight: 0.13,
};

/** Drift / near-miss extremities when aiming center mass. */
export const RANGED_CHEST_FRINGE: Partial<Record<BodyPartId, number>> = {
  head: 0.08,
  face: 0.05,
  neck: 0.06,
  earLeft: 0.02,
  earRight: 0.02,
  eyeLeft: 0.02,
  eyeRight: 0.02,
  upperArmLeft: 0.07,
  upperArmRight: 0.07,
  lowerArmLeft: 0.06,
  lowerArmRight: 0.06,
  handLeft: 0.05,
  handRight: 0.05,
  thighOuterLeft: 0.06,
  thighOuterRight: 0.06,
  thighInnerLeft: 0.03,
  thighInnerRight: 0.03,
  kneeLeft: 0.04,
  kneeRight: 0.04,
  lowerLegLeft: 0.04,
  lowerLegRight: 0.04,
  footLeft: 0.035,
  footRight: 0.035,
  groin: 0.03,
};

function sumWeights(map: Partial<Record<BodyPartId, number>>): number {
  let s = 0;
  for (const v of Object.values(map)) s += v ?? 0;
  return s;
}

function scaleInto(
  out: Partial<Record<BodyPartId, number>>,
  map: Partial<Record<BodyPartId, number>>,
  targetShare: number
): void {
  const total = sumWeights(map);
  if (total <= 0 || targetShare <= 0) return;
  for (const [part, w] of Object.entries(map) as [BodyPartId, number][]) {
    out[part] = (out[part] ?? 0) + (w / total) * targetShare;
  }
}

/**
 * Build a normalized chest hit-ratio with skill/band-aware fringe splash.
 */
export function mixChestPrimaryFringe(
  fringeShare: number
): Partial<Record<BodyPartId, number>> {
  const fringe = Math.max(0, Math.min(0.45, fringeShare));
  const primary = 1 - fringe;
  const out: Partial<Record<BodyPartId, number>> = {};
  scaleInto(out, RANGED_CHEST_PRIMARY, primary);
  scaleInto(out, RANGED_CHEST_FRINGE, fringe);
  return out;
}
