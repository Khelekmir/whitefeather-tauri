import type { BodyPartId, ItemizedHealth } from '../../types/characters';
import { roundToThousandths } from './penalties';
import { calcTraumaPenalties } from './traumaFlags';

/**
 * Functional penalties from part.health — independent of bleed / bloodLoss.
 * An axe to the foot ruins dodge/mobility even when pool HP barely moves.
 */

const MOBILITY_PARTS: { part: BodyPartId; weight: number }[] = [
  { part: 'footLeft', weight: 1.2 },
  { part: 'footRight', weight: 1.2 },
  { part: 'kneeLeft', weight: 1 },
  { part: 'kneeRight', weight: 1 },
  { part: 'lowerLegLeft', weight: 0.9 },
  { part: 'lowerLegRight', weight: 0.9 },
  { part: 'thighOuterLeft', weight: 0.8 },
  { part: 'thighOuterRight', weight: 0.8 },
  { part: 'thighInnerLeft', weight: 0.7 },
  { part: 'thighInnerRight', weight: 0.7 },
  { part: 'hipLeft', weight: 0.6 },
  { part: 'hipRight', weight: 0.6 },
];

const DODGE_PARTS: { part: BodyPartId; weight: number }[] = [
  ...MOBILITY_PARTS,
  { part: 'eyeLeft', weight: 0.8 },
  { part: 'eyeRight', weight: 0.8 },
  { part: 'head', weight: 0.4 },
  { part: 'shoulderLeft', weight: 0.35 },
  { part: 'shoulderRight', weight: 0.35 },
];

function weightedHealthFactor(
  itemized: ItemizedHealth,
  parts: { part: BodyPartId; weight: number }[]
): number {
  let sum = 0;
  let w = 0;
  for (const { part, weight } of parts) {
    const h = itemized[part]?.health ?? 1;
    // Emphasize crippled parts: sqrt so partial injury still hurts, 0 is devastating
    const contrib = Math.sqrt(Math.max(0, Math.min(1, h)));
    sum += contrib * weight;
    w += weight;
  }
  return w > 0 ? sum / w : 1;
}

export interface PerformanceFactors {
  /** 0–1 — movement / positioning effectiveness. */
  mobility: number;
  /** 0–1 — dodge chance multiplier (before other formulas). */
  dodge: number;
  /** Worst foot health (quick UI signal). */
  worstFootHealth: number;
  /** Trauma-only mults (independent of health). */
  traumaMobilityMult: number;
  traumaDodgeMult: number;
}

export function calcPerformanceFromItemized(
  itemizedHealth: ItemizedHealth
): PerformanceFactors {
  const trauma = calcTraumaPenalties(itemizedHealth);
  const mobility = roundToThousandths(
    weightedHealthFactor(itemizedHealth, MOBILITY_PARTS) * trauma.mobilityMult
  );
  const dodge = roundToThousandths(
    weightedHealthFactor(itemizedHealth, DODGE_PARTS) * trauma.dodgeMult
  );
  const worstFootHealth = Math.min(
    itemizedHealth.footLeft?.health ?? 1,
    itemizedHealth.footRight?.health ?? 1
  );

  return {
    mobility,
    dodge,
    worstFootHealth,
    traumaMobilityMult: trauma.mobilityMult,
    traumaDodgeMult: trauma.dodgeMult,
  };
}

/** Dev helper: list parts that are dragging mobility. */
export function mobilityProblemParts(
  itemizedHealth: ItemizedHealth,
  threshold = 0.85
): { part: BodyPartId; health: number }[] {
  return MOBILITY_PARTS.map(({ part }) => ({
    part,
    health: itemizedHealth[part]?.health ?? 1,
  }))
    .filter((p) => p.health < threshold)
    .sort((a, b) => a.health - b.health);
}
