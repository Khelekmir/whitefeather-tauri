/**
 * Human-readable per-participant blurbs for a planned social task.
 */

import type { Unit as DetailedUnit } from '../../types/characters';
import type {
  TaskCompletionMutation,
  TaskEffectPlan,
} from './taskAssignmentClock';

function fmtDelta(n: number): string {
  const r = Math.round(n * 10) / 10;
  const sign = r > 0 ? '+' : '';
  return `${sign}${r}`;
}

function mutationBlurb(
  mut: TaskCompletionMutation,
  nameOf: (id: string) => string
): string | null {
  switch (mut.type) {
    case 'launderUnderwear':
      return `${nameOf(mut.unitId)}: laundry clears underwear soil`;
    case 'batheClearSkin':
      return `${nameOf(mut.unitId)}: bathe clears skin soil${
        mut.peelTorso ? ' (peels torso)' : ''
      }`;
    case 'tendWounds':
      return `${nameOf(mut.healerId)} dresses wounds on ${nameOf(mut.patientId)}`;
    default:
      return null;
  }
}

export interface ParticipantEffectBlurb {
  unitId: string;
  name: string;
  /** Pressures / self effects on this unit. */
  self: string[];
  /** Relationship effects this unit writes toward others. */
  towardOthers: string[];
  /** Relationship effects others write toward this unit. */
  fromOthers: string[];
  /** One-shot completion notes that name this unit. */
  completion: string[];
}

/**
 * Summarize continuous + completion plan lines grouped by participant.
 */
export function describeSocialTaskEffects(
  plan: TaskEffectPlan,
  participants: DetailedUnit[]
): ParticipantEffectBlurb[] {
  const byId = new Map(participants.map((u) => [u.id, u] as const));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  const blurbs = new Map<string, ParticipantEffectBlurb>();
  const ensure = (id: string): ParticipantEffectBlurb => {
    let b = blurbs.get(id);
    if (!b) {
      b = {
        unitId: id,
        name: nameOf(id),
        self: [],
        towardOthers: [],
        fromOthers: [],
        completion: [],
      };
      blurbs.set(id, b);
    }
    return b;
  };

  for (const u of participants) ensure(u.id);

  const addPressure = (
    unitId: string,
    id: string,
    delta: number,
    phase: 'while working' | 'on finish'
  ) => {
    const b = ensure(unitId);
    const line = `${id} ${fmtDelta(delta)} (${phase})`;
    if (phase === 'on finish') b.completion.push(line);
    else b.self.push(line);
  };

  for (const d of plan.continuous.pressure) {
    addPressure(d.unitId, d.id, d.delta, 'while working');
  }
  for (const d of plan.completion.pressure) {
    addPressure(d.unitId, d.id, d.delta, 'on finish');
  }

  const addRel = (
    fromId: string,
    toId: string,
    id: string,
    delta: number,
    phase: 'while working' | 'on finish',
    kind: 'ST' | 'LT'
  ) => {
    const fromB = ensure(fromId);
    const toB = ensure(toId);
    const tag = kind === 'LT' ? 'standing' : 'weather';
    const lineToward = `${tag} ${id} ${fmtDelta(delta)} toward ${nameOf(toId)} (${phase})`;
    const lineFrom = `${tag} ${id} ${fmtDelta(delta)} from ${nameOf(fromId)} (${phase})`;
    if (phase === 'on finish') {
      fromB.completion.push(lineToward);
      toB.completion.push(lineFrom);
    } else {
      fromB.towardOthers.push(lineToward);
      toB.fromOthers.push(lineFrom);
    }
  };

  for (const d of plan.continuous.shortTerm) {
    addRel(d.fromId, d.toId, d.id, d.delta, 'while working', 'ST');
  }
  for (const d of plan.completion.shortTerm) {
    addRel(d.fromId, d.toId, d.id, d.delta, 'on finish', 'ST');
  }
  for (const d of plan.continuous.longTerm) {
    addRel(d.fromId, d.toId, d.id, d.delta, 'while working', 'LT');
  }
  for (const d of plan.completion.longTerm) {
    addRel(d.fromId, d.toId, d.id, d.delta, 'on finish', 'LT');
  }

  for (const mut of plan.completion.mutations) {
    const line = mutationBlurb(mut, nameOf);
    if (!line) continue;
    if (mut.type === 'launderUnderwear' || mut.type === 'batheClearSkin') {
      ensure(mut.unitId).completion.push(line.replace(/^[^:]+:\s*/, ''));
    } else if (mut.type === 'tendWounds') {
      ensure(mut.healerId).completion.push(
        `dresses ${nameOf(mut.patientId)}'s wounds`
      );
      ensure(mut.patientId).completion.push(
        `wounds dressed by ${nameOf(mut.healerId)}`
      );
    }
  }

  return participants.map((u) => ensure(u.id));
}

/** Shared completion flags for a plan (shown once in Lab, not per actor). */
export function describeSocialTaskFlags(plan: TaskEffectPlan): string[] {
  return [...plan.completion.flags];
}

/** Single paragraph per participant for Lab UI. */
export function formatParticipantEffectBlurb(b: ParticipantEffectBlurb): string {
  const parts: string[] = [];
  if (b.self.length) parts.push(b.self.join('; '));
  if (b.towardOthers.length) parts.push(b.towardOthers.join('; '));
  if (b.fromOthers.length) parts.push(b.fromOthers.join('; '));
  if (b.completion.length) {
    // Dedupe flag lines shared across participants still ok once each
    const unique = [...new Set(b.completion)];
    parts.push(unique.join('; '));
  }
  if (parts.length === 0) return 'No planned meter or bond changes.';
  return parts.join(' · ');
}
