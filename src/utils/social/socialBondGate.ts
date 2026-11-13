/**
 * LT social gates — standing bonds gate partnered social acts (soft cut).
 * Chores / camp labor stay ungated. Outcome mults deferred.
 *
 * Pattern rhymes with lewd intimacyBudgetFromBond, but Desire is not the
 * primary unlock for non-erotic social (trust / affection / familiarity are).
 */

import type { LongTermRelationshipId } from '../../data/social/relationships';
import type { DirectedRelationship } from '../../data/social/relationships';
import { defaultLongTermScores } from '../../data/social/relationships';
import type { Unit as DetailedUnit } from '../../types/characters';
import {
  getEdge,
  type RelationshipGraph,
} from './relationshipState';

export const SOCIAL_BOND_GATE_TUNING = {
  /** Weighted social "room" toward a partner (LT only for this cut). */
  trustWeight: 0.35,
  affectionWeight: 0.35,
  familiarityWeight: 0.2,
  respectWeight: 0.1,
  /** Fear contracts willingness to share soft/intimate social space. */
  fearPenalty: 0.35,
  /** Soft floors — below stranger defaults so cold bonds fail, neutrals pass. */
  gates: {
    /** Quiet talk / night watch — modest comfort. */
    share_watch: 28,
    /** Shared bathing — warmer floor than watch. */
    bathe_together: 34,
    /**
     * Care still allowed when chilly (battlefield necessity), but not if
     * the patient/healer pair is mutually terrified / hostile-cold.
     */
    tend_wounds: 22,
  } as Record<string, number>,
} as const;

export type SocialBondGateId = keyof typeof SOCIAL_BOND_GATE_TUNING.gates;

export function socialBudgetFromLongTerm(lt: {
  trust: number;
  affection: number;
  familiarity: number;
  respect: number;
  fear: number;
}): number {
  const T = SOCIAL_BOND_GATE_TUNING;
  return (
    lt.trust * T.trustWeight +
    lt.affection * T.affectionWeight +
    lt.familiarity * T.familiarityWeight +
    lt.respect * T.respectWeight -
    lt.fear * T.fearPenalty
  );
}

function ltFromEdge(edge: DirectedRelationship | null) {
  if (!edge) return defaultLongTermScores();
  return edge.longTerm;
}

/** Directed budget: how willing `from` is to share soft social space with `to`. */
export function socialBudgetToward(
  graph: RelationshipGraph,
  from: DetailedUnit,
  to: DetailedUnit
): number {
  const edge = getEdge(graph, from.id, to.id);
  return socialBudgetFromLongTerm(ltFromEdge(edge));
}

/**
 * Shared acts use the weaker directed link (both must be willing enough).
 */
export function socialBudgetPairMin(
  graph: RelationshipGraph,
  a: DetailedUnit,
  b: DetailedUnit
): { budget: number; aToB: number; bToA: number } {
  const aToB = socialBudgetToward(graph, a, b);
  const bToA = socialBudgetToward(graph, b, a);
  return { budget: Math.min(aToB, bToA), aToB, bToA };
}

export function socialGateRequired(taskId: string): number | null {
  const g = SOCIAL_BOND_GATE_TUNING.gates[taskId];
  return g == null ? null : g;
}

export interface SocialGateResult {
  ok: boolean;
  required: number | null;
  budget: number | null;
  aToB?: number;
  bToA?: number;
  reason?: string;
}

/**
 * Soft LT gate for partnered social tasks. Ungated tasks return ok.
 */
export function evaluateSocialBondGate(input: {
  taskId: string;
  taskLabel: string;
  primary: DetailedUnit;
  partner: DetailedUnit | null;
  relationships: RelationshipGraph;
}): SocialGateResult {
  const required = socialGateRequired(input.taskId);
  if (required == null) {
    return { ok: true, required: null, budget: null };
  }
  if (!input.partner) {
    return {
      ok: false,
      required,
      budget: null,
      reason: `Needs a partner for “${input.taskLabel}”.`,
    };
  }
  const pair = socialBudgetPairMin(
    input.relationships,
    input.primary,
    input.partner
  );
  if (pair.budget + 1e-6 >= required) {
    return {
      ok: true,
      required,
      budget: pair.budget,
      aToB: pair.aToB,
      bToA: pair.bToA,
    };
  }
  const colder =
    pair.aToB <= pair.bToA
      ? `${input.primary.name}→${input.partner.name}`
      : `${input.partner.name}→${input.primary.name}`;
  return {
    ok: false,
    required,
    budget: pair.budget,
    aToB: pair.aToB,
    bToA: pair.bToA,
    reason: `Too cold for “${input.taskLabel}” — social bond ${pair.budget.toFixed(0)} < ${required} (weaker link ${colder}).`,
  };
}

/** Lab / debug: which LT axes feed the budget. */
export function summarizeSocialBudgetAxes(
  lt: Record<LongTermRelationshipId, number>
): string {
  return `T${lt.trust.toFixed(0)} A${lt.affection.toFixed(0)} F${lt.familiarity.toFixed(0)} R${lt.respect.toFixed(0)} fear${lt.fear.toFixed(0)}`;
}
