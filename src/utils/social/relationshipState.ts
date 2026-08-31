import { ST_TO_LT_CRYSTALLIZATION } from '../../data/social/relationshipCrystallization';
import {
  LONG_TERM_RELATIONSHIP_AXES,
  SHORT_TERM_RELATIONSHIP_AXES,
  clampLongTerm,
  clampShortTerm,
  defaultDirectedRelationship,
  relationshipEdgeKey,
  type DirectedRelationship,
  type LongTermRelationshipId,
  type LongTermScores,
  type ShortTermRelationshipId,
  type ShortTermScores,
} from '../../data/social/relationships';
import type { Unit as DetailedUnit } from '../../types/characters';
import { RELATIONSHIP_DRIFT_TUNING as T } from './relationshipDriftTuning';
import {
  hasNativeAttractionToward,
  sexualDesireSoftCap,
} from './orientationDesire';

export type RelationshipGraph = Record<string, DirectedRelationship>;

export {
  hasNativeAttractionToward,
  intimateEncounterAllowed,
  orientationResistance01,
  sexualDesireAllowedBySex,
  sexualDesireSoftCap,
  sexualPairingHardBlocked,
} from './orientationDesire';

/**
 * Native / cultural sexual Desire eligibility (standing orientation).
 * - Never M→M (design hard rule).
 * - Whitewing / Whitefeather count as attraction toward women.
 * F→F without those flags is still playable via soft resistance
 * (`sexualDesireSoftCap`) — Desire is capped, not hard-zero forever.
 */
export function sexualDesireAllowed(
  from: Pick<DetailedUnit, 'sex' | 'lewdStats'>,
  to: Pick<DetailedUnit, 'sex'>
): boolean {
  return hasNativeAttractionToward(from, to);
}

function clampDesireFields(
  edge: DirectedRelationship,
  from: DetailedUnit,
  to: DetailedUnit
): DirectedRelationship {
  const cap = sexualDesireSoftCap(from, to, edge);
  const desire = Math.min(edge.longTerm.desire, cap);
  const desireHeat = Math.min(edge.shortTerm.desireHeat, cap);
  if (desire === edge.longTerm.desire && desireHeat === edge.shortTerm.desireHeat) {
    return edge;
  }
  return {
    ...edge,
    longTerm: { ...edge.longTerm, desire },
    shortTerm: { ...edge.shortTerm, desireHeat },
  };
}

export function getEdge(
  graph: RelationshipGraph,
  fromId: string,
  toId: string
): DirectedRelationship | null {
  if (fromId === toId) return null;
  return graph[relationshipEdgeKey(fromId, toId)] ?? null;
}

export function ensureEdge(
  graph: RelationshipGraph,
  from: DetailedUnit,
  to: DetailedUnit
): RelationshipGraph {
  if (from.id === to.id) return graph;
  const key = relationshipEdgeKey(from.id, to.id);
  if (graph[key]) {
    const clamped = clampDesireFields(graph[key], from, to);
    return clamped === graph[key] ? graph : { ...graph, [key]: clamped };
  }
  const edge = clampDesireFields(
    defaultDirectedRelationship(from.id, to.id),
    from,
    to
  );
  return { ...graph, [key]: edge };
}

export function ensureBidirectional(
  graph: RelationshipGraph,
  a: DetailedUnit,
  b: DetailedUnit
): RelationshipGraph {
  return ensureEdge(ensureEdge(graph, a, b), b, a);
}

export function setLongTerm(
  graph: RelationshipGraph,
  from: DetailedUnit,
  to: DetailedUnit,
  id: LongTermRelationshipId,
  value: number
): RelationshipGraph {
  let next = ensureEdge(graph, from, to);
  const key = relationshipEdgeKey(from.id, to.id);
  const edge = next[key];
  let v = clampLongTerm(value);
  if (id === 'desire') {
    const cap = sexualDesireSoftCap(from, to, edge);
    v = Math.min(v, cap);
  }
  next = {
    ...next,
    [key]: {
      ...edge,
      longTerm: { ...edge.longTerm, [id]: v },
    },
  };
  return next;
}

export function setShortTerm(
  graph: RelationshipGraph,
  from: DetailedUnit,
  to: DetailedUnit,
  id: ShortTermRelationshipId,
  value: number
): RelationshipGraph {
  let next = ensureEdge(graph, from, to);
  const key = relationshipEdgeKey(from.id, to.id);
  const edge = next[key];
  let v = clampShortTerm(value);
  if (id === 'desireHeat') {
    const cap = sexualDesireSoftCap(from, to, edge);
    v = Math.min(v, cap);
  }
  next = {
    ...next,
    [key]: {
      ...edge,
      shortTerm: { ...edge.shortTerm, [id]: v },
    },
  };
  return next;
}

export function nudgeLongTerm(
  graph: RelationshipGraph,
  from: DetailedUnit,
  to: DetailedUnit,
  id: LongTermRelationshipId,
  delta: number
): RelationshipGraph {
  const edge =
    getEdge(graph, from.id, to.id) ?? defaultDirectedRelationship(from.id, to.id);
  return setLongTerm(graph, from, to, id, edge.longTerm[id] + delta);
}

export function nudgeShortTerm(
  graph: RelationshipGraph,
  from: DetailedUnit,
  to: DetailedUnit,
  id: ShortTermRelationshipId,
  delta: number
): RelationshipGraph {
  const edge =
    getEdge(graph, from.id, to.id) ?? defaultDirectedRelationship(from.id, to.id);
  return setShortTerm(graph, from, to, id, edge.shortTerm[id] + delta);
}

/**
 * Future writer hook: romantic act with one partner spikes guilt toward others
 * the feeler has meaningful romantic interest in (LT desire / affection).
 * Not wired to tasks yet — exported for upcoming intimate-move resolution.
 */
export function applyRomanticGuiltTowardOthers(
  graph: RelationshipGraph,
  feeler: DetailedUnit,
  engagedWith: DetailedUnit,
  others: DetailedUnit[],
  guiltSpike = 35
): RelationshipGraph {
  let next = graph;
  for (const other of others) {
    if (other.id === feeler.id || other.id === engagedWith.id) continue;
    next = ensureEdge(next, feeler, other);
    const edge = getEdge(next, feeler.id, other.id)!;
    const interested =
      edge.longTerm.desire >= 25 || edge.longTerm.affection >= 55;
    if (!interested) continue;
    next = setShortTerm(
      next,
      feeler,
      other,
      'guilt',
      edge.shortTerm.guilt + guiltSpike
    );
  }
  return next;
}

/**
 * Future writer hook: when two people both love the same third, spark rivalry
 * toward each other. Thresholds are placeholders.
 */
export function applyRomanticRivalrySpark(
  graph: RelationshipGraph,
  a: DetailedUnit,
  b: DetailedUnit,
  beloved: DetailedUnit,
  rivalryGain = 15
): RelationshipGraph {
  if (a.id === b.id) return graph;
  let next = ensureBidirectional(graph, a, b);
  const aToBeloved =
    getEdge(next, a.id, beloved.id) ??
    defaultDirectedRelationship(a.id, beloved.id);
  const bToBeloved =
    getEdge(next, b.id, beloved.id) ??
    defaultDirectedRelationship(b.id, beloved.id);
  const aLoves =
    aToBeloved.longTerm.desire >= 40 || aToBeloved.longTerm.affection >= 70;
  const bLoves =
    bToBeloved.longTerm.desire >= 40 || bToBeloved.longTerm.affection >= 70;
  if (!aLoves || !bLoves) return graph;

  next = ensureEdge(next, a, beloved);
  next = ensureEdge(next, b, beloved);
  const aEdge = getEdge(next, a.id, b.id)!;
  const bEdge = getEdge(next, b.id, a.id)!;
  next = setLongTerm(next, a, b, 'rivalry', aEdge.longTerm.rivalry + rivalryGain);
  next = setLongTerm(next, b, a, 'rivalry', bEdge.longTerm.rivalry + rivalryGain);
  return next;
}

export interface ShortTermDriftDelta {
  key: string;
  id: ShortTermRelationshipId;
  from: number;
  to: number;
}

export interface LongTermCrystalDelta {
  key: string;
  fromSt: ShortTermRelationshipId;
  id: LongTermRelationshipId;
  from: number;
  to: number;
  delta: number;
}

export interface ShortTermDriftResult {
  graph: RelationshipGraph;
  hours: number;
  deltas: ShortTermDriftDelta[];
  crystalDeltas: LongTermCrystalDelta[];
}

function decayTowardZero(value: number, hours: number): number {
  if (Math.abs(value) <= T.snapEpsilon) return 0;
  const next = value * Math.exp(-T.shortTermLambdaPerHour * hours);
  return Math.abs(next) <= T.snapEpsilon ? 0 : clampShortTerm(next);
}

export type RelationshipUnitLookup = Readonly<
  Record<string, Pick<DetailedUnit, 'id' | 'sex' | 'lewdStats'>>
>;

/**
 * Idle decay of short-term weather toward 0, crystallizing a shaved fraction of
 * the faded residual into long-term standing (see ST_TO_LT_CRYSTALLIZATION).
 * Desire-targeted writes require unitsById so attraction rules can gate them.
 */
export function driftShortTermRelationships(
  graph: RelationshipGraph,
  hours: number,
  unitsById?: RelationshipUnitLookup
): ShortTermDriftResult {
  if (!(hours > 0)) {
    return { graph, hours: 0, deltas: [], crystalDeltas: [] };
  }

  const deltas: ShortTermDriftDelta[] = [];
  const crystalDeltas: LongTermCrystalDelta[] = [];
  const nextGraph: RelationshipGraph = { ...graph };

  for (const [key, edge] of Object.entries(graph)) {
    let changed = false;
    const nextSt = { ...edge.shortTerm };
    const nextLt = { ...edge.longTerm };

    const fromUnit = unitsById?.[edge.fromId];
    const toUnit = unitsById?.[edge.toId];
    const desireCap =
      fromUnit && toUnit ? sexualDesireSoftCap(fromUnit, toUnit, edge) : 0;

    for (const axis of SHORT_TERM_RELATIONSHIP_AXES) {
      const from = edge.shortTerm[axis.id];
      const to = decayTowardZero(from, hours);
      const faded = from - to;

      if (Math.abs(to - from) >= 0.05) {
        deltas.push({ key, id: axis.id, from, to });
        nextSt[axis.id] = to;
        changed = true;
      } else if (from !== to) {
        nextSt[axis.id] = to;
        changed = true;
      }

      if (Math.abs(faded) < T.crystallizeEpsilon) continue;

      const weights = ST_TO_LT_CRYSTALLIZATION[axis.id];
      for (const [ltId, weight] of Object.entries(weights) as [
        LongTermRelationshipId,
        number,
      ][]) {
        if (!weight) continue;
        if (ltId === 'desire' && desireCap <= 0) continue;

        const before = nextLt[ltId];
        const delta = faded * weight * T.crystallizeGain;
        if (Math.abs(delta) < 0.01) continue;
        let after = clampLongTerm(before + delta);
        if (ltId === 'desire') after = Math.min(after, desireCap);
        if (after === before) continue;
        nextLt[ltId] = after;
        crystalDeltas.push({
          key,
          fromSt: axis.id,
          id: ltId,
          from: before,
          to: after,
          delta: after - before,
        });
        changed = true;
      }
    }

    if (changed) {
      nextGraph[key] = { ...edge, shortTerm: nextSt, longTerm: nextLt };
    }
  }

  return { graph: nextGraph, hours, deltas, crystalDeltas };
}

export function summarizeLongTerm(scores: LongTermScores): string {
  return LONG_TERM_RELATIONSHIP_AXES.map(
    (a) => `${a.id}:${scores[a.id].toFixed(0)}`
  ).join(' ');
}

export function summarizeShortTerm(scores: ShortTermScores): string {
  return SHORT_TERM_RELATIONSHIP_AXES.filter((a) => scores[a.id] >= 1)
    .map((a) => `${a.id}:${scores[a.id].toFixed(0)}`)
    .join(' ');
}
