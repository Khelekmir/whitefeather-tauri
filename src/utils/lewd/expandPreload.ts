import {
  getLewdPreload,
  type LewdPreloadDef,
  type LewdPreloadPhase,
} from '../../data/lewd/lewdPreloads';
import { LEWD_TUNING } from './lewdTuning';
import type { LewdChannel } from './lewdChannels';

export interface ExpandedPreloadPhase {
  durationSeconds: number;
  label: string;
  channels: LewdChannel[];
}

export interface ExpandedPreload {
  preloadId: string;
  variantId: string;
  variantLabel: string;
  phases: ExpandedPreloadPhase[];
  totalSeconds: number;
}

function clampIntensity(n: number): number {
  return Math.max(
    LEWD_TUNING.intensityMin,
    Math.min(LEWD_TUNING.intensityMax, Math.round(n))
  );
}

function phaseToChannels(
  phase: LewdPreloadPhase,
  variantIntensity: number
): LewdChannel[] {
  const durationSeconds = Math.max(1, phase.durationSeconds);
  return phase.loci.map((locus) => {
    const intensity = clampIntensity(locus.intensity ?? variantIntensity);
    return {
      actorPart: locus.actorPart,
      actionId: locus.actionId,
      targetPart: locus.targetPart,
      intensity,
      durationSeconds,
      remainingSeconds: durationSeconds,
    };
  });
}

/**
 * Expand an authored preload + variant into timed channel phases for Lab Play.
 */
export function expandPreload(
  preloadId: string,
  variantId?: string
): ExpandedPreload | null {
  const def = getLewdPreload(preloadId);
  if (!def) return null;
  return expandPreloadDef(def, variantId);
}

export function expandPreloadDef(
  def: LewdPreloadDef,
  variantId?: string
): ExpandedPreload {
  const vid =
    variantId && def.variants[variantId] ? variantId : def.defaultVariant;
  const variant = def.variants[vid] ?? def.variants[def.defaultVariant];
  const phasesSrc = variant.phases ?? def.phases;
  const phases: ExpandedPreloadPhase[] = phasesSrc.map((p, i) => ({
    durationSeconds: Math.max(1, p.durationSeconds),
    label: p.label ?? `phase ${i + 1}`,
    channels: phaseToChannels(p, variant.intensity),
  }));
  const totalSeconds = phases.reduce((s, p) => s + p.durationSeconds, 0);
  return {
    preloadId: def.id,
    variantId: vid,
    variantLabel: variant.label,
    phases,
    totalSeconds,
  };
}
