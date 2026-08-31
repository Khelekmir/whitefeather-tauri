import { LEWD_TUNING as T } from './lewdTuning';

export interface StimulationInput {
  sex: 'male' | 'female';
  attackerMultiplier: number;
  stimulationFactor: number;
  submissionMultiplier: number;
  /** Catalog sensitivity × character multiplier (absolute, ~0.5–10). */
  sensitivity: number;
  estrogen?: number;
  progesterone?: number;
  /**
   * Optional precomputed female cycle mult (mild E/P + fertile crest).
   * When set, replaces inline E^n/P^n so callers can avoid double-counting.
   */
  cyclePhysioMult?: number;
  intensity: number;
  maxIntensity: number;
  preferredIntensity: number;
  preference: number;
}

export interface StimulationResult {
  /**
   * Physiological stimulation channel (shaped by sensitivity / intensity / action).
   * Already includes erogenous-agnostic curves; resolve applies erogenousRank separately.
   */
  physio: number;
  /** Intensity match quality for outcome banding / psych. */
  intensityDelta: number;
  intensityMatch: number;
  overMax: boolean;
  perfectBoon: number;
  penaltyFactor: number;
  /** @deprecated alias of physio for older log lines */
  stimulation: number;
}

/**
 * Physiological response to a move (sensitivity, intensity fit, action factor).
 * Preference is mostly psychological — only a light touch here.
 */
export function calcStimulation(input: StimulationInput): StimulationResult {
  const {
    sex,
    attackerMultiplier,
    stimulationFactor,
    submissionMultiplier,
    sensitivity,
    estrogen = 1,
    progesterone = 1,
    cyclePhysioMult,
    intensity,
    maxIntensity,
    preferredIntensity,
    preference,
  } = input;

  const { a, b, c, perfectBoonDivisor, overMaxPenaltyRate, physioOutputScale } =
    T.stimulation;

  // Linear sens contributes mildly; erogenousRank does the heavy lifting later.
  const g = Math.max(0.08, Math.min(1.1, sensitivity / 10));

  const intensityNorm = 1 - a * Math.exp(-b * 10);
  const i = (1 - Math.pow(a, -b * intensity)) / intensityNorm;

  const perfectIntensityBoon =
    (1 - Math.abs(intensity - preferredIntensity)) / perfectBoonDivisor;
  const intensityMatch = Math.max(0, Math.min(1, 1 - Math.abs(intensity - preferredIntensity) / 5));
  const boon = perfectIntensityBoon >= 0 ? 1 + perfectIntensityBoon : 1;

  const diff = intensity - maxIntensity;
  const overMax = diff > 0;
  const penaltyFactor = !overMax
    ? 1
    : Math.max(
        0.05,
        1 -
          ((overMaxPenaltyRate * (10 / Math.max(1, maxIntensity))) /
            Math.max(0.25, submissionMultiplier)) *
            diff /
            (sex === 'male' ? 2 : 1)
      );

  const stimNorm = 1 - c * Math.exp(-c * 10);
  const s = (1 - Math.pow(a, -c * stimulationFactor)) / stimNorm;

  // Preference only lightly colors physio (liked zones feel a bit better physically).
  const prefTouch = 0.75 + 0.25 * Math.max(0.2, Math.min(1.2, preference / 5));

  const base =
    i *
    prefTouch *
    penaltyFactor *
    g *
    s *
    Math.max(0.2, attackerMultiplier) *
    boon *
    physioOutputScale;

  const hormoneMult =
    cyclePhysioMult != null
      ? cyclePhysioMult
      : estrogen ** 0.1 / progesterone ** 0.1;
  const physio = sex === 'female' ? base * hormoneMult : base;

  return {
    physio: round3(physio),
    stimulation: round3(physio),
    intensityDelta: intensity - preferredIntensity,
    intensityMatch: round3(intensityMatch),
    overMax,
    perfectBoon: round3(boon),
    penaltyFactor: round3(penaltyFactor),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
