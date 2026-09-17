import type { BodyPartHealth, BodyPartId, ItemizedHealth } from '../../types/characters';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';
import type { BleedSplit } from './bleedSplit';
import { normalizeBleedSplit } from './bleedSplit';

const B = () => COMBAT_TUNING.bruise;

export type BruiseTier = 'none' | 'faint' | 'noticeable' | 'deep' | 'severe';

export interface BruiseFlavor {
  tier: BruiseTier;
  label: string;
  severity: number;
}

export function bruiseFlavor(severity: number): BruiseFlavor {
  const s = Math.max(0, Math.min(1, severity));
  if (s < B().minVisible) {
    return { tier: 'none', label: 'no bruise', severity: 0 };
  }
  if (s < 0.2) {
    return { tier: 'faint', label: 'faint tenderness', severity: s };
  }
  if (s < 0.45) {
    return { tier: 'noticeable', label: 'noticeable bruise', severity: s };
  }
  if (s < 0.7) {
    return { tier: 'deep', label: 'deep bruise', severity: s };
  }
  return { tier: 'severe', label: 'severe mottled bruise', severity: s };
}

/**
 * Raise bruise from this hit's internal fraction + standing internalBleed.
 */
export function applyBruiseFromHit(
  state: BodyPartHealth,
  damagePercent: number,
  split?: BleedSplit | null
): { before: number; after: number; gained: boolean } {
  const before = Math.max(0, Math.min(1, state.bruise ?? 0));
  const dmg = Math.max(0, Math.min(1, damagePercent));
  const sp = normalizeBleedSplit(split);
  const fromHit = dmg * sp.internal * B().fromInternalMult;
  const fromInternal = (state.internalBleed ?? 0) * B().linkToInternal;
  const after = Math.min(1, Math.max(before, fromHit, fromInternal));
  state.bruise = roundToThousandths(after);
  return {
    before,
    after: state.bruise,
    gained: state.bruise > before + 1e-4,
  };
}

/** Slow fade; vulnerary accelerates (nighttime care). */
export function fadeBruise(state: BodyPartHealth, minutes: number): number {
  const dt = Math.max(0, minutes);
  if (dt <= 0) return state.bruise ?? 0;
  let bruise = Math.max(0, Math.min(1, state.bruise ?? 0));
  if (bruise <= 0) {
    state.bruise = 0;
    return 0;
  }

  let fade = B().fadePerMinute * dt;
  if (state.vulnerary) fade *= B().vulneraryFadeMult;
  const ib = Math.max(0, Math.min(1, state.internalBleed ?? 0));
  fade /= 1 + ib * B().fadeSlowFromInternal;

  bruise = Math.max(0, bruise - fade);
  if (bruise < B().minVisible) bruise = 0;
  state.bruise = roundToThousandths(bruise);
  return state.bruise;
}

export function fadeAllBruises(
  itemized: ItemizedHealth,
  minutes: number
): BodyPartId[] {
  const faded: BodyPartId[] = [];
  for (const [part, state] of Object.entries(itemized) as [
    BodyPartId,
    BodyPartHealth,
  ][]) {
    const before = state.bruise ?? 0;
    if (before <= 0) continue;
    fadeBruise(state, minutes);
    if ((state.bruise ?? 0) < before) faded.push(part);
  }
  return faded;
}

/** Max bruise among body parts (for lewd region mapping). */
export function maxBruiseOnParts(
  itemized: ItemizedHealth,
  parts: BodyPartId[]
): number {
  let max = 0;
  for (const p of parts) {
    const b = itemized[p]?.bruise ?? 0;
    if (b > max) max = b;
  }
  return max;
}

