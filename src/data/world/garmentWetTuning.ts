/**
 * Coarse garment environment wetness (rain + heat-stress sweat).
 * Bounded: one envWet01 per cloth item — not per soil region/kind.
 */

import type { ItemSlot } from '../../types/items';

/** Slots that can hold rain/sweat damp (weapons / jewelry skipped). */
export const GARMENT_WET_SLOTS: readonly ItemSlot[] = [
  'undershirt',
  'underwear',
  'head',
  'shoulder',
  'back',
  'chest',
  'shirt',
  'wrist',
  'hand',
  'waist',
  'leg',
  'shin',
  'foot',
] as const;

export const GARMENT_WET_TUNING = {
  /**
   * Rain soak approach rate toward rain target (per hour, worn).
   * ≈3.5 → ~97% of target in 1h from dry (pairs with climate precip bands).
   */
  rainSoakPerHour: 3.5,
  /**
   * Once the worn cloak’s envWet01 reaches this, covered slots take
   * `cloakSaturatedThrough` of precip through the cloth; uncovered still full.
   * Below threshold: rainTarget = precip × (1 − slotCoverage).
   * Storm-level precip nullifies coverage (see precipCoverageOverwhelm).
   */
  cloakSaturateAt: 0.5,
  /** Fraction of precip that reaches covered layers when cloak is ≥50% wet. */
  cloakSaturatedThrough: 0.15,
  /** Cloak/back itself takes full precip when raining. */
  cloakRainMult: 1,
  /**
   * At precip ≥ overwhelmStart, cloak wrap coverage fades to 0 by precip=1
   * so storm can fully soak clothing in ~1h.
   */
  precipCoverageOverwhelmStart: 0.75,

  /**
   * Underclothes stay rain-dry until their worn overlayer is past this envWet.
   * - undershirt (bra) ← shirt (tunic/dress); else chest
   * - underwear (panties) ← leg; else shirt when bare-legged under a dress
   * Sweat still damps underclothes from the inside (not gated).
   */
  overlayerSaturateAt: 0.5,

  /**
   * Heat-stress sweat write (per hour toward heatStress-scaled targets).
   * Biases skin-adjacent cloth.
   */
  sweatSoakPerHour: 0.85,
  sweatSlotMult: {
    underwear: 1,
    undershirt: 0.85,
    shirt: 0.7,
    chest: 0.55,
    leg: 0.3,
    waist: 0.25,
    back: 0.15,
    foot: 0.2,
    // others default low via fallback
  } as Partial<Record<ItemSlot, number>>,
  sweatFallbackMult: 0.08,
  /** heatStress below this writes no sweat damp. */
  sweatHeatFloor: 0.06,

  /** Passive dry rates (exponential approach toward 0). */
  dryWornPerHour: 0.1,
  dryDoffedPerHour: 0.28,
  /** Sheltered / indoors dry boost while doffed. */
  dryShelteredMult: 1.35,
  /** Rain while worn slows drying. */
  dryRainPenalty: 0.55,

  /**
   * Fire-dry lab action: strong one-shot dry on unequipped wet pieces.
   * approach(wet, 0, rate) with hours=1 equivalent.
   */
  fireDryRate: 2.4,
  /** Minimum envWet to show in UI / count as damp. */
  dampThreshold: 0.04,
  soakedThreshold: 0.55,

  /**
   * Evaporative chill into felt ambient while wet clothes are worn (°F at wet=1, wind=1).
   * Helps in heat, hurts in cold.
   */
  evaporativeMaxF: 9,
  /** Weight worn wetness when averaging (cloak a bit less skin-coupled). */
  evaporativeSlotWeight: {
    underwear: 1.1,
    undershirt: 1,
    shirt: 0.95,
    chest: 0.85,
    leg: 0.9,
    back: 0.55,
    foot: 0.35,
  } as Partial<Record<ItemSlot, number>>,
  evaporativeFallbackWeight: 0.45,
  /** Sheltered cuts evaporative effect (less wind / still air). */
  evaporativeShelteredMult: 0.35,
} as const;
