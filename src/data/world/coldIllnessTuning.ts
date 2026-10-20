/**
 * Cold exposure debt → respiratory illness (common cold → pneumonia).
 * Shared body physiology peers of coreTemp — owned on lewdStats.dynamic for now.
 */

import type { RespiratoryIllnessStage } from '../../types/characters';

export const COLD_ILLNESS_TUNING = {
  /**
   * Accrue while worn wet + felt ambient cold (and/or core already cool).
   * Dose is low enough that sprinkle rarely infects; storm+stay-wet does.
   */
  debt: {
    /** wornEnvWet below this contributes no wet term. */
    wetFloor: 0.12,
    /** Felt ambient must be below this (°F) to accrue from weather. */
    feltColdStartF: 62,
    /** Core below this adds an extra debt term. */
    coreCoolStartF: 97.4,
    /** Base debt gain per hour at wet=1 and max cold factors. */
    accruePerHour: 0.22,
    /** Extra per hour when core is at/below hypothermic band. */
    coreBonusPerHour: 0.08,
    /** Decay per hour when dry + warm enough (before care mult). */
    decayPerHour: 0.14,
    /** Sheltered / sleeping warm dry decay mult. */
    warmRestDecayMult: 1.55,
    /** CON 7 ≈ 1; higher CON accrues slower / decays faster. */
    refConstitution: 7,
  },

  /** Debt threshold to roll none → cold (checked after accrue). */
  onsetDebt: 0.72,
  /** Minimum wet×cold exposure hours-equivalent before onset can fire. */
  onsetMinDebt: 0.55,

  stages: {
    /** Hours in `cold` before auto → lingering if still stressed. */
    coldToLingeringHours: 36,
    /** Hours in `lingering` + ongoing cold stress → pneumonia. */
    lingeringToPneumoniaHours: 48,
    /** Ongoing stress: debt above this counts as “still cold-stressed”. */
    escalateDebtFloor: 0.35,
    /** Or core at/below this while ill. */
    escalateCoreF: 97.0,
    /** Warm dry recovery: hours to drop one stage when resting well. */
    recoverColdHours: 28,
    recoverLingeringHours: 40,
    recoverPneumoniaHours: 72,
  } as const,

  /** Care / rest-warm lab action: debt cut + recovery hour credit. */
  care: {
    debtRelief: 0.28,
    recoveryHoursCredit: 14,
  },

  /**
   * Soft social taxes per Pass Time hour (applied once in advanceColdIllness).
   * Hypothermia band tax is separate and additive.
   */
  socialTaxPerHour: {
    none: { energy: 0, stress: 0 },
    cold: { energy: -1.2, stress: 0.6 },
    lingering: { energy: -2.2, stress: 1.1 },
    pneumonia: { energy: -3.5, stress: 1.8 },
  } as Record<RespiratoryIllnessStage, { energy: number; stress: number }>,

  /** Extra energy drain per hour from core band (hypothermia soft effects). */
  hypothermiaEnergyPerHour: {
    cool: -0.4,
    cold: -1.1,
    hypothermic: -2.4,
  },

  /**
   * Combat soft mults (read-only). 1 = full; lower = worse stamina/speed feel.
   * Battleground can multiply stamina drain / effective speed later.
   */
  combatMult: {
    none: { stamina: 1, speed: 1, skill: 1 },
    cold: { stamina: 0.92, speed: 0.96, skill: 0.98 },
    lingering: { stamina: 0.82, speed: 0.9, skill: 0.94 },
    pneumonia: { stamina: 0.65, speed: 0.78, skill: 0.85 },
  } as Record<
    RespiratoryIllnessStage,
    { stamina: number; speed: number; skill: number }
  >,
} as const;

export function formatRespiratoryIllnessLabel(
  stage: RespiratoryIllnessStage
): string {
  switch (stage) {
    case 'none':
      return 'well';
    case 'cold':
      return 'common cold';
    case 'lingering':
      return 'lingering cold';
    case 'pneumonia':
      return 'pneumonia';
  }
}
