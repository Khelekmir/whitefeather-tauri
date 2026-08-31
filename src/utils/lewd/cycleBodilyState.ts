import { LEWD_TUNING as T } from './lewdTuning';
import {
  fertileCrest01,
  type HormoneSnapshot,
} from './ovulationCycle';

/**
 * Derived cervical-mucus / wetness / genital-sensitivity state.
 * Ported day-bands from Coding_Notes/.../cycle/discharge.md — not a durable meter.
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
  /** Ambient lubrication 0–1 (felt as wetness, not climax fluid). */
  wetness01: number;
  /** Runtime mult for genital/vulvic target sensitivity. */
  genitalSensMult: number;
  /** 0–1 fertile crest (shared with stim / impregnation). */
  fertileCrest01: number;
  blurb: string;
}

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

function wetnessFor(
  kind: MucusKind,
  crest: number,
  estrogen: number
): number {
  const base: Record<MucusKind, number> = {
    bloody: 0.35,
    scarce: 0.18,
    sticky: 0.32,
    eggWhite: 0.78,
    cloudy: 0.4,
    dry: 0.12,
  };
  const eBoost = Math.min(0.12, Math.log(Math.max(1, estrogen)) * 0.04);
  return Math.max(0, Math.min(1, base[kind] + crest * 0.18 + eBoost));
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
