import type { Unit as DetailedUnit } from '../../types/characters';
import { LEWD_TUNING as T } from './lewdTuning';
import {
  fertileCrest01,
  hormonesForUnit,
  type HormoneSnapshot,
} from './ovulationCycle';

/**
 * Derived cervical-mucus / wetness / genital-sensitivity state.
 * Ported day-bands from Coding_Notes/.../cycle/discharge.md — not a durable meter.
 *
 * Felt wetness contract:
 * - readinessWetness (1.0) = penetration-ready lubrication
 * - values above 1.0 (up to wetnessCap) = oversaturation → heavier drip / seepage
 * - clothes may damp below readiness; 1.0 is not the soil gate
 *
 * Later: lubrication gates vaginal/anal penetration comfort (size × intensity).
 */
export type MucusKind =
  | 'bloody'
  | 'scarce'
  | 'sticky'
  | 'eggWhite'
  | 'cloudy'
  | 'dry';

export interface CycleBodilyState {
  mucusKind: MucusKind;
  /**
   * Cycle-only ambient lubrication (lowered so lust/arousal have headroom).
   * Peak ovulation alone stays below readiness.
   */
  wetness01: number;
  /** Runtime mult for genital/vulvic target sensitivity. */
  genitalSensMult: number;
  /** 0–1 fertile crest (shared with stim / impregnation). */
  fertileCrest01: number;
  blurb: string;
}

/** Optional arousal / mood inputs layered onto cycle ambient wetness. */
export interface ArousalWetnessInput {
  /** Standing lust 0–100 (unit.lewdStats.dynamic.lust). */
  lust?: number;
  /** Ephemeral encounter arousal 0–100. */
  encounterArousal?: number;
  /**
   * Reserved mild desire / mood contribution 0–1.
   * Hook for later; defaults to 0 when omitted.
   */
  desireMood01?: number;
}

/**
 * Cycle ambient + arousal boosts → felt vaginal wetness.
 * Players discover: daydream / stim → arousal ↑ → slick ↑ → cloth dampens.
 */
export interface FeltWetnessReport {
  /** Cycle-only ambient. */
  cycleWetness: number;
  lustBoost: number;
  encounterBoost: number;
  desireMoodBoost: number;
  /** Sum of arousal-side boosts before clamp. */
  arousalBoost: number;
  /** Felt slick clamped to wetnessCap (may exceed readiness 1.0). */
  feltWetness: number;
  /** 0–1 progress toward penetration-ready (felt / readiness, capped at 1). */
  readiness01: number;
  /** True when felt exceeds readiness (oversaturation). */
  oversaturated: boolean;

  /** @deprecated alias — cycleWetness */
  cycleWetness01: number;
  /** @deprecated alias — lustBoost */
  lustBoost01: number;
  /** @deprecated alias — encounterBoost */
  encounterBoost01: number;
  /** @deprecated alias — desireMoodBoost */
  desireMoodBoost01: number;
  /** @deprecated alias — arousalBoost */
  arousalBoost01: number;
  /** @deprecated alias — feltWetness (may be >1) */
  effectiveWetness01: number;
}

/** @deprecated use FeltWetnessReport */
export type EffectiveWetnessReport = FeltWetnessReport;

const MUCUS_BLURB: Record<MucusKind, string> = {
  bloody: 'Menstrual flow — the body is shedding, not inviting.',
  scarce: 'Discharge is light; the body is quiet after the bleed.',
  sticky: 'Mucus turns cloudy and tacky as a follicle ripens.',
  eggWhite: 'Thin, slippery egg-white mucus — fertile and unmistakably ready.',
  cloudy: 'Mucus thickens again; the fertile crest has passed.',
  dry: 'Little discharge; luteal quiet before the next bleed.',
};

/**
 * Scaled day-of-cycle bands (28-day reference → character length).
 * 1–5 bloody · 6–12 sticky/scarce · 13–15 eggWhite · 16–22 cloudy · 23–28 dry.
 */
export function mucusKindForDay(day: number, lengthDays: number): MucusKind {
  const scale = Math.max(1, lengthDays) / 28;
  const d = day; // fractional ok
  if (d < 5 * scale) return 'bloody';
  if (d < 6.5 * scale) return 'scarce';
  if (d < 12.5 * scale) return 'sticky';
  if (d < 15.5 * scale) return 'eggWhite';
  if (d < 22.5 * scale) return 'cloudy';
  return 'dry';
}

/**
 * Cycle ambient only — kept below readiness at peak so lust/arousal can still move the needle.
 * Illustrative peak eggWhite ≈ 0.48 + crest×0.12 + E boost ≤ ~0.68.
 */
function wetnessFor(
  kind: MucusKind,
  crest: number,
  estrogen: number
): number {
  const base: Record<MucusKind, number> = {
    bloody: 0.22,
    scarce: 0.1,
    sticky: 0.2,
    eggWhite: 0.48,
    cloudy: 0.26,
    dry: 0.08,
  };
  const eBoost = Math.min(0.08, Math.log(Math.max(1, estrogen)) * 0.025);
  return Math.max(0, Math.min(1, base[kind] + crest * 0.12 + eBoost));
}

export function bodilyStateFromHormones(
  h: HormoneSnapshot,
  lengthDays: number
): CycleBodilyState {
  const crest = fertileCrest01(h, lengthDays);
  const mucusKind = mucusKindForDay(h.day, lengthDays);
  const C = T.cycle;
  const genitalSensMult =
    C.genitalSensFloor +
    (C.genitalSensCrest - C.genitalSensFloor) * crest;

  return {
    mucusKind,
    wetness01: wetnessFor(mucusKind, crest, h.estrogen),
    genitalSensMult,
    fertileCrest01: crest,
    blurb: MUCUS_BLURB[mucusKind],
  };
}

/** Vulvic / genital targets that should feel cycle sensitivity. */
export function isCycleSensitiveTarget(partId: string): boolean {
  return /^(clitoris|labia|mons|vagina|urethra|perin|penis|testicles)/i.test(
    partId
  );
}

/**
 * Female physio mult from mild E/P + fertile crest.
 * Genital targets get full crest; other zones get a muted echo.
 */
export function cyclePhysioMult(input: {
  hormones: HormoneSnapshot;
  lengthDays: number;
  genitalTarget: boolean;
}): number {
  const { hormones: h, lengthDays, genitalTarget } = input;
  const C = T.cycle;
  const crest = fertileCrest01(h, lengthDays);
  const ep =
    Math.pow(Math.max(0.5, h.estrogen), C.estrogenExp) /
    Math.pow(Math.max(0.5, h.progesterone), C.progesteroneExp);
  const crestShare = genitalTarget ? 1 : C.nonGenitalCrestShare;
  const crestBonus =
    1 + (C.crestPhysioMax - 1) * crest * crestShare;
  return ep * crestBonus;
}

export function encounterCycleReceptivityMult(crest01: number): number {
  const C = T.cycle;
  return (
    C.encounterRecvFloor +
    (C.encounterRecvCrest - C.encounterRecvFloor) * crest01
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clampFelt(n: number): number {
  const cap = T.cycle.wetnessCap;
  return Math.max(0, Math.min(cap, n));
}

/**
 * Layer lust / encounter arousal / optional desire-mood onto cycle ambient wetness.
 * May exceed readiness (1.0) up to wetnessCap when arousal is strong/persistent.
 */
export function feltWetness(
  cycleWetness: number,
  input?: ArousalWetnessInput
): FeltWetnessReport {
  const W = T.cycle.arousalWetness;
  const ready = T.cycle.readinessWetness;
  const lust01 = clamp01((input?.lust ?? 0) / 100);
  const enc01 = clamp01((input?.encounterArousal ?? 0) / 100);
  const desireMood01 = clamp01(input?.desireMood01 ?? 0);

  const lustBoost = lust01 * W.lustBoostMax;
  const encounterBoost = enc01 * W.encounterBoostMax;
  const desireMoodBoost = desireMood01 * W.desireMoodBoostMax;
  const arousalBoost = lustBoost + encounterBoost + desireMoodBoost;
  const cycle = Math.max(0, cycleWetness);
  const felt = clampFelt(cycle + arousalBoost);
  const readiness01 = clamp01(felt / Math.max(0.01, ready));

  return {
    cycleWetness: cycle,
    lustBoost,
    encounterBoost,
    desireMoodBoost,
    arousalBoost,
    feltWetness: felt,
    readiness01,
    oversaturated: felt > ready + 1e-6,
    cycleWetness01: cycle,
    lustBoost01: lustBoost,
    encounterBoost01: encounterBoost,
    desireMoodBoost01: desireMoodBoost,
    arousalBoost01: arousalBoost,
    effectiveWetness01: felt,
  };
}

/** @deprecated use feltWetness */
export function effectiveWetness01(
  cycleWetness01: number,
  input?: ArousalWetnessInput
): FeltWetnessReport {
  return feltWetness(cycleWetness01, input);
}

/** Convenience: cycle bodily state + unit lust / optional encounter → felt slick. */
export function feltWetnessForUnit(
  unit: DetailedUnit,
  opts?: {
    encounterArousal?: number;
    desireMood01?: number;
    /** Precomputed cycle state; recomputed from hormones when omitted. */
    bodily?: CycleBodilyState | null;
  }
): FeltWetnessReport | null {
  if (unit.sex !== 'F') return null;
  const bodily =
    opts?.bodily ??
    (() => {
      const h = hormonesForUnit(unit);
      if (!h) return null;
      return bodilyStateFromHormones(
        h,
        unit.lewdStats.static.ovulationCycleLength || 28
      );
    })();
  if (!bodily) return null;
  return feltWetness(bodily.wetness01, {
    lust: unit.lewdStats.dynamic.lust ?? 0,
    encounterArousal: opts?.encounterArousal,
    desireMood01: opts?.desireMood01,
  });
}

/** @deprecated use feltWetnessForUnit */
export function effectiveWetnessForUnit(
  unit: DetailedUnit,
  opts?: {
    encounterArousal?: number;
    desireMood01?: number;
    bodily?: CycleBodilyState | null;
  }
): FeltWetnessReport | null {
  return feltWetnessForUnit(unit, opts);
}
