import type { Unit as DetailedUnit } from '../../types/characters';
import type { FluidSoilBag } from '../../types/items';
import {
  getEquippedItem,
  normalizeSoilBag,
  soilIntensity,
} from './fluidSoil';

/** Visual / tactile size of the damp patch on the crotch panel. */
export type WetPatchSize =
  | 'none'
  | 'pinprick'
  | 'coin'
  | 'palm'
  | 'soaked';

/**
 * What the dampness reads as.
 * `semenDominant` = mostly seed, little of her slick (cold deposit / just landed).
 * Contextually often becomes `mixed` once she is elevated.
 */
export type WetPatchContents =
  | 'clean'
  | 'arousalOnly'
  | 'mixed'
  | 'semenDominant';

export type WetFreshness = 'fresh' | 'tacky' | 'dried';

export interface UnderwearWetnessReport {
  size: WetPatchSize;
  contents: WetPatchContents;
  freshness: WetFreshness;
  /** Combined arousal-related wet intensity 0–100. */
  arousalScore: number;
  /** Semen intensity 0–100. */
  semenScore: number;
  /** Total relevant patch score 0–100. */
  totalScore: number;
  /** Short lab tag, e.g. "palm · mixed · fresh". */
  label: string;
  /** Player-facing flavor sentence. */
  flavor: string;
}

function sizeFromScore(score: number): WetPatchSize {
  // Scores are 0–100 wet+dry intensity on the crotch panel.
  if (score < 4) return 'none';
  if (score < 12) return 'pinprick'; // hint / bead
  if (score < 28) return 'coin'; // noticeable damp circle
  if (score < 55) return 'palm'; // broad crotch dampness
  return 'soaked'; // heavy, obvious through outer layers later
}

function freshnessFrom(wet: number, dry: number): WetFreshness {
  const t = wet + dry;
  if (t < 1) return 'fresh';
  const wetShare = wet / t;
  if (wetShare >= 0.55) return 'fresh';
  if (wetShare >= 0.22) return 'tacky';
  return 'dried';
}

function contentsFrom(semen: number, arousal: number): WetPatchContents {
  const hasSemen = semen >= 3.5;
  const hasArousal = arousal >= 4.5;
  if (!hasSemen && !hasArousal) return 'clean';
  if (!hasSemen && hasArousal) return 'arousalOnly';
  if (hasSemen && hasArousal) return 'mixed';
  return 'semenDominant';
}

/** Size noun phrase already colored by freshness — avoids “soaked … dried”. */
function sizePhrase(size: Exclude<WetPatchSize, 'none'>, freshness: WetFreshness): string {
  if (freshness === 'fresh') {
    switch (size) {
      case 'pinprick':
        return 'a pinprick of slick dampness';
      case 'coin':
        return 'a coin-sized slick patch';
      case 'palm':
        return 'a palm-broad wet blot';
      case 'soaked':
        return 'a heavily soaked crotch panel';
    }
  }
  if (freshness === 'tacky') {
    switch (size) {
      case 'pinprick':
        return 'a pinprick tacky spot';
      case 'coin':
        return 'a coin-sized tacky patch';
      case 'palm':
        return 'a palm-broad tacky stain';
      case 'soaked':
        return 'a large tacky stain across the panel';
    }
  }
  // dried — size is extent of the mark, not active wetness
  switch (size) {
    case 'pinprick':
      return 'a pinprick crusted fleck';
    case 'coin':
      return 'a coin-sized dried mark';
    case 'palm':
      return 'a palm-broad dried stain';
    case 'soaked':
      return 'a broad crusted stain that once soaked the panel';
  }
}

function synthesizeFlavor(
  size: WetPatchSize,
  contents: WetPatchContents,
  freshness: WetFreshness
): string {
  if (size === 'none' || contents === 'clean') {
    return 'The crotch of her undergarment is dry.';
  }
  const patch = sizePhrase(size, freshness);
  const feel =
    freshness === 'fresh'
      ? 'still cool and slick'
      : freshness === 'tacky'
        ? 'going tacky as it cools'
        : 'set into a faint crust';

  switch (contents) {
    case 'arousalOnly':
      return `${patch} marks the cloth with her own arousal — feminine slick only, ${feel}.`;
    case 'mixed':
      return `${patch} holds both of them: pearly semen thinned through her arousal, ${feel}.`;
    case 'semenDominant':
      return `${patch} reads mostly as seed — thick semen with little of her own wetness mixed in, ${feel}.`;
    default:
      return 'The crotch of her undergarment is dry.';
  }
}

/** Quantify + flavor the underwear crotch panel (arousal / semen focus). */
export function describeUnderwearWetness(
  unit: DetailedUnit
): UnderwearWetnessReport {
  const item = getEquippedItem(unit, 'underwear');
  const cloth: FluidSoilBag = normalizeSoilBag(item?.lewdStats.soiled);

  const semenScore = soilIntensity(cloth.semen);
  const arousalScore =
    soilIntensity(cloth.arousalFluid) +
    soilIntensity(cloth.vaginalDischarge) * 0.55;

  const wetPool =
    cloth.semen.wet + cloth.arousalFluid.wet + cloth.vaginalDischarge.wet * 0.55;
  const dryPool =
    cloth.semen.dry + cloth.arousalFluid.dry + cloth.vaginalDischarge.dry * 0.55;

  const totalScore = Math.min(100, semenScore + arousalScore);
  const size = sizeFromScore(totalScore);
  const contents = contentsFrom(semenScore, arousalScore);
  const freshness = freshnessFrom(wetPool, dryPool);
  const flavor = synthesizeFlavor(size, contents, freshness);
  const label =
    size === 'none'
      ? 'dry'
      : `${size} · ${contents} · ${freshness}`;

  return {
    size,
    contents,
    freshness,
    arousalScore,
    semenScore,
    totalScore,
    label,
    flavor,
  };
}

/** True when standing lust / cycle / encounter say she is already elevated. */
export function isFeminineArousalElevated(
  unit: DetailedUnit,
  encounterArousal?: number
): boolean {
  const lust = unit.lewdStats.dynamic.lust ?? 0;
  if (lust >= 40) return true;
  if (encounterArousal != null && encounterArousal >= 35) return true;
  return false;
}
