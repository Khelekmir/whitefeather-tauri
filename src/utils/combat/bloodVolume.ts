import type { Sex, Unit as DetailedUnit } from '../../types/characters';
import { roundToThousandths } from './penalties';

/**
 * Mild-realism blood volume from height (inches) + weight (lbs) + sex.
 * Nadler-style formulas (height → meters, weight → kg), result in liters.
 *
 * Typical adults ≈ 4.5–5.5 L (M), ≈ 3.5–4.5 L (F).
 */
export function estimateBloodVolumeLiters(
  heightInches: number,
  weightLbs: number,
  sex: Sex
): number {
  const hM = Math.max(1.2, heightInches * 0.0254);
  const wKg = Math.max(35, weightLbs * 0.45359237);

  const liters =
    sex === 'F'
      ? 0.3561 * hM ** 3 + 0.03308 * wKg + 0.1833
      : 0.3669 * hM ** 3 + 0.03219 * wKg + 0.6041;

  // Clamp to a sane fantasy-human range
  return roundToThousandths(Math.max(2.5, Math.min(7.5, liters)));
}

export function getCharacterBloodVolume(unit: Pick<DetailedUnit, 'height' | 'weight' | 'sex'>): number {
  return estimateBloodVolumeLiters(unit.height, unit.weight, unit.sex);
}

/** How much of the character's blood remains (1 = full, 0 = empty). */
export function getBloodRemainingFraction(
  bloodVolumeLiters: number,
  bloodLossLiters: number
): number {
  if (bloodVolumeLiters <= 0) return 1;
  return Math.max(0, Math.min(1, (bloodVolumeLiters - Math.max(0, bloodLossLiters)) / bloodVolumeLiters));
}

/**
 * Clinical-ish hemorrhage classes (simplified) for UI / thresholds.
 * Fractions are *remaining* blood, not lost.
 */
export type BloodLossClass =
  | 'none'
  | 'mild'      // ~<15% lost
  | 'moderate'  // ~15–30%
  | 'severe'    // ~30–40%
  | 'critical';  // ~>40%

export function classifyBloodLoss(remainingFraction: number): BloodLossClass {
  const lost = 1 - remainingFraction;
  if (lost < 0.08) return 'none';
  if (lost < 0.15) return 'mild';
  if (lost < 0.3) return 'moderate';
  if (lost < 0.4) return 'severe';
  return 'critical';
}

export interface BloodStatus {
  volumeLiters: number;
  lostLiters: number;
  remainingLiters: number;
  remainingFraction: number;
  lostFraction: number;
  lossClass: BloodLossClass;
}

export function getBloodStatus(
  unit: Pick<DetailedUnit, 'height' | 'weight' | 'sex'> & {
    combatStats: { base: { bloodLoss: number } };
  }
): BloodStatus {
  const volumeLiters = getCharacterBloodVolume(unit);
  const lostLiters = Math.max(0, unit.combatStats.base.bloodLoss ?? 0);
  const remainingLiters = Math.max(0, volumeLiters - lostLiters);
  const remainingFraction = getBloodRemainingFraction(volumeLiters, lostLiters);

  return {
    volumeLiters,
    lostLiters: roundToThousandths(lostLiters),
    remainingLiters: roundToThousandths(remainingLiters),
    remainingFraction: roundToThousandths(remainingFraction),
    lostFraction: roundToThousandths(1 - remainingFraction),
    lossClass: classifyBloodLoss(remainingFraction),
  };
}

/**
 * Combat consequences of lost blood — stamina-first.
 * All values are multipliers (1 = unaffected).
 */
export interface BloodCombatPenalties {
  /** Effective stamina (current/cap feel) — primary lever. */
  stamina: number;
  /** Soft attack power fade when blood is meaningfully down. */
  attack: number;
  /** Mild dizziness / sluggish movement. */
  mobility: number;
  /** Mild awareness / dodge fade at higher loss. */
  dodge: number;
  /** Very soft HP pressure only at severe+ (most HP still from wounds). */
  vitality: number;
}

export function calcBloodCombatPenalties(
  remainingFraction: number
): BloodCombatPenalties {
  const lost = 1 - remainingFraction;

  // Stamina: starts early, curves down hard — primary consequence
  // remaining 1 → 1.0; 0.85 → ~0.92; 0.7 → ~0.72; 0.5 → ~0.45
  const stamina = Math.max(
    0.15,
    Math.pow(Math.max(0, remainingFraction), 1.35)
  );

  // Attack: mild until moderate loss
  const attack =
    lost < 0.12
      ? 1
      : Math.max(0.55, 1 - (lost - 0.12) * 0.9);

  // Mobility / dodge: slight early, worse when woozy
  const mobility =
    lost < 0.1
      ? 1
      : Math.max(0.5, 1 - (lost - 0.1) * 0.75);
  const dodge =
    lost < 0.15
      ? 1
      : Math.max(0.45, 1 - (lost - 0.15) * 0.85);

  // Vitality: only bite at severe+ so foot wounds ≠ bleed-equals-HP
  const vitality =
    lost < 0.28
      ? 1
      : Math.max(0.7, 1 - (lost - 0.28) * 0.6);

  return {
    stamina: roundToThousandths(stamina),
    attack: roundToThousandths(attack),
    mobility: roundToThousandths(mobility),
    dodge: roundToThousandths(dodge),
    vitality: roundToThousandths(vitality),
  };
}
