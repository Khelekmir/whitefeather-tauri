/**
 * Global knobs for idle durable-pressure drift.
 * Per-pressure growth/decay from temperament × character mods scale these.
 *
 * Layering:
 * - anchor = fixed character resting point (personality)
 * - baseline = dynamic target meters drift toward (wanders near anchor)
 * - meter = current lived value
 */
export const PRESSURE_DRIFT_TUNING = {
  /**
   * First-order approach rate (per hour) when growth/decay = 1.0.
   * gap' = gap × exp(−λ × rate × hours)
   *
   * λ = 0.45 → ~36% of the gap closes per hour at rate 1
   * (half-life ≈ ln2/0.45 ≈ 1.5 h).
   */
  idleLambdaPerHour: 0.45,

  /** Snap when |gap| is at or below this (avoids endless float noise). */
  snapEpsilon: 0.05,

  /**
   * How far a dynamic baseline may wander from its fixed anchor (points on 0–100).
   */
  baselineWanderMax: 20,

  /**
   * Fraction of growth/decay used when the baseline follows the current meter.
   * Small → personality target moves slowly with lived experience.
   */
  baselineFollowFraction: 0.08,

  /**
   * Fraction of growth/decay used when the baseline settles back toward its anchor.
   * ~0.1 = one-tenth the character’s normal recovery rates.
   */
  baselineAnchorFraction: 0.1,
} as const;
