/**
 * Body temperature (°F) — core + peripheral skin + heat-stress stub.
 * Driven by weather exposure; sweat→cloth soil is a later pass.
 */

export const BODY_TEMP_TUNING = {
  /** Resting homeostasis target. */
  normalCoreF: 98.6,

  /** Typical room-temp skin when core is normal. */
  defaultSkinHandsF: 90,
  defaultSkinFaceF: 93,

  /** Soft ambient comfort band (°F felt). */
  comfortAmbientF: 68,
  /** Below this felt ambient, core target starts to sag. */
  coldStressStartF: 58,
  /** Above this felt ambient, core target starts to rise. */
  heatStressStartF: 78,

  /** How hard cold/heat pull the core setpoint (°F core per °F ambient past threshold). */
  coldPullPerAmbientF: 0.055,
  heatPullPerAmbientF: 0.04,

  /** Absolute core clamps. */
  minCoreF: 94,
  maxCoreF: 103.5,

  /** Skin clamps (extremities can run colder than core). */
  minSkinF: 48,
  maxSkinF: 102,

  /**
   * Wet chill: feltAmbient = effectiveAmbient − wetPressure × this.
   * Rain + soaked ground cools harder than dry cold.
   */
  wetChillMaxF: 10,

  /**
   * Base exponential approach rates toward targets (per hour).
   * Skin is much faster than core.
   */
  coreApproachPerHour: 0.22,
  skinHandsApproachPerHour: 1.4,
  skinFaceApproachPerHour: 1.05,

  /** Extra core cooling rate multiplier from wetPressure when falling. */
  wetCoreCoolMult: 1.55,

  /**
   * Heat-stress meter: rises when core/ambient are hot; decays when cool.
   * Sweat → garment envWet01 via advanceGarmentWetness.
   */
  heatStress: {
    coreStartF: 99.15,
    risePerHourAtHot: 0.55,
    decayPerHour: 0.35,
    /** Ambient contribution above heatStressStartF. */
    ambientRiseScale: 0.018,
  },

  /** Physique reference point for rate scaling. */
  ref: {
    weightLb: 150,
    heightIn: 66,
    constitution: 7,
  },

  /**
   * Sex modifiers on rates (relative to neutral).
   * Females: faster extremity skin response.
   * Males: slightly more core thermal inertia.
   */
  sex: {
    F: { coreInertia: 0.96, skinRate: 1.12 },
    M: { coreInertia: 1.08, skinRate: 0.94 },
  } as const,

  /** Labels / narrative bands (core °F). */
  bands: {
    hypothermic: 95.5,
    cold: 96.8,
    cool: 97.6,
    normalLow: 98.0,
    normalHigh: 99.0,
    warm: 99.8,
    hot: 100.8,
  },
} as const;
