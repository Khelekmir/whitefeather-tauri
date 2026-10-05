import type { Unit as DetailedUnit } from '../../types/characters';
import {
  parseTemperament,
  type TemperamentPrimary,
} from '../../data/social/temperaments';
import { LEWD_TUNING as T } from './lewdTuning';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Temperament mult on how far arousal may push preferred intensity.
 * Blended like standing-lust expression (primary weight ~0.65).
 */
export function temperamentIntensityWarp(temperamentRaw: string): number {
  const table = T.intensityWarp.temperament;
  const t = parseTemperament(temperamentRaw);
  const p = table[t.primary as TemperamentPrimary] ?? 1;
  const s = table[t.secondary as TemperamentPrimary] ?? 1;
  const w = t.primaryWeight ?? 0.65;
  return Math.max(0.7, Math.min(1.3, p * w + s * (1 - w)));
}

/** Combined heat 0–1 from encounter arousal + standing lust. */
export function intensityHeat01(
  encounterArousal: number,
  lust: number
): number {
  const W = T.intensityWarp;
  return clamp01(
    W.encounterArousalWeight * clamp01(encounterArousal / 100) +
      W.lustWeight * clamp01(lust / 100)
  );
}

/** How many intensity ranks full heat can add above baseline for this unit. */
export function hotSpanForUnit(unit: DetailedUnit): number {
  const W = T.intensityWarp;
  const lib = Math.max(1, Math.min(10, unit.lewdStats.static.libido ?? 5));
  const gain = unit.lewdStats.static.intensityArousalGain ?? 1;
  const temper = temperamentIntensityWarp(
    unit.socialStats.static.temperament
  );
  return Math.max(
    0,
    (W.spanFloor + W.spanPerLibido * (lib / 5)) * temper * gain
  );
}

export interface WarpedPreferredIntensityInput {
  /** Bruise-adjusted baseline preferred intensity (not yet heat-warped). */
  basePreferred: number;
  maxIntensity: number;
  unit: DetailedUnit;
  encounterArousal: number;
}

export interface WarpedPreferredIntensityResult {
  basePreferred: number;
  preferredNow: number;
  heat01: number;
  hotSpan: number;
  /** Ranks added by heat (preferredNow − base, floored at 0). */
  climb: number;
}

/**
 * Preferred intensity “now”: baseline sweet spot + heat climb, capped by maxIntensity.
 * Cold → near base; hot → wants firmer contact (character span varies).
 */
export function warpedPreferredIntensity(
  input: WarpedPreferredIntensityInput
): WarpedPreferredIntensityResult {
  const W = T.intensityWarp;
  const lust = input.unit.lewdStats.dynamic.lust ?? 0;
  const heat01 = intensityHeat01(input.encounterArousal, lust);
  const hotSpan = hotSpanForUnit(input.unit);
  const shaped =
    W.warpCurve === 1 ? heat01 : Math.pow(heat01, Math.max(0.25, W.warpCurve));
  const climb = hotSpan * shaped;
  const preferredNow = Math.max(
    W.minPreferred,
    Math.min(input.maxIntensity, input.basePreferred + climb)
  );
  return {
    basePreferred: input.basePreferred,
    preferredNow,
    heat01,
    hotSpan,
    climb: Math.max(0, preferredNow - input.basePreferred),
  };
}
