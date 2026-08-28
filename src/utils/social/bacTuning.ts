/**
 * Blood-alcohol simulation knobs (Widmark-style).
 * BAC on SocialDynamic is stored as percent (0.08 ≈ US legal driving limit).
 */
export const BAC_TUNING = {
  /** Ethanol density g/mL. */
  ethanolDensity: 0.789,
  /** lbs → grams. */
  lbsToGrams: 453.59237,

  /** Widmark volume-of-distribution factors (sex). */
  rMale: 0.68,
  rFemale: 0.55,

  /** Zero-order elimination rate (%BAC per hour). */
  metabolizePerHour: 0.015,

  /**
   * Optional metabolize multiplier from alcoholTolerance[kind].
   * effectiveβ = metabolizePerHour × (1 + (tolerance − 1) × this).
   * 0 = ignore tolerance for now; raise later when tuning drinkers.
   */
  toleranceMetabolizeInfluence: 0.25,

  /**
   * Bioavailability of swallowed ethanol that will eventually reach blood
   * (first-pass losses). Applied when alcohol enters the gut pool.
   */
  absorbFraction: 1,

  /**
   * First-order gut→blood absorption rate (per hour).
   * ka ≈ 4.5 → ~85–90% of a gut load absorbed in ~25–30 minutes.
   * absorbed = unabsorbed × (1 − e^(−ka × hours))
   */
  absorptionKaPerHour: 4.5,

  /**
   * Tiny instant bump when swallowing (oral mucosa) as a fraction of the
   * portion's ethanol — rest goes to the gut pool. 0 = fully delayed.
   */
  immediateAbsorbFraction: 0.08,

  /**
   * Multipliers on ka by drinking pace (slam hits the blood faster).
   */
  absorptionKaByPace: {
    slam: 1.35,
    quick: 1.15,
    moderate: 1,
    casual: 0.85,
    sip: 0.7,
  } as const,

  /**
   * Paced drinking rates (ml / minute) while a beverage is held.
   * Slam is special: finishes whatever remains in `slamMinutes` (default 1).
   */
  paceMlPerMinute: {
    quick: 90,
    moderate: 45,
    casual: 25,
    sip: 10,
  } as const,
  /** Slam drains the entire remaining serving over this many minutes. */
  slamMinutes: 1,

  /**
   * Discrete mouth actions — consume this many ml from the held drink
   * without advancing world time (no metabolism tick).
   */
  sipActionMl: {
    gulp: 45,
    mouthful: 20,
    sip: 8,
  } as const,

  /**
   * Intoxication stage thresholds (BAC ≥ value → stage).
   * Ordered ascending; last match wins.
   */
  stages: [
    { id: 'Sober', minBac: 0 },
    { id: 'Buzzed', minBac: 0.02 },
    { id: 'Tipsy', minBac: 0.05 },
    { id: 'Drunk', minBac: 0.08 },
    { id: 'Wasted', minBac: 0.15 },
    { id: 'Dangerous', minBac: 0.25 },
  ] as const,
} as const;

export type IntoxicationStageId = (typeof BAC_TUNING.stages)[number]['id'];
