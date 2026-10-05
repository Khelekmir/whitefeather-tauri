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
 * Deposit bruise from this hit's internal trauma channel.
 * Does not floor bruise to live internalBleed — contusion persists after bleed clots.
 */
export function applyBruiseFromHit(
  state: BodyPartHealth,
  damagePercent: number,
  split?: BleedSplit | null
): { before: number; after: number; gained: boolean } {
  const before = Math.max(0, Math.min(1, state.bruise ?? 0));
  const dmg = Math.max(0, Math.min(1, damagePercent));
  const sp = normalizeBleedSplit(split);
  const deposit = dmg * sp.internal * B().fromInternalMult;
  const after = Math.min(1, Math.max(before, deposit));
  state.bruise = roundToThousandths(after);
  return {
    before,
    after: state.bruise,
    gained: state.bruise > before + 1e-4,
  };
}

/**
 * Contusion clock:
 * - Active internalBleed → settle slightly (blood pooling), no resolution fade.
 * - Cleared bleed → day-scale fade; deeper bruises linger longer.
 * - Vulnerary multiplies resolution fade (strong care).
 */
export function fadeBruise(state: BodyPartHealth, minutes: number): number {
  const dt = Math.max(0, minutes);
  if (dt <= 0) return state.bruise ?? 0;

  let bruise = Math.max(0, Math.min(1, state.bruise ?? 0));
  const ib = Math.max(0, Math.min(1, state.internalBleed ?? 0));
  const active = ib > B().activeInternalThreshold;

  if (active) {
    // Still hemorrhaging internally: bruise may darken slightly, does not resolve.
    if (B().settleFromInternalPerMinute > 0) {
      bruise = Math.min(
        1,
        bruise + ib * B().settleFromInternalPerMinute * dt
      );
      state.bruise = roundToThousandths(bruise);
    }
    return state.bruise ?? bruise;
  }

  if (bruise <= 0) {
    state.bruise = 0;
    return 0;
  }

  // Resolution: slower when bruise is deep (lingerCurve).
  let fade =
    (B().resolutionFadePerMinute / (1 + bruise * B().lingerCurve)) * dt;
  if (state.vulnerary) fade *= B().vulneraryFadeMult;

  bruise = Math.max(0, bruise - fade);
  if (bruise < B().minVisible) bruise = 0;
  state.bruise = roundToThousandths(bruise);
  return state.bruise;
}

export function fadeAllBruises(
  itemized: ItemizedHealth,
  minutes: number
): BodyPartId[] {
  const changed: BodyPartId[] = [];
  for (const [part, state] of Object.entries(itemized) as [
    BodyPartId,
    BodyPartHealth,
  ][]) {
    const before = state.bruise ?? 0;
    // Still process parts with active internal bleed (settle) even if bruise is 0.
    const ib = state.internalBleed ?? 0;
    if (before <= 0 && ib <= B().activeInternalThreshold) continue;
    fadeBruise(state, minutes);
    if (Math.abs((state.bruise ?? 0) - before) > 1e-4) changed.push(part);
  }
  return changed;
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

/** Estimate unassisted minutes to clear a bruise of given severity (bleed already stopped). */
export function estimateBruiseClearMinutes(severity: number): number {
  const Bcfg = B();
  let bruise = Math.max(0, Math.min(1, severity));
  if (bruise < Bcfg.minVisible) return 0;
  // Integrate analytically: db/dt = -k/(1+L b) → Δt = ((b0-b1) + L/2 (b0²-b1²)) / k
  const b0 = bruise;
  const b1 = Bcfg.minVisible;
  const L = Bcfg.lingerCurve;
  const k = Bcfg.resolutionFadePerMinute;
  if (k <= 0) return Number.POSITIVE_INFINITY;
  return (b0 - b1 + (L / 2) * (b0 * b0 - b1 * b1)) / k;
}
