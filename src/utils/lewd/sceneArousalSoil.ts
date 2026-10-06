import { LEWD_TUNING as T } from './lewdTuning';

/** Lab / log flavor for how strongly lubrication is marking cloth this beat. */
export type LubricationSoilFlavor =
  | 'none'
  | 'slick'
  | 'beading'
  | 'dampening'
  | 'dripping';

export interface SceneArousalSoilInput {
  feltWetness: number;
  holdSeconds: number;
  /** Average psych/physio quality 0–1; soft-scales drip. */
  beatQuality01?: number;
  genitalPlay: boolean;
}

export interface SceneArousalSoilResult {
  /** Total arousalFluid amount01 this beat (base + genital bonus × hold). */
  amount01: number;
  baseAmount01: number;
  /** Genital bonus amount01 this beat (rate × holdSeconds). */
  genitalBonus01: number;
  /** amount01 / sec (for flavor gates). */
  ratePerSec: number;
  flavor: LubricationSoilFlavor;
  /** Short log annotation, or null when none. */
  note: string | null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Map soil rate → flavor word (aligned with panty dampening pace, not orgasm flood).
 */
export function lubricationFlavorFromRate(ratePerSec: number): LubricationSoilFlavor {
  const G = T.cycle.sceneArousalSoil.flavorRate;
  if (!(ratePerSec >= G.slick)) return 'none';
  if (ratePerSec < G.beading) return 'slick';
  if (ratePerSec < G.dampening) return 'beading';
  if (ratePerSec < G.dampening * 1.85) return 'dampening';
  return 'dripping';
}

export function lubricationFlavorLabel(flavor: LubricationSoilFlavor): string {
  switch (flavor) {
    case 'slick':
      return 'slick';
    case 'beading':
      return 'beading';
    case 'dampening':
      return 'dampening';
    case 'dripping':
      return 'dripping';
    default:
      return '';
  }
}

/**
 * Per-beat arousal → cloth soil amounts (kiss/fondle path + modest genital rate × hold).
 */
export function computeSceneArousalSoil(
  input: SceneArousalSoilInput
): SceneArousalSoilResult {
  const S = T.cycle.sceneArousalSoil;
  const cap = T.cycle.wetnessCap;
  const hold = Math.max(0.5, input.holdSeconds);
  const felt = Math.max(0, Math.min(cap, input.feltWetness));
  const empty: SceneArousalSoilResult = {
    amount01: 0,
    baseAmount01: 0,
    genitalBonus01: 0,
    ratePerSec: 0,
    flavor: 'none',
    note: null,
  };

  if (felt < S.soilFromWetnessThreshold) return empty;

  const intensity =
    (felt - S.soilFromWetnessThreshold) /
    Math.max(0.01, cap - S.soilFromWetnessThreshold);
  const q = clamp01(input.beatQuality01 ?? 0.7);
  const qualityMult = 1 + S.qualityWeight * (q - 0.5) * 2; // ~0.75–1.25

  let baseAmount01 =
    S.dripPerSecAtCap * intensity * hold * Math.max(0.5, qualityMult);

  let genitalBonus01 = 0;
  if (
    input.genitalPlay &&
    felt >= T.cycle.ambientWetnessThreshold
  ) {
    // Per-second rate × hold — Lab 1s ticks and authored 8s beats stay linear.
    const genitalRate =
      Math.min(S.genitalBonusCap, S.genitalBonusBase * felt);
    genitalBonus01 = genitalRate * hold;
  }

  const amount01 = baseAmount01 + genitalBonus01;
  if (amount01 < 0.002) return empty;

  const ratePerSec = amount01 / hold;
  const flavor = lubricationFlavorFromRate(ratePerSec);
  if (flavor === 'none') {
    return {
      amount01,
      baseAmount01,
      genitalBonus01,
      ratePerSec,
      flavor: 'none',
      note: null,
    };
  }

  const word = lubricationFlavorLabel(flavor);
  const note = input.genitalPlay && genitalBonus01 > 0.002
    ? `${word} · genital flush`
    : `${word} · cloth`;

  return {
    amount01,
    baseAmount01,
    genitalBonus01,
    ratePerSec,
    flavor,
    note,
  };
}
