/**
 * Event-driven lewd reaction overlay (orgasm orifice clench, later NPC hands).
 * Reactions ignore player attention budget; soft-capped concurrent count.
 */

import {
  reactionPreloadForOrificeFamily,
  type ReactionOrificeFamily,
  type ReactionPreloadDef,
  type ReactionPreloadPhase,
} from '../../data/lewd/lewdReactionPreloads';
import type { FemaleClimaxSurgeBand } from './fluidDischarge';
import { LEWD_TUNING as T } from './lewdTuning';
import type { LewdChannel } from './lewdChannels';
import {
  penetrationContactFromChannels,
  type PenetrationContact,
  type PenetrationOrificeDepth,
} from './penetrationContact';

export interface OrgasmClenchPhase {
  durationSeconds: number;
  label: string;
  channels: LewdChannel[];
}

export interface OrgasmClenchPlan {
  reactionId: string;
  contact: PenetrationContact;
  /** Multi-phase intensity curve (peak → hold → release). */
  phases: OrgasmClenchPhase[];
  /** First-phase channels (compat / single-shot callers). */
  channels: LewdChannel[];
  label: string;
  surgeBand: FemaleClimaxSurgeBand;
  fragmentId: string;
}

function clampIntensity(n: number): number {
  return Math.max(
    T.intensityMin,
    Math.min(T.intensityMax, Math.round(n))
  );
}

export function orificeFamilyForDepth(
  depth: PenetrationOrificeDepth
): ReactionOrificeFamily {
  return depth === 'vaginaShallow' || depth === 'vaginaDeep' ? 'vaginal' : 'anal';
}

/** Edge-only fallback when no ♀ fluid surge band is available (e.g. ♂ recipient). */
export function surgeBandFromEdge(edgeAtClimax: number): FemaleClimaxSurgeBand {
  if (edgeAtClimax < 40) return 'modest';
  if (edgeAtClimax < 70) return 'strong';
  return 'soaking';
}

function applySurgeToPhases(
  phases: readonly ReactionPreloadPhase[],
  surgeBand: FemaleClimaxSurgeBand
): ReactionPreloadPhase[] {
  const s = T.reactions.surge[surgeBand];
  return phases.map((p) => ({
    ...p,
    durationSeconds: Math.max(
      1,
      Math.round(p.durationSeconds * s.durationMult)
    ),
    intensity: clampIntensity(p.intensity + s.intensityDelta),
  }));
}

function channelsForPhase(
  contact: PenetrationContact,
  phase: ReactionPreloadPhase,
  reactionId: string
): LewdChannel[] {
  const R = T.reactions;
  const durationSeconds = Math.max(1, phase.durationSeconds);
  const channels: LewdChannel[] = contact.gripped.map((g) => {
    const intensity = clampIntensity(
      g.underside
        ? phase.intensity - R.undersideIntensityDelta
        : phase.intensity
    );
    return {
      actorPart: g.actorPart,
      actionId: g.actionId,
      targetPart: g.targetPart,
      intensity,
      durationSeconds,
      remainingSeconds: durationSeconds,
      clothingAccess: 'underneath' as const,
      source: 'reaction' as const,
      reactionId,
    };
  });
  return softCapReactionChannels(channels, R.softCap);
}

/**
 * Build orgasm contraction plan from active penetration contact.
 * Uses authored anal/vaginal curve fragments + surge-band intensity/duration.
 * Role flip is the caller's job: resolve with recipient as proactive.
 */
export function planOrgasmContractions(
  activeChannels: readonly LewdChannel[],
  opts?: {
    intensity?: number;
    durationSeconds?: number;
    reactionId?: string;
    surgeBand?: FemaleClimaxSurgeBand;
    /** Edge at tip when surgeBand omitted (♂ / missing discharge). */
    edgeAtClimax?: number;
    fragment?: ReactionPreloadDef;
  }
): OrgasmClenchPlan | null {
  const contact = penetrationContactFromChannels(activeChannels);
  if (!contact) return null;

  const surgeBand =
    opts?.surgeBand ??
    (opts?.edgeAtClimax != null
      ? surgeBandFromEdge(opts.edgeAtClimax)
      : 'strong');

  const family = orificeFamilyForDepth(contact.orificeDepth);
  const fragment = opts?.fragment ?? reactionPreloadForOrificeFamily(family);
  const reactionId =
    opts?.reactionId ?? `${fragment.id}_${contact.orificeDepth}`;

  // Explicit intensity/duration opts → single flat phase (tests / Lab overrides).
  if (opts?.intensity != null || opts?.durationSeconds != null) {
    const R = T.reactions;
    const durationSeconds = Math.max(
      1,
      opts.durationSeconds ?? R.orgasmClenchSeconds
    );
    const baseIntensity = clampIntensity(
      opts.intensity ?? R.orgasmClenchIntensity
    );
    const phase: ReactionPreloadPhase = {
      durationSeconds,
      intensity: baseIntensity,
      label: 'hold',
    };
    const channels = channelsForPhase(contact, phase, reactionId);
    return {
      reactionId,
      contact,
      phases: [{ durationSeconds, label: 'hold', channels }],
      channels,
      label: `${fragment.label} · ${contact.orificeDepth} · ${surgeBand}`,
      surgeBand,
      fragmentId: fragment.id,
    };
  }

  const curved = applySurgeToPhases(fragment.phases, surgeBand);
  const phases: OrgasmClenchPhase[] = curved.map((p, i) => ({
    durationSeconds: p.durationSeconds,
    label: p.label ?? `phase ${i + 1}`,
    channels: channelsForPhase(contact, p, reactionId),
  }));
  const first = phases[0];
  if (!first) return null;

  return {
    reactionId,
    contact,
    phases,
    channels: first.channels,
    label: `${fragment.label} · ${contact.orificeDepth} · ${surgeBand}`,
    surgeBand,
    fragmentId: fragment.id,
  };
}

/** Keep the hottest / primary grips when over soft cap (drop underside first). */
export function softCapReactionChannels(
  channels: LewdChannel[],
  cap: number = T.reactions.softCap
): LewdChannel[] {
  if (channels.length <= cap) return channels;
  const scored = channels.map((ch, i) => {
    const underside = /Underside$/i.test(ch.targetPart) ? 0 : 1;
    return { ch, i, score: ch.intensity * 10 + underside };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, cap).map((s) => s.ch);
}

/** Merge player channels with reaction overlays (reactions replace same reactionId). */
export function mergeReactionChannels(
  playerOrActive: LewdChannel[],
  incoming: LewdChannel[]
): LewdChannel[] {
  if (incoming.length < 1) return playerOrActive;
  const dropIds = new Set(
    incoming.map((c) => c.reactionId).filter((id): id is string => !!id)
  );
  const kept = playerOrActive.filter(
    (c) => !(c.source === 'reaction' && c.reactionId && dropIds.has(c.reactionId))
  );
  return [...kept, ...incoming];
}

export function isReactionChannel(ch: LewdChannel): boolean {
  return ch.source === 'reaction' || ch.source === 'npc';
}

export function splitPlayerAndReactionChannels(channels: LewdChannel[]): {
  player: LewdChannel[];
  reactions: LewdChannel[];
} {
  const player: LewdChannel[] = [];
  const reactions: LewdChannel[] = [];
  for (const ch of channels) {
    if (isReactionChannel(ch)) reactions.push(ch);
    else player.push(ch);
  }
  return { player, reactions };
}

/** Total authored (+ surge-scaled) seconds across clench phases. */
export function orgasmClenchTotalSeconds(plan: OrgasmClenchPlan): number {
  return plan.phases.reduce((s, p) => s + p.durationSeconds, 0);
}
