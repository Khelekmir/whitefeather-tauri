/**
 * ♂ encounter-local erection + pre-ejaculate beads.
 * Erotic reward mirror of ♀ wetness: firmness from arousal, tiny cloth precum,
 * larger wet spot only on climax into under/underneath genital clothes.
 */

import type { Unit as DetailedUnit } from '../../types/characters';
import type { ClothingAccessMode } from './clothingAccess';
import type { LewdChannel } from './lewdChannels';
import { LEWD_TUNING as T } from './lewdTuning';
import {
  getEquippedItem,
  normalizeSoilBag,
  soilBagForRegion,
  soilIntensity,
} from './fluidSoil';

export type ErectionBand = 'flaccid' | 'swelling' | 'firm' | 'rigid';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function arousalGate01(arousal: number, lo: number, hi: number): number {
  if (arousal <= lo) return 0;
  if (arousal >= hi) return 1;
  const t = (arousal - lo) / Math.max(0.01, hi - lo);
  return t * t * (3 - 2 * t);
}

export function isMaleGenitalPart(part: string): boolean {
  return /^(penis|testicles|urethra)/i.test(part);
}

export function erectionBand(erection01: number): ErectionBand {
  const M = T.encounter.maleErection;
  const e = clamp01(erection01);
  if (e < M.bandSwelling) return 'flaccid';
  if (e < M.bandFirm) return 'swelling';
  if (e < M.bandRigid) return 'firm';
  return 'rigid';
}

export function erectionBandLabel(band: ErectionBand): string {
  switch (band) {
    case 'flaccid':
      return 'soft';
    case 'swelling':
      return 'swelling';
    case 'firm':
      return 'firm';
    case 'rigid':
      return 'rigid';
  }
}

/** Target firmness 0–1 from arousal + edge (before refractory collapse). */
export function erectionTarget01(
  arousal: number,
  edge: number,
  refractory: boolean
): number {
  const M = T.encounter.maleErection;
  if (refractory) return 0;
  const fromArousal = arousalGate01(arousal, M.arousalOnset, M.arousalFull);
  const fromEdge = clamp01(edge / 100) * M.edgeFirmWeight;
  return clamp01(fromArousal * (1 - M.edgeFirmWeight) + fromArousal * M.edgeFirmWeight + fromEdge);
}

/** Integrate erection01 toward target over dt. */
export function integrateErection01(
  prev: number,
  arousal: number,
  edge: number,
  refractory: boolean,
  dt: number
): number {
  const M = T.encounter.maleErection;
  const cur = clamp01(prev);
  const target = erectionTarget01(arousal, edge, refractory);
  const rate =
    target >= cur
      ? M.risePerSec
      : M.fallPerSec * (refractory ? M.refractoryFallMult : 1);
  if (dt <= 0) return cur;
  const step = rate * dt;
  if (Math.abs(target - cur) <= step) return target;
  return clamp01(cur + Math.sign(target - cur) * step);
}

export interface MaleGenitalClothContext {
  /** Any penis/testicles contact this beat. */
  genitalContact: boolean;
  /** under / underneath on male genital locus — climax dumps into worn cloth. */
  dumpIntoClothes: boolean;
  access: ClothingAccessMode | null;
}

/** How channels touch a male's genitals (as target or penis actor). */
export function maleGenitalClothContext(
  channels: LewdChannel[]
): MaleGenitalClothContext {
  let genitalContact = false;
  let dumpIntoClothes = false;
  let access: ClothingAccessMode | null = null;
  for (const ch of channels) {
    const mode = ch.clothingAccess ?? 'over';
    const hit =
      isMaleGenitalPart(ch.targetPart) || isMaleGenitalPart(ch.actorPart);
    if (!hit) continue;
    genitalContact = true;
    access = mode;
    if (mode === 'under' || mode === 'underneath') {
      dumpIntoClothes = true;
    }
  }
  return { genitalContact, dumpIntoClothes, access };
}

/** Current underwear crotch semen-channel score (0–100). */
export function maleUnderwearSemenScore(unit: DetailedUnit): number {
  const item = getEquippedItem(unit, 'underwear');
  if (!item) return 0;
  const bag = normalizeSoilBag(soilBagForRegion(item, 'crotch'));
  return soilIntensity(bag.semen);
}

/**
 * Precum volume01 this beat, soft-capped so cloth stays ≤ small coin.
 * Returns 0 when flaccid / cold / already at cap.
 */
export function computePrecumVolume01(input: {
  erection01: number;
  encounterArousal: number;
  genitalContact: boolean;
  holdSeconds: number;
  beatQuality01?: number;
  /** Current underwear semen score (for coin cap). */
  underwearSemenScore?: number;
}): { volume01: number; ratePerSec: number; gate01: number; capped: boolean } {
  const P = T.encounter.maleErection.precum;
  const empty = { volume01: 0, ratePerSec: 0, gate01: 0, capped: false };
  if (input.erection01 < P.minErection01) return empty;

  const gate01 = arousalGate01(
    input.encounterArousal,
    P.secreteArousalBelow,
    P.secreteArousalFull
  );
  if (gate01 < 0.02) return empty;

  const q = clamp01(input.beatQuality01 ?? 0.7);
  const qualityMult = 1 - P.beatQualityWeight + P.beatQualityWeight * q;
  const contactMult = input.genitalContact
    ? P.genitalBeadMult
    : P.nonGenitalBeadMult;
  const ratePerSec =
    P.baseBeadPerSec * gate01 * contactMult * qualityMult * input.erection01;
  const hold = Math.max(0.5, input.holdSeconds);
  let volume01 = ratePerSec * hold;

  const score = input.underwearSemenScore ?? 0;
  const roomScore = Math.max(0, P.clothScoreCap - score);
  // applyWetSoil / seepage treat volume01 × ~100 as wet points.
  const maxVol = roomScore / 100;
  let capped = false;
  if (volume01 > maxVol) {
    volume01 = maxVol;
    capped = true;
  }
  if (volume01 < 0.0004) return { ...empty, gate01, ratePerSec, capped };

  return { volume01, ratePerSec, gate01, capped };
}

export function precumFlavorNote(opts: {
  volume01: number;
  erection01: number;
  capped: boolean;
}): string | null {
  if (opts.volume01 < 0.0004) return null;
  const band = erectionBand(opts.erection01);
  if (opts.capped) return `precum bead · ${band} (coin damp)`;
  return `precum beading · ${band}`;
}
