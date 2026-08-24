import type { BodyPartId } from '../../types/characters';

/**
 * How much each part contributes to overall survivability (pool HP).
 * A ruined foot should barely move the bar; neck / torso / head dominate.
 *
 * Weights are relative — pool = (Σ health_i × w_i) / (Σ w_i) × healthCap.
 */
export type BleedCriticality =
  | 'arterial'
  | 'critical'
  | 'heavy'
  | 'light'
  | 'superficial';

export interface BodyPartVitality {
  /** Contribution to compiled health pool. */
  vitalityWeight: number;
  /** Bleed danger tier when this part is injured. */
  bleedCriticality: BleedCriticality;
  /**
   * Max bleed rate for this part at full severity (health 0 or bleed intensity 1).
   * Units: arbitrary “bleed points” per time tick — tune in combatTuning later.
   */
  maxBleedRate: number;
}

/** Tier → base rate multiplier (old utils used 10 / 5 / 3 / 1 / 0.3). */
export const BLEED_CRITICALITY_RATE: Record<BleedCriticality, number> = {
  arterial: 10,
  critical: 5,
  heavy: 3,
  light: 1,
  superficial: 0.3,
};

/**
 * Ported criticality from utils_old bleedModifier names;
 * vitalityWeight chosen so extremities ≠ lethal organs.
 */
export const BODYPART_VITALITY: Record<BodyPartId, BodyPartVitality> = {
  // —— Head / neck ——
  head: { vitalityWeight: 12, bleedCriticality: 'critical', maxBleedRate: 5 },
  face: { vitalityWeight: 4, bleedCriticality: 'light', maxBleedRate: 1 },
  eyeLeft: { vitalityWeight: 2, bleedCriticality: 'light', maxBleedRate: 1 },
  eyeRight: { vitalityWeight: 2, bleedCriticality: 'light', maxBleedRate: 1 },
  earLeft: { vitalityWeight: 1, bleedCriticality: 'light', maxBleedRate: 0.8 },
  earRight: { vitalityWeight: 1, bleedCriticality: 'light', maxBleedRate: 0.8 },
  neck: { vitalityWeight: 14, bleedCriticality: 'arterial', maxBleedRate: 10 },

  // —— Torso ——
  chestLeft: { vitalityWeight: 8, bleedCriticality: 'heavy', maxBleedRate: 3 },
  chestRight: { vitalityWeight: 8, bleedCriticality: 'heavy', maxBleedRate: 3 },
  stomachUpper: { vitalityWeight: 9, bleedCriticality: 'critical', maxBleedRate: 5 },
  stomachLower: { vitalityWeight: 9, bleedCriticality: 'critical', maxBleedRate: 5 },
  obliqueLeft: { vitalityWeight: 5, bleedCriticality: 'heavy', maxBleedRate: 3 },
  obliqueRight: { vitalityWeight: 5, bleedCriticality: 'heavy', maxBleedRate: 3 },

  // —— Shoulders / arms ——
  shoulderLeft: { vitalityWeight: 4, bleedCriticality: 'heavy', maxBleedRate: 3 },
  shoulderRight: { vitalityWeight: 4, bleedCriticality: 'heavy', maxBleedRate: 3 },
  upperArmLeft: { vitalityWeight: 3.5, bleedCriticality: 'heavy', maxBleedRate: 3 },
  upperArmRight: { vitalityWeight: 3.5, bleedCriticality: 'heavy', maxBleedRate: 3 },
  lowerArmLeft: { vitalityWeight: 2.5, bleedCriticality: 'heavy', maxBleedRate: 2.5 },
  lowerArmRight: { vitalityWeight: 2.5, bleedCriticality: 'heavy', maxBleedRate: 2.5 },
  handLeft: { vitalityWeight: 1.5, bleedCriticality: 'light', maxBleedRate: 1 },
  handRight: { vitalityWeight: 1.5, bleedCriticality: 'light', maxBleedRate: 1 },

  // —— Hips / groin ——
  hipLeft: { vitalityWeight: 4, bleedCriticality: 'heavy', maxBleedRate: 3 },
  hipRight: { vitalityWeight: 4, bleedCriticality: 'heavy', maxBleedRate: 3 },
  groin: { vitalityWeight: 6, bleedCriticality: 'critical', maxBleedRate: 5 },
  anus: { vitalityWeight: 2, bleedCriticality: 'heavy', maxBleedRate: 2.5 },
  buttockLeft: { vitalityWeight: 3, bleedCriticality: 'heavy', maxBleedRate: 2.5 },
  buttockRight: { vitalityWeight: 3, bleedCriticality: 'heavy', maxBleedRate: 2.5 },

  // —— Legs / feet (low vitality — ruined foot ≠ dead) ——
  thighInnerLeft: { vitalityWeight: 4, bleedCriticality: 'arterial', maxBleedRate: 8 },
  thighInnerRight: { vitalityWeight: 4, bleedCriticality: 'arterial', maxBleedRate: 8 },
  thighOuterLeft: { vitalityWeight: 3.5, bleedCriticality: 'heavy', maxBleedRate: 3 },
  thighOuterRight: { vitalityWeight: 3.5, bleedCriticality: 'heavy', maxBleedRate: 3 },
  kneeLeft: { vitalityWeight: 2, bleedCriticality: 'light', maxBleedRate: 1.2 },
  kneeRight: { vitalityWeight: 2, bleedCriticality: 'light', maxBleedRate: 1.2 },
  lowerLegLeft: { vitalityWeight: 2.5, bleedCriticality: 'heavy', maxBleedRate: 2.5 },
  lowerLegRight: { vitalityWeight: 2.5, bleedCriticality: 'heavy', maxBleedRate: 2.5 },
  footLeft: { vitalityWeight: 1.2, bleedCriticality: 'light', maxBleedRate: 1 },
  footRight: { vitalityWeight: 1.2, bleedCriticality: 'light', maxBleedRate: 1 },
};

export function getBodypartVitality(part: BodyPartId): BodyPartVitality {
  return BODYPART_VITALITY[part];
}
