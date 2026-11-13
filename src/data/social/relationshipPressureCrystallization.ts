import type { ShortTermRelationshipId } from './relationships';
import type { PersonalizedPressureId } from './durablePressures';

/**
 * When short-term relationship weather fades (and crystallizes into LT),
 * also chip the *feeling* unit's durable pressure meters.
 *
 *   pressureDelta += fadedSt × weight × RELATIONSHIP_DRIFT_TUNING.pressureCrystalGain
 *
 * Soft meter-only: idle pressure drift still pulls toward each character's
 * personal baseline/anchor — relentless good/bad company offsets the meter
 * without rewriting temperament set-points.
 *
 * Sign: positive weight raises the meter; negative lowers it.
 */
export type PressureCrystalWeights = Partial<
  Record<PersonalizedPressureId, number>
>;

/** marginal ≈ 0.04 · slight ≈ 0.08 · moderate ≈ 0.14 · significant ≈ 0.22 */
export const ST_TO_PRESSURE_ON_CRYSTALLIZE: Record<
  ShortTermRelationshipId,
  PressureCrystalWeights
> = {
  irritation: {
    stress: 0.14,
  },
  hurt: {
    stress: 0.22,
    belonging: -0.1,
  },
  suspicion: {
    stress: 0.12,
    agency: -0.06,
  },
  guilt: {
    shame: 0.12,
  },
  gratitude: {
    belonging: 0.1,
    stress: -0.08,
  },
  admiration: {
    pride: 0.1,
    belonging: 0.05,
  },
  warmth: {
    belonging: 0.12,
    stress: -0.1,
  },
  desireHeat: {
    lust: 0.14,
  },
};
