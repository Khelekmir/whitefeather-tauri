/**
 * Mood → short-term relationship accumulation (Option 4 thin overlay).
 *
 * finalMult = clamp(classReceptivity[channel] × affectOverlay[channel])
 * Applied to ST writes only (writer = edge fromId). LT / pressures untouched.
 */

import type { MoodReceptivity } from '../../data/social/moodClasses';
import type { ShortTermRelationshipId } from '../../data/social/relationships';
import type { Unit as DetailedUnit } from '../../types/characters';
import { readMoodSwing } from './fleetingMoodSwingState';
import {
  levelsFromUnit,
  resolveMood,
  softHigh,
  softLow,
  type AffectLevels,
} from './resolveMood';

/** Receptivity channel used for ST axis scaling. */
export type StReceptivityChannel = keyof MoodReceptivity;

/**
 * Map ST axes → receptivity channels.
 * chore/talk reserved for willingness / idle weights later — not primary ST scalers.
 */
export const ST_AXIS_TO_RECEPTIVITY_CHANNEL: Record<
  ShortTermRelationshipId,
  StReceptivityChannel
> = {
  warmth: 'bond',
  gratitude: 'bond',
  admiration: 'bond',
  desireHeat: 'bond',
  irritation: 'friction',
  hurt: 'friction',
  suspicion: 'friction',
  guilt: 'friction',
};

/** Thin affect overlay knobs (class table still carries personality). */
export const MOOD_ST_AFFECT_OVERLAY = {
  /** stress↑ → friction ST lands harder (even before class flips to irritable). */
  stressFrictionGain: 0.22,
  /** belonging↑ → bond ST lands easier; belonging↓ dampens. */
  belongingBondGain: 0.18,
  /** Very high stress mildly dampens bond gains. */
  stressBondDamp: 0.1,
  /** Fleeting embarrassment / spooked → friction vulnerability. */
  swingFrictionGain: 0.16,
  /** Fluster / thrill → soft bond openness; embarrassment damps bond. */
  swingBondFlusterGain: 0.12,
  swingBondEmbarrassmentDamp: 0.14,
  /** Clamp on final class×affect mult. */
  multMin: 0.55,
  multMax: 1.45,
} as const;

function clampMult(n: number): number {
  return Math.max(
    MOOD_ST_AFFECT_OVERLAY.multMin,
    Math.min(MOOD_ST_AFFECT_OVERLAY.multMax, n)
  );
}

/**
 * Smooth overlay from live meters + fleeting swings. Mid meters ≈ 1.0.
 * Only friction + bond are live; chore/talk return 1.
 */
export function affectReceptivityOverlay(
  levels: AffectLevels,
  channel: StReceptivityChannel,
  writer?: DetailedUnit
): number {
  const O = MOOD_ST_AFFECT_OVERLAY;
  const sHi = softHigh(levels.stress);
  const bHi = softHigh(levels.belonging);
  const bLo = softLow(levels.belonging);

  const emb = writer ? softHigh(readMoodSwing(writer, 'embarrassment')) : 0;
  const fluster = writer ? softHigh(readMoodSwing(writer, 'fluster')) : 0;
  const thrill = writer ? softHigh(readMoodSwing(writer, 'thrill')) : 0;
  const spooked = writer ? softHigh(readMoodSwing(writer, 'spooked')) : 0;

  if (channel === 'friction') {
    return (
      1 +
      O.stressFrictionGain * (sHi - 0.35) +
      O.swingFrictionGain * (0.65 * emb + 0.55 * spooked)
    );
  }
  if (channel === 'bond') {
    return (
      1 +
      O.belongingBondGain * (bHi - bLo) -
      O.stressBondDamp * Math.max(0, sHi - 0.55) +
      O.swingBondFlusterGain * (0.7 * fluster + 0.45 * thrill) -
      O.swingBondEmbarrassmentDamp * emb
    );
  }
  return 1;
}

export function receptivityChannelForStAxis(
  axis: ShortTermRelationshipId
): StReceptivityChannel {
  return ST_AXIS_TO_RECEPTIVITY_CHANNEL[axis];
}

/**
 * Effective ST gain mult for the writer (feeling unit).
 * Class receptivity (primary+tint blend) × thin stress/belonging overlay.
 */
export function effectiveShortTermMult(
  writer: DetailedUnit,
  axis: ShortTermRelationshipId
): number {
  const channel = receptivityChannelForStAxis(axis);
  const resolved = resolveMood(writer);
  const classMult = resolved.receptivity[channel];
  const affectMult = affectReceptivityOverlay(
    levelsFromUnit(writer),
    channel,
    writer
  );
  return clampMult(classMult * affectMult);
}

/** Scale a planned ST delta by the writer's mood receptivity. */
export function scaleShortTermDeltaForMood(
  writer: DetailedUnit,
  axis: ShortTermRelationshipId,
  delta: number
): number {
  if (!delta) return 0;
  return delta * effectiveShortTermMult(writer, axis);
}
