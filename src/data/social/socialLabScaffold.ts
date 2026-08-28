/**
 * Scaffold data for the Social lab — not the final simulation model.
 * Tasks / moods / relationship axes will grow into real systems later.
 */

/** Mood presets for lab interaction (subset of story mood notes). */
export const SOCIAL_LAB_MOODS = [
  'Content',
  'Cheerful',
  'Playful',
  'Relaxed',
  'Confident',
  'Curious',
  'Anxious',
  'Irritable',
  'Melancholy',
  'Tired',
  'Focused',
  'Wary',
] as const;

export type SocialLabMood = (typeof SOCIAL_LAB_MOODS)[number];

export type SocialTaskKind = 'chore' | 'camp' | 'travel' | 'talk' | 'leisure';

/** Working-title catalog: tasks / actions / events characters can share. */
export interface SocialTaskTemplate {
  id: string;
  label: string;
  kind: SocialTaskKind;
  /** Short blurb for the lab UI. */
  blurb: string;
  /** Suggested participant count (lab still allows primary+partner). */
  minParticipants: number;
  maxParticipants: number;
  /** Placeholder outcome tags — not wired to real math yet. */
  stubEffects: string[];
}

export const SOCIAL_TASK_TEMPLATES: SocialTaskTemplate[] = [
  {
    id: 'gather_firewood',
    label: 'Gather firewood',
    kind: 'chore',
    blurb: 'Collect deadfall and split kindling for the night’s fire.',
    minParticipants: 1,
    maxParticipants: 3,
    stubEffects: ['+rapport (shared work)', '−fatigue optional', 'camp readiness'],
  },
  {
    id: 'strike_camp',
    label: 'Strike camp',
    kind: 'camp',
    blurb: 'Pack tents, douse coals, load the caravan.',
    minParticipants: 2,
    maxParticipants: 6,
    stubEffects: ['+unit cohesion', 'time cost', 'stress if rushed'],
  },
  {
    id: 'set_up_camp',
    label: 'Set up camp',
    kind: 'camp',
    blurb: 'Choose ground, raise shelters, dig a fire pit.',
    minParticipants: 2,
    maxParticipants: 6,
    stubEffects: ['+safety', '+comfort', 'personality clashes possible'],
  },
  {
    id: 'scout_path',
    label: 'Scout the path ahead',
    kind: 'travel',
    blurb: 'Walk the next stretch and report hazards.',
    minParticipants: 1,
    maxParticipants: 2,
    stubEffects: ['+trust if reliable', 'injury risk stub', 'map intel'],
  },
  {
    id: 'share_watch',
    label: 'Share a night watch',
    kind: 'talk',
    blurb: 'Keep the fire and talk quietly while others sleep.',
    minParticipants: 2,
    maxParticipants: 2,
    stubEffects: ['+intimacy (non-erotic)', 'mood sync', 'secret chance'],
  },
  {
    id: 'cook_meal',
    label: 'Cook a shared meal',
    kind: 'leisure',
    blurb: 'Prepare supper from stores and forage.',
    minParticipants: 1,
    maxParticipants: 4,
    stubEffects: ['+happiness', '+relationship', 'food quality stub'],
  },
  {
    id: 'tend_wounds',
    label: 'Tend wounds',
    kind: 'chore',
    blurb: 'Clean and dress injuries after a scrap.',
    minParticipants: 2,
    maxParticipants: 2,
    stubEffects: ['+gratitude', '−stress (patient)', 'skill check stub'],
  },
];

/** Dev-facing relationship facets (placeholder scores 0–100). */
export const RELATIONSHIP_AXES = [
  { id: 'affinity', label: 'Affinity', blurb: 'General warmth / liking' },
  { id: 'trust', label: 'Trust', blurb: 'Reliability under pressure' },
  { id: 'respect', label: 'Respect', blurb: 'Esteem for competence / honor' },
  { id: 'tension', label: 'Tension', blurb: 'Friction, rivalry, unresolved heat' },
] as const;

export type RelationshipAxisId = (typeof RELATIONSHIP_AXES)[number]['id'];

export type RelationshipScores = Record<RelationshipAxisId, number>;

export function defaultRelationshipScores(): RelationshipScores {
  return {
    affinity: 50,
    trust: 50,
    respect: 50,
    tension: 20,
  };
}

/** Stable unordered pair key for lab relationship map. */
export function relationshipPairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}
