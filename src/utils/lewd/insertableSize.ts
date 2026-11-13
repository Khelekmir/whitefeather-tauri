/**
 * Discrete insertable girth classes for orifice comfort (not length/depth).
 * Soft-cap dilation chain: tease → 1 finger → 2 fingers → tip → shaft → full.
 */

import type { LewdChannel } from './lewdChannels';
import { LEWD_TUNING as T } from './lewdTuning';

export type InsertableSizeClass =
  | 'fingertip'
  | 'finger'
  | 'twoFinger'
  | 'threeFinger'
  | 'tongue'
  | 'penisTip'
  | 'penis'
  | 'toyS'
  | 'toyM'
  | 'toyL';

export const INSERTABLE_SIZE_RANK: Record<InsertableSizeClass, number> = {
  fingertip: 1,
  finger: 2,
  tongue: 2,
  twoFinger: 3,
  threeFinger: 4,
  penisTip: 5,
  toyS: 5,
  penis: 7,
  toyM: 7,
  toyL: 9,
};

const PROBE_ACTIONS = new Set([
  'fingerProbe',
  'twoFingerProbe',
  'threeFingerProbe',
  'tongueProbe',
  'toeProbe',
]);

const INSERT_ACTIONS = new Set(['thrust', 'grind']);

/** External verge / surface play that can coax without true insertion. */
const TEASE_ACTIONS = new Set([
  'fingerStroke',
  'fingerTrace',
  'thumbRub',
  'palmRub',
  'lick',
  'tongueTrace',
  'kissLips',
]);

export function sizeRank(sizeClass: InsertableSizeClass): number {
  return INSERTABLE_SIZE_RANK[sizeClass];
}

/**
 * Map a channel's actor + action to an insertable class.
 * Probe with penisHead → penisTip; thrust/grind with penis* → penis.
 */
export function insertableSizeClassFromChannel(
  channel: LewdChannel
): InsertableSizeClass | null {
  const actor = channel.actorPart;
  const action = channel.actionId;

  if (/^tongue/i.test(actor) || actor === 'tongue' || actor === 'lips') {
    if (PROBE_ACTIONS.has(action) || action === 'tongueProbe') return 'tongue';
    if (TEASE_ACTIONS.has(action)) return 'tongue';
  }

  if (/^handFinger/i.test(actor) || actor === 'handFinger') {
    if (action === 'threeFingerProbe') return 'threeFinger';
    if (action === 'twoFingerProbe') return 'twoFinger';
    if (action === 'fingerProbe') return 'finger';
    if (TEASE_ACTIONS.has(action)) return 'fingertip';
    if (PROBE_ACTIONS.has(action)) return 'finger';
  }

  if (/^penisHead/i.test(actor)) {
    if (INSERT_ACTIONS.has(action)) {
      // Head-only at anus / shallow can still be tip-scale if intensity is gentle.
      if (
        (channel.targetPart === 'anus' ||
          channel.targetPart === 'vaginaShallow' ||
          channel.targetPart === 'rectumShallow') &&
        channel.intensity <= 4
      ) {
        return 'penisTip';
      }
      return 'penis';
    }
    if (PROBE_ACTIONS.has(action) || TEASE_ACTIONS.has(action)) return 'penisTip';
    if (action === 'thrust' || action === 'grind') return 'penis';
    return 'penisTip';
  }

  if (/^penisShaft/i.test(actor) || /^penis/i.test(actor)) {
    if (INSERT_ACTIONS.has(action) || PROBE_ACTIONS.has(action)) return 'penis';
    return 'penisTip';
  }

  if (/^toe/i.test(actor) || actor === 'footToe') {
    if (PROBE_ACTIONS.has(action)) return 'finger';
    return 'fingertip';
  }

  return null;
}

export function isProbeAction(actionId: string): boolean {
  return PROBE_ACTIONS.has(actionId);
}

export function isInsertAction(actionId: string): boolean {
  return INSERT_ACTIONS.has(actionId);
}

export function isTeaseAction(actionId: string): boolean {
  return TEASE_ACTIONS.has(actionId);
}

/**
 * Soft-cap dilation this size class can gently raise toward.
 * Tease unlocks 1 finger; 1 finger unlocks 2; 2 unlocks tip; tip unlocks shaft; shaft → full.
 */
export function dilationSoftCapForSizeClass(
  sizeClass: InsertableSizeClass,
  tier: 'tease' | 'probe' | 'insert'
): number {
  const caps = T.orificePlay.dilationSoftCapBySize;
  if (tier === 'tease') return caps.fingertip;
  return caps[sizeClass] ?? caps.finger;
}

/** How many size-rank steps this act jumps past current open capacity (0 = in chain). */
export function chainJumpSteps(
  openCapacityRank: number,
  actSizeRank: number
): number {
  const over = actSizeRank - openCapacityRank;
  return over > 0 ? Math.round(over * 10) / 10 : 0;
}

/** openCapacity rank from dilation01 using tuning breakpoints. */
export function openCapacityRankFromDilation(dilation01: number): number {
  const pts = T.orificePlay.capacityAtDilation;
  const d = Math.max(0, Math.min(1, dilation01));
  let rank: number = pts[0]!.rank;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1];
    if (!b) {
      rank = a.rank;
      break;
    }
    if (d <= b.dilation01) {
      const t =
        (d - a.dilation01) / Math.max(1e-6, b.dilation01 - a.dilation01);
      rank = a.rank + t * (b.rank - a.rank);
      break;
    }
    rank = b.rank;
  }
  return rank;
}
