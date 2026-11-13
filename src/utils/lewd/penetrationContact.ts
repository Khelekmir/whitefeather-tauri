/**
 * Penetration depth → which partner penis loci an orifice can grip on climax.
 * Depth comes from the receiving catalog target on thrust/grind (not a continuous meter).
 */

import type { LewdChannel } from './lewdChannels';

export type PenetrationOrificeDepth =
  | 'anus'
  | 'rectumShallow'
  | 'rectumDeep'
  | 'vaginaShallow'
  | 'vaginaDeep';

export interface PenetrationGripLocus {
  /** Orifice part that contracts (actor). */
  actorPart: string;
  actionId: 'analContraction' | 'vaginalContraction';
  /** Partner penis locus gripped (target). */
  targetPart: string;
  /** True when this is the wrapping underside locus (slightly cooler intensity). */
  underside: boolean;
}

export interface PenetrationContact {
  orificeDepth: PenetrationOrificeDepth;
  depthRank: number;
  /** Penetrative channel that established contact. */
  sourceChannel: LewdChannel;
  gripped: PenetrationGripLocus[];
}

const PENETRATION_ACTIONS = new Set(['thrust', 'grind']);

const DEPTH_RANK: Record<PenetrationOrificeDepth, number> = {
  anus: 1,
  rectumShallow: 2,
  rectumDeep: 3,
  vaginaShallow: 1,
  vaginaDeep: 2,
};

function asOrificeDepth(part: string): PenetrationOrificeDepth | null {
  switch (part) {
    case 'anus':
    case 'rectumShallow':
    case 'rectumDeep':
    case 'vaginaShallow':
    case 'vaginaDeep':
      return part;
    default:
      return null;
  }
}

function withUnderside(
  primary: string,
  underside: string
): Array<{ targetPart: string; underside: boolean }> {
  return [
    { targetPart: primary, underside: false },
    { targetPart: underside, underside: true },
  ];
}

/**
 * Map orifice depth → contraction actors + penis loci (incl. underside wrap).
 *
 * Shallow anal (anus): ring on head (+ underside).
 * Rectal shallow/deep: ring on shaft (+ underside); canal on head (+ underside).
 * Vaginal shallow: canal on head (+ underside).
 * Vaginal deep: shallow on shaft (+ underside); deep on head (+ underside).
 */
export function gripLociForOrificeDepth(
  depth: PenetrationOrificeDepth
): PenetrationGripLocus[] {
  if (depth === 'anus') {
    return withUnderside('penisHead', 'penisHeadUnderside').map((t) => ({
      actorPart: 'anus',
      actionId: 'analContraction' as const,
      ...t,
    }));
  }
  if (depth === 'rectumShallow' || depth === 'rectumDeep') {
    const deepActor = depth;
    return [
      ...withUnderside('penisShaft', 'penisShaftUnderside').map((t) => ({
        actorPart: 'anus',
        actionId: 'analContraction' as const,
        ...t,
      })),
      ...withUnderside('penisHead', 'penisHeadUnderside').map((t) => ({
        actorPart: deepActor,
        actionId: 'analContraction' as const,
        ...t,
      })),
    ];
  }
  if (depth === 'vaginaShallow') {
    return withUnderside('penisHead', 'penisHeadUnderside').map((t) => ({
      actorPart: 'vaginaShallow',
      actionId: 'vaginalContraction' as const,
      ...t,
    }));
  }
  // vaginaDeep
  return [
    ...withUnderside('penisShaft', 'penisShaftUnderside').map((t) => ({
      actorPart: 'vaginaShallow',
      actionId: 'vaginalContraction' as const,
      ...t,
    })),
    ...withUnderside('penisHead', 'penisHeadUnderside').map((t) => ({
      actorPart: 'vaginaDeep',
      actionId: 'vaginalContraction' as const,
      ...t,
    })),
  ];
}

/** Deepest active penetrative orifice contact among channels (player thrust/grind). */
export function penetrationContactFromChannels(
  channels: readonly LewdChannel[]
): PenetrationContact | null {
  let best: PenetrationContact | null = null;
  for (const ch of channels) {
    if ((ch.remainingSeconds ?? 1) <= 0) continue;
    if (ch.source === 'reaction' || ch.source === 'npc') continue;
    if (!PENETRATION_ACTIONS.has(ch.actionId)) continue;
    const depth = asOrificeDepth(ch.targetPart);
    if (!depth) continue;
    const rank = DEPTH_RANK[depth];
    if (best && rank < best.depthRank) continue;
    if (best && rank === best.depthRank) continue;
    best = {
      orificeDepth: depth,
      depthRank: rank,
      sourceChannel: ch,
      gripped: gripLociForOrificeDepth(depth),
    };
  }
  return best;
}

export function formatPenetrationContact(contact: PenetrationContact): string {
  const grips = contact.gripped
    .map(
      (g) =>
        `${g.actorPart}→${g.targetPart}${g.underside ? ' (wrap)' : ''}`
    )
    .join(', ');
  return `${contact.orificeDepth} · ${grips}`;
}
