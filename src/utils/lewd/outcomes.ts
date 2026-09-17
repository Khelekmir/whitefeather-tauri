import { LEWD_TUNING as T } from './lewdTuning';
import type { StimulationResult } from './calcStimulation';

export type LewdOutcomeBand =
  | 'attuned'
  | 'adequate'
  | 'overstep'
  | 'violation'
  | 'unready'
  | 'clothed'
  | 'climax'
  | 'ruined';

export function bandOutcome(
  stim: StimulationResult,
  opts?: {
    intimacyBlocked?: boolean;
    arousalHardBlocked?: boolean;
    arousalSoftUnready?: boolean;
    clothingBlocked?: boolean;
    climaxed?: boolean;
    ruined?: boolean;
  }
): LewdOutcomeBand {
  if (opts?.intimacyBlocked) return 'violation';
  if (opts?.clothingBlocked) return 'clothed';
  if (opts?.arousalHardBlocked) return 'unready';
  if (opts?.ruined) return 'ruined';
  if (opts?.climaxed) return 'climax';
  if (opts?.arousalSoftUnready) return 'unready';

  const { intensityDelta, overMax, penaltyFactor } = stim;
  if (overMax || penaltyFactor < 0.75) return 'overstep';
  if (Math.abs(intensityDelta) <= T.attunedIntensitySlop && penaltyFactor >= 0.95) {
    return 'attuned';
  }
  if (intensityDelta > T.overstepAbovePreferred) return 'overstep';
  return 'adequate';
}

export function outcomeLabel(band: LewdOutcomeBand): string {
  switch (band) {
    case 'attuned':
      return 'Attuned — near their preferred intensity';
    case 'adequate':
      return 'Adequate — works, no special spark';
    case 'overstep':
      return 'Overstep — too much force / past their comfort';
    case 'violation':
      return 'Violation — intimacy/trust gate failed';
    case 'unready':
      return 'Unready — not aroused enough for that depth of intimacy';
    case 'clothed':
      return 'Clothed — clothing/armor blocks that contact';
    case 'climax':
      return 'Climax — edge released';
    case 'ruined':
      return 'Ruined — body or mind discomfort overwhelmed the encounter';
  }
}
