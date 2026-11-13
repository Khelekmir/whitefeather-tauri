/**
 * Idle drift for short-term relationship weather + crystallization into long-term.
 * Short-term axes are unipolar intensities (0–100), decaying toward 0.
 * Long-term standing bonds do not idle-decay on their own (active design).
 */
export const RELATIONSHIP_DRIFT_TUNING = {
  /**
   * First-order decay of short-term scores toward 0 (per hour).
   * λ = 0.7 → ~50% of residual gone in ~1 h; mostly cleared in a few hours.
   */
  shortTermLambdaPerHour: 0.7,

  /** Snap to 0 when |value| ≤ this. */
  snapEpsilon: 0.5,

  /**
   * Global scale on ST→LT crystallization.
   * ltDelta += fadedShortTerm × axisWeight × crystallizeGain
   * Keep low so standing bonds move slowly from weather alone.
   */
  crystallizeGain: 0.28,

  /** Ignore faded residuals smaller than this (no LT / pressure write). */
  crystallizeEpsilon: 0.25,

  /**
   * Global scale on ST-fade → durable pressure chips (same faded residual as LT).
   * pressureDelta += faded × weight × pressureCrystalGain
   * Soft vs idle pressure drift (λ≈0.45/h) so anchors stay meaningful.
   */
  pressureCrystalGain: 0.35,

  /**
   * Cap |pressure chip| per unit per pressure id within one drift call
   * (many edges crystallizing in the same Pass Time tick).
   */
  pressureCrystalPerTickCap: 8,
} as const;
