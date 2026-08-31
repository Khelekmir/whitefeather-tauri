import type {
  LongTermRelationshipId,
  ShortTermRelationshipId,
} from './relationships';

/**
 * Relative ST → LT crystallization weights.
 * Applied to the *faded* short-term residual each idle tick:
 *   ltDelta += faded × weight × RELATIONSHIP_DRIFT_TUNING.crystallizeGain
 *
 * Sign convention: short-term axes are unipolar intensities (0–100).
 * Negative weights on faded irritation/hurt reduce standing respect/affection.
 *
 * Desire-targeted rows are still gated by sexualDesireAllowed at apply time.
 */
export type CrystallizationWeights = Partial<
  Record<LongTermRelationshipId, number>
>;

/** marginal ≈ 0.02 · slight ≈ 0.05 · moderate ≈ 0.10 · significant ≈ 0.18 */
export const ST_TO_LT_CRYSTALLIZATION: Record<
  ShortTermRelationshipId,
  CrystallizationWeights
> = {
  irritation: {
    respect: -0.05,
    affection: -0.05,
  },
  hurt: {
    trust: -0.18,
    respect: -0.02,
    affection: -0.18,
  },
  suspicion: {
    trust: -0.1,
    affection: -0.05,
    fear: 0.05,
  },
  guilt: {
    affection: -0.05,
    obligation: 0.05,
  },
  gratitude: {
    trust: 0.05,
    respect: 0.05,
    affection: 0.05,
    obligation: 0.02,
  },
  admiration: {
    trust: 0.1,
    respect: 0.18,
    desire: 0.02,
  },
  warmth: {
    affection: 0.1,
    familiarity: 0.02,
  },
  desireHeat: {
    affection: 0.05,
    desire: 0.1,
  },
};
