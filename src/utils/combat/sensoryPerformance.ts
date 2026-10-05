import type { ItemizedHealth } from '../../types/characters';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';

const S = () => COMBAT_TUNING.sensory;

export interface SensoryPerformance {
  /** Synced / derived: head.health ≤ concussion threshold. */
  concussed: boolean;
  headHealth: number;
  /** √health average of both eyes (1 = fine). */
  eyeFactor: number;
  /** √health average of both ears (1 = fine). */
  earFactor: number;
  /**
   * Multiply aim / miss / ranged accuracy (eyes + ears).
   * 1 = unimpaired.
   */
  accuracyMult: number;
  /**
   * Multiply skill-gated performance (competence, trained chances, aptitude).
   * Driven by concussion severity. 1 = unimpaired.
   * Reuse outside combat when skill arenas come online.
   */
  skillMult: number;
  /** accuracyMult × skillMult — melee focus / placement. */
  focusMult: number;
}

function partHealth(itemized: ItemizedHealth, part: keyof ItemizedHealth): number {
  return Math.max(0, Math.min(1, itemized[part]?.health ?? 1));
}

/**
 * Keep `head.concussed` aligned with head.health vs threshold.
 * Call after injury, healing, or lab edits.
 */
export function syncConcussionFlag(itemized: ItemizedHealth): boolean {
  const head = itemized.head;
  if (!head) return false;
  const concussed = partHealth(itemized, 'head') <= S().concussionHealthThreshold;
  head.concussed = concussed;
  return concussed;
}

export function isConcussed(itemized: ItemizedHealth): boolean {
  syncConcussionFlag(itemized);
  return !!itemized.head?.concussed;
}

/**
 * Shared sensory + concussion penalties for combat (and later skill arenas).
 * Always syncs the concussed flag from current head health.
 */
export function calcSensoryPerformance(
  itemized: ItemizedHealth
): SensoryPerformance {
  syncConcussionFlag(itemized);

  const headHealth = partHealth(itemized, 'head');
  const eyeL = partHealth(itemized, 'eyeLeft');
  const eyeR = partHealth(itemized, 'eyeRight');
  const earL = partHealth(itemized, 'earLeft');
  const earR = partHealth(itemized, 'earRight');

  const eyeFactor = roundToThousandths((Math.sqrt(eyeL) + Math.sqrt(eyeR)) / 2);
  const earFactor = roundToThousandths((Math.sqrt(earL) + Math.sqrt(earR)) / 2);

  // Degradation model mirrors calcHealthPenalty: (1 − √health) × weight.
  const eyeDeg =
    (1 - Math.sqrt(eyeL)) * S().eyeAccuracyWeight +
    (1 - Math.sqrt(eyeR)) * S().eyeAccuracyWeight;
  const earDeg =
    (1 - Math.sqrt(earL)) * S().earAccuracyWeight +
    (1 - Math.sqrt(earR)) * S().earAccuracyWeight;
  const accuracyMult = roundToThousandths(
    Math.max(S().accuracyFloor, 1 - eyeDeg - earDeg)
  );

  const threshold = S().concussionHealthThreshold;
  const concussed = headHealth <= threshold;
  let skillMult = 1;
  if (concussed && threshold > 0) {
    // At threshold → concussionSkillAtThreshold; at 0 → concussionSkillFloor.
    const t = Math.max(0, Math.min(1, headHealth / threshold));
    const at = S().concussionSkillAtThreshold;
    const floor = S().concussionSkillFloor;
    skillMult = roundToThousandths(floor + (at - floor) * t);
  }

  return {
    concussed,
    headHealth: roundToThousandths(headHealth),
    eyeFactor,
    earFactor,
    accuracyMult,
    skillMult,
    focusMult: roundToThousandths(accuracyMult * skillMult),
  };
}
