import {
  BLEED_CRITICALITY_RATE,
  BODYPART_VITALITY,
  getBodypartVitality,
} from '../../data/combat/bodypartVitality';
import { BODY_PARTS, type BodyPartId, type ItemizedHealth } from '../../types/characters';
import { roundToThousandths } from './penalties';

export interface DerivedHealth {
  /** 0–1 weighted average of part health (wound state only). */
  vitalityRatio: number;
  /**
   * vitalityRatio × healthCap × bloodVitalityFactor.
   * Blood loss mostly hits stamina; only severe+ hemorrhage soft-touches HP.
   */
  healthCurrent: number;
  healthCap: number;
  /** Liters lost (same units as blood volume). */
  bloodLossLiters: number;
  /** Sum of effective bleed rates across injured parts. */
  totalBleedRate: number;
  partsBleeding: {
    part: BodyPartId;
    /** Separate from bleed — structural / functional injury. */
    health: number;
    bleedIntensity: number;
    rate: number;
    criticality: string;
  }[];
}

/**
 * Compile pool HP from itemized part *health* (wounds), with a soft blood-vitality factor.
 *
 * part.health and part.bleed stay independent:
 * - Foot at 0 health → tiny vitality hit, but huge mobility/dodge penalty elsewhere.
 * - Foot at 0 also forces max bleed intensity until dressed/tourniquet.
 * - Liters lost mainly drain stamina effectiveness (see bloodVolume.ts).
 */
export function deriveHealthFromItemized(
  itemizedHealth: ItemizedHealth,
  healthCap: number,
  bloodLossLiters = 0,
  bloodVitalityFactor = 1
): DerivedHealth {
  let weighted = 0;
  let totalWeight = 0;

  for (const part of BODY_PARTS) {
    const w = BODYPART_VITALITY[part].vitalityWeight;
    const h = itemizedHealth[part]?.health ?? 1;
    weighted += Math.max(0, Math.min(1, h)) * w;
    totalWeight += w;
  }

  const vitalityRatio = totalWeight > 0 ? weighted / totalWeight : 1;
  const fromParts = vitalityRatio * healthCap;
  const healthCurrent = roundToThousandths(
    Math.max(
      0,
      Math.min(healthCap, fromParts * Math.max(0.5, Math.min(1, bloodVitalityFactor)))
    )
  );

  const bleed = summarizeBleed(itemizedHealth);

  return {
    vitalityRatio: roundToThousandths(vitalityRatio),
    healthCurrent,
    healthCap,
    bloodLossLiters: Math.max(0, bloodLossLiters),
    totalBleedRate: bleed.totalBleedRate,
    partsBleeding: bleed.partsBleeding,
  };
}

/**
 * Effective bleed rate for one part.
 * - health 0 → maximum rate for that part (intensity 1) until dressed
 * - else intensity from stored bleed, floored by injury severity (1 - health)
 * - dressed / vulnerary reduce rate
 */
export function calcPartBleedRate(
  part: BodyPartId,
  state: { health: number; bleed: number; dressed?: boolean; vulnerary?: boolean }
): number {
  const vit = getBodypartVitality(part);
  const health = Math.max(0, Math.min(1, state.health));
  const severity = 1 - health;
  const intensity =
    health <= 0
      ? 1
      : Math.max(state.bleed, severity > 0 ? severity : 0);

  if (intensity <= 0) return 0;

  let rate =
    vit.maxBleedRate *
    (BLEED_CRITICALITY_RATE[vit.bleedCriticality] / 10) *
    intensity;

  if (state.dressed) rate *= 0.25;
  if (state.vulnerary) rate *= 0.25;

  return roundToThousandths(rate);
}

export function getBleedIntensity(state: {
  health: number;
  bleed: number;
}): number {
  const health = Math.max(0, Math.min(1, state.health));
  if (health <= 0) return 1;
  if (health >= 1 && state.bleed <= 0) return 0;
  return Math.max(state.bleed, health < 1 ? 1 - health : 0);
}

export function summarizeBleed(itemizedHealth: ItemizedHealth): {
  totalBleedRate: number;
  partsBleeding: DerivedHealth['partsBleeding'];
} {
  const partsBleeding: DerivedHealth['partsBleeding'] = [];
  let totalBleedRate = 0;

  for (const part of BODY_PARTS) {
    const s = itemizedHealth[part];
    if (!s) continue;
    const rate = calcPartBleedRate(part, s);
    const intensity = getBleedIntensity(s);

    if (intensity > 0 || s.health < 1) {
      const vit = getBodypartVitality(part);
      partsBleeding.push({
        part,
        health: s.health,
        bleedIntensity: roundToThousandths(intensity),
        rate,
        criticality: vit.bleedCriticality,
      });
      totalBleedRate += rate;
    }
  }

  partsBleeding.sort((a, b) => b.rate - a.rate);

  return {
    totalBleedRate: roundToThousandths(totalBleedRate),
    partsBleeding,
  };
}

/**
 * After damaging a part: refresh bleed intensity from injury severity.
 * Does NOT change part.health further — wound and bleed stay separate.
 * At 0 health → max intensity until dressed/tourniquet.
 */
export function refreshBleedAfterInjury(
  itemizedHealth: ItemizedHealth,
  part: BodyPartId
): void {
  const s = itemizedHealth[part];
  if (!s) return;
  const health = Math.max(0, Math.min(1, s.health));
  if (health >= 1) {
    s.bleed = 0;
    return;
  }
  const severity = 1 - health;
  s.bleed = Math.max(s.bleed, health <= 0 ? 1 : severity);
}
