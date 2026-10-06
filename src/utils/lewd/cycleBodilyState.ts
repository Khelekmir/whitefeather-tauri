import type { Unit as DetailedUnit } from '../../types/characters';
import { LEWD_TUNING as T } from './lewdTuning';
import { blendOrificeSlick } from './orificeSlick';
import {
  fertileCrest01,
  hormonesForUnit,
  type HormoneSnapshot,
} from './ovulationCycle';

/**
 * Derived cervical-mucus / wetness / genital-sensitivity state.
 * Ported day-bands from Coding_Notes/.../cycle/discharge.md — not a durable meter.
 *
 * Felt wetness contract (rate → accumulation → state):
 * - cycle ambient wetness01 = floor bias ("naturally slick today")
 * - lubricationRate01 = secretion rate mult while aroused (not readiness)
 * - orificeSlick.vagina = accumulated fluid (truth)
 * - felt = floor (+ lust nudge) + orifice map → readiness state
 * - readinessWetness (1.0) = penetration-ready; oversat above → heavier weep
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
   * Cycle-only ambient lubrication floor.
   * Peak ovulation alone stays below readiness so play still matters.
   */
  wetness01: number;
  /**
   * Secretion rate mult from mucus / crest / estrogen (not a meter).
   * Multiplies arousal-gated vaginal secretion.
   */
  lubricationRate01: number;
  /** Runtime mult for genital/vulvic target sensitivity. */
  genitalSensMult: number;
  /** 0–1 fertile crest (shared with stim / impregnation). */
  fertileCrest01: number;
  blurb: string;
}

/** Inputs for deriving felt readiness from floor + orifice accumulation. */
export interface ArousalWetnessInput {
  /** Standing lust 0–100 — mild floor nudge + idle trickle elsewhere. */
  lust?: number;
  /**
   * @deprecated Encounter arousal gates secretion; no longer adds felt directly.
   * Accepted for call-site compatibility; ignored in felt math.
   */
  encounterArousal?: number;
  /** Reserved mild desire / mood floor nudge 0–1. */
  desireMood01?: number;
  /**
   * Accumulated orificeSlick.vagina wet01 (fluid truth).
   * Required for readiness climb beyond ambient floor.
   */
  orificeWet01?: number;
}

/**
 * Cycle ambient floor + lust nudge + orifice accumulation → felt readiness.
 */
export interface FeltWetnessReport {
  /** Cycle-only ambient floor. */
  cycleWetness: number;
  /** Mild lust floor nudge. */
  lustBoost: number;
  /** Always 0 — encounter no longer adds felt directly. */
  encounterBoost: number;
  desireMoodBoost: number;
  /** lust + desireMood floor nudges (not encounter). */
  arousalBoost: number;
  /** orificeSlick.vagina wet01 used in this derive. */
  orificeWet01: number;
  /** Felt contribution from orifice accumulation. */
  secretedFelt: number;
  /** Cycle lubrication rate mult (informational on report). */
  lubricationRate01: number;
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
 * Cycle ambient floor — kept below readiness at peak so play still matters.
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

/** Secretion rate mult from mucus / crest / estrogen (moderate fertile advantage). */
export function lubricationRateFor(
  kind: MucusKind,
  crest: number,
  estrogen: number
): number {
  const R = T.cycle.lubricationRate;
  const mucus = R.byMucus[kind] ?? 0.6;
  const eBoost = Math.min(
    R.estrogenBonusCap,
    Math.log(Math.max(1, estrogen)) * 0.04
  );
  const raw = mucus + crest * R.crestBonus + eBoost;
  return Math.max(R.rateMin, Math.min(R.rateMax, raw));
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
    lubricationRate01: lubricationRateFor(mucusKind, crest, h.estrogen),
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
 * Derive felt readiness from ambient floor + lust nudge + orifice accumulation.
 * Encounter arousal is ignored here (gates secretion elsewhere).
 */
export function feltWetness(
  cycleWetness: number,
  input?: ArousalWetnessInput & { lubricationRate01?: number }
): FeltWetnessReport {
  const W = T.cycle.arousalWetness;
  const ready = T.cycle.readinessWetness;
  const lust01 = clamp01((input?.lust ?? 0) / 100);
  const desireMood01 = clamp01(input?.desireMood01 ?? 0);
  const orificeWet01 = Math.max(0, input?.orificeWet01 ?? 0);

  const lustFloorMax = W.lustFloorNudgeMax ?? W.lustBoostMax ?? 0.08;
  const lustBoost = lust01 * lustFloorMax;
  const encounterBoost = 0;
  const desireMoodBoost = desireMood01 * W.desireMoodBoostMax;
  const arousalBoost = lustBoost + desireMoodBoost;
  const cycle = Math.max(0, cycleWetness);
  const secretedFelt = orificeWet01 * (W.secretedToFeltMult ?? 1);
  const felt = clampFelt(cycle + arousalBoost + secretedFelt);
  const readiness01 = clamp01(felt / Math.max(0.01, ready));

  return {
    cycleWetness: cycle,
    lustBoost,
    encounterBoost,
    desireMoodBoost,
    arousalBoost,
    orificeWet01,
    secretedFelt,
    lubricationRate01: Math.max(0, input?.lubricationRate01 ?? 0),
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

/** Convenience: cycle + lust floor nudge + orificeSlick.vagina → felt readiness. */
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
  const orificeWet01 = blendOrificeWet01(unit);
  return feltWetness(bodily.wetness01, {
    lust: unit.lewdStats.dynamic.lust ?? 0,
    encounterArousal: opts?.encounterArousal,
    desireMood01: opts?.desireMood01,
    orificeWet01,
    lubricationRate01: bodily.lubricationRate01,
  });
}

function blendOrificeWet01(unit: DetailedUnit): number {
  return blendOrificeSlick(unit.lewdStats.dynamic.orificeSlick?.vagina).wet01;
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
