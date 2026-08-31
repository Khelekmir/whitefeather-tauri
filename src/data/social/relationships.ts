/**
 * Directed interpersonal relationships (A → B).
 *
 * Long-term: standing bond (0–100). No idle decay for now — only event writers move them.
 * Short-term: scene weather (0–100 intensity). Idle decay toward 0 on time passage.
 *
 * Desire (LT + ST heat) is first-class for romance / intimate attempts.
 * Sexual Desire is never M→M (hard ban). F→F is a thematic pillar: Whitewing /
 * Whitefeather / attractedToGirls open Desire fully; otherwise F→F Desire is
 * soft-capped and erodable via closeness (see orientationDesire.ts).
 */

export const LONG_TERM_RELATIONSHIP_AXES = [
  {
    id: 'trust',
    label: 'Trust',
    blurb: 'Will they keep me safe / keep their word?',
  },
  {
    id: 'respect',
    label: 'Respect',
    blurb: 'Esteem for competence, courage, honor',
  },
  {
    id: 'affection',
    label: 'Affection',
    blurb: 'Warmth / liking / care for them',
  },
  {
    id: 'familiarity',
    label: 'Familiarity',
    blurb: 'How well I actually know them',
  },
  {
    id: 'desire',
    label: 'Desire',
    blurb: 'Standing romantic / sexual interest in them',
  },
  {
    id: 'fear',
    label: 'Fear',
    blurb: 'Threat they pose to me (capture / power — mostly future writers)',
  },
  {
    id: 'obligation',
    label: 'Obligation',
    blurb: 'Debt or claim I feel toward them (rescue / patronage — future)',
  },
  {
    id: 'rivalry',
    label: 'Rivalry',
    blurb: 'Romantic or status competition over a shared interest (future)',
  },
] as const;

export const SHORT_TERM_RELATIONSHIP_AXES = [
  {
    id: 'irritation',
    label: 'Irritation',
    blurb: 'Snappish residual from recent friction',
  },
  {
    id: 'gratitude',
    label: 'Gratitude',
    blurb: 'Inclined to repay / indulge after help',
  },
  {
    id: 'admiration',
    label: 'Admiration',
    blurb: 'Temporary glow after competence, courage, or grace',
  },
  {
    id: 'warmth',
    label: 'Warmth',
    blurb: 'Soft goodwill left after a good beat',
  },
  {
    id: 'hurt',
    label: 'Hurt',
    blurb: 'Bruised by insult, neglect, or rejection',
  },
  {
    id: 'suspicion',
    label: 'Suspicion',
    blurb: 'Watching for the next tell',
  },
  {
    id: 'desireHeat',
    label: 'Desire heat',
    blurb: 'Momentary attraction spike (not standing Desire)',
  },
  {
    id: 'guilt',
    label: 'Guilt',
    blurb: 'Over another partner when acting romantically elsewhere',
  },
] as const;

export type LongTermRelationshipId = (typeof LONG_TERM_RELATIONSHIP_AXES)[number]['id'];
export type ShortTermRelationshipId = (typeof SHORT_TERM_RELATIONSHIP_AXES)[number]['id'];

export type LongTermScores = Record<LongTermRelationshipId, number>;
export type ShortTermScores = Record<ShortTermRelationshipId, number>;

export interface DirectedRelationship {
  fromId: string;
  toId: string;
  longTerm: LongTermScores;
  shortTerm: ShortTermScores;
}

/** Stranger / newly met defaults (LT 0–100). */
export function defaultLongTermScores(): LongTermScores {
  return {
    trust: 45,
    respect: 50,
    affection: 40,
    familiarity: 15,
    desire: 0,
    fear: 5,
    obligation: 0,
    rivalry: 0,
  };
}

/** Nothing pending between us (ST 0–100). */
export function defaultShortTermScores(): ShortTermScores {
  return {
    irritation: 0,
    gratitude: 0,
    admiration: 0,
    warmth: 0,
    hurt: 0,
    suspicion: 0,
    desireHeat: 0,
    guilt: 0,
  };
}

export function defaultDirectedRelationship(
  fromId: string,
  toId: string
): DirectedRelationship {
  return {
    fromId,
    toId,
    longTerm: defaultLongTermScores(),
    shortTerm: defaultShortTermScores(),
  };
}

/** Directed edge key: feelings of `from` toward `to`. */
export function relationshipEdgeKey(fromId: string, toId: string): string {
  return `${fromId}->${toId}`;
}

export function clampLongTerm(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function clampShortTerm(n: number): number {
  return Math.max(0, Math.min(100, n));
}
