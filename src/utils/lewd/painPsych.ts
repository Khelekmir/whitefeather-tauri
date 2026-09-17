import type { Unit as DetailedUnit } from '../../types/characters';
import type { BondSnapshot } from './intimacyBond';
import { LEWD_TUNING as T } from './lewdTuning';

/**
 * How much of a physical pain chip becomes psychological strain.
 * Warm bond + high painAppetite + high arousal → near-zero (wanted sting).
 * Cold / reluctant → pain reads as threat.
 */
export function painPsychShareFromContext(opts: {
  bond: BondSnapshot;
  arousal: number;
  recipient: DetailedUnit;
  softUnready?: boolean;
  hardUnready?: boolean;
}): number {
  const P = T.painPsych;
  const st = opts.recipient.lewdStats.static;
  const appetite01 = Math.max(0, Math.min(1, (st.painAppetite ?? 3) / 10));
  const arousal01 = Math.max(0, Math.min(1, opts.arousal / 100));

  const bondWarm01 = Math.max(
    0,
    Math.min(
      1,
      (opts.bond.trust * 0.28 +
        opts.bond.affection * 0.28 +
        opts.bond.desire * 0.12 +
        opts.bond.familiarity * 0.08 +
        opts.bond.warmth * 0.14 +
        opts.bond.desireHeat * 0.1 -
        opts.bond.hurt * 0.2 -
        opts.bond.suspicion * 0.15 -
        opts.bond.irritation * 0.1) /
        55
    )
  );

  let share =
    (1 - appetite01 * P.appetiteWeight) *
    (1 - bondWarm01 * P.bondWarmWeight) *
    (1 - arousal01 * P.arousalEaseWeight);

  if (opts.softUnready) share *= 1.25;
  if (opts.hardUnready) share *= 1.45;

  return Math.max(P.shareMin, Math.min(P.shareMax, share));
}

/** Phys pain rate (per second) from catalog pain × intensity × tolerance. */
export function painPhysRateFromAction(opts: {
  pain: number;
  intensity: number;
  recipient: DetailedUnit;
}): number {
  const pain = Math.max(0, Math.min(1, opts.pain));
  if (pain <= 0) return 0;
  const tol = Math.max(0.5, Math.min(10, opts.recipient.lewdStats.static.painTolerance ?? 5));
  const intensityScale = Math.max(0.35, opts.intensity / 5);
  const tolScale = 1.15 - 0.3 * (tol / 5);
  return (
    pain *
    intensityScale *
    Math.max(0.45, tolScale) *
    T.encounter.painPhysPerSecAtRef
  );
}
