import { BODY_PARTS, type ItemizedHealth } from '../../types/characters';
import { getBodypartVitality } from '../../data/combat/bodypartVitality';
import { roundToThousandths } from '../combat/penalties';

/**
 * Derived combat→mood pressure from itemized health.
 * No per-character temperament modifiers — injury is injury.
 *
 * Returns 0–100 (0 = fully healthy, 100 = catastrophic weighted injury).
 */
export function derivePainLoad(itemized: ItemizedHealth): number {
  let weightedInjury = 0;
  let weightSum = 0;
  for (const part of BODY_PARTS) {
    const h = itemized[part];
    if (!h) continue;
    const vit = getBodypartVitality(part).vitalityWeight;
    const missing = Math.max(0, 1 - (h.health ?? 1));
    // Extra bite from acute trauma flags
    let flag = 0;
    if (h.fracture || h.broken) flag += 0.15;
    if (h.sprain) flag += 0.05;
    if ((h.bruise ?? 0) > 0) flag += Math.min(0.15, h.bruise * 0.2);
    if ((h.bleed ?? 0) > 0) flag += Math.min(0.25, h.bleed * 0.5);
    if ((h.internalBleed ?? 0) > 0) flag += Math.min(0.2, h.internalBleed * 0.4);
    weightedInjury += vit * Math.min(1.5, missing + flag);
    weightSum += vit;
  }
  if (weightSum <= 0) return 0;
  // Normalize: full missing on all parts → high but allow flag headroom
  const raw = (weightedInjury / weightSum) * 100;
  return roundToThousandths(Math.max(0, Math.min(100, raw)));
}
