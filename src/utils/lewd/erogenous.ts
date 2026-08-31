import { LEWD_TUNING as T } from './lewdTuning';

/**
 * Map catalog sensitivity (roughly 0.5–9.9) to an erogenous rank in [0, 1].
 * Mid zones (neck ~4.5) stay low; primary erogenous (~8+) climb steeply.
 */
export function erogenousRank(catalogSensitivity: number): number {
  const { sensFloor, sensCeiling, curvePower } = T.erogenous;
  const t = (catalogSensitivity - sensFloor) / (sensCeiling - sensFloor);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.pow(clamped, curvePower);
}

/** Soft arousal ceiling from erogenous rank (psych can fill toward this, not freely to 100). */
export function arousalSoftCapForErogenous(rank: number): number {
  const { arousalPsychFloor, arousalCapPower } = T.erogenous;
  const shaped = Math.pow(Math.max(0, Math.min(1, rank)), arousalCapPower);
  return arousalPsychFloor + (100 - arousalPsychFloor) * shaped;
}
