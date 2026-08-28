/**
 * Knobs for continuous mood scoring + secondary tint.
 * Tune on Social lab with Amberyl before locking content.
 */
export const MOOD_RESOLVE_TUNING = {
  /**
   * Soft logistic steepness for mapping 0–100 meters into 0–1 influence.
   * Higher = snappier around the midpoint; lower = gentler response to ±5 nudges.
   */
  softSteepness: 0.055,

  /** Midpoint of the soft curve (influence ~0.5 at this meter value). */
  softMidpoint: 50,

  /** Primary temperament weight when blending primary/secondary paint. */
  primaryWeight: 0.65,

  /**
   * Secondary tint only if runnerUpScore / primaryScore >= this.
   * Higher = rarer tints. ~0.72 keeps resting Amberyl from always tinting
   * (her default warm/playful ratio sits just under).
   */
  tintRatioMin: 0.72,

  /**
   * If primaryScore >= this absolute level, suppress tint even when ratio is close
   * (“exceptionally clear” primary mood). Tuned to Amberyl score magnitudes
   * (typical primary ~0.6–1.1; exceptional warm sits ~1.3+).
   */
  exceptionalPrimaryScore: 1.2,

  /**
   * Or if primary leads runner-up by at least this margin, suppress tint.
   */
  exceptionalLeadMargin: 0.45,

  /** Receptivity mix when tinting: primaryShare + secondaryShare should be 1. */
  receptivityPrimaryShare: 0.72,
  receptivitySecondaryShare: 0.28,
} as const;
