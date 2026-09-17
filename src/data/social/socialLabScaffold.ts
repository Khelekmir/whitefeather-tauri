/**
 * Social task catalog for the Social lab.
 * One list for now (chores / talk / leisure / camp / travel) — split Task /
 * Action / Event catalogs later when schedules need different fields.
 *
 * Real effect math lives in `utils/social/resolveSocialTask.ts`.
 * `stubEffects` remain human blurbs for the UI.
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

/** Working catalog: tasks / actions / events characters can share. */
export interface SocialTaskTemplate {
  id: string;
  label: string;
  kind: SocialTaskKind;
  /** Short blurb for the lab UI. */
  blurb: string;
  /** Suggested participant count (lab still allows primary+partner). */
  minParticipants: number;
  maxParticipants: number;
  /** Soft time cost for UI / future Pass Time coupling (not auto-run yet). */
  timeCostMinutes?: number;
  /** Soft-fail in resolver when partner is missing. */
  requiresPartner?: boolean;
  /** Human outcome tags — real math is in resolveSocialTask handlers. */
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
    timeCostMinutes: 45,
    stubEffects: ['+rapport (shared work)', '−fatigue optional', 'camp readiness'],
  },
  {
    id: 'strike_camp',
    label: 'Strike camp',
    kind: 'camp',
    blurb: 'Pack tents, douse coals, load the caravan.',
    minParticipants: 2,
    maxParticipants: 6,
    timeCostMinutes: 60,
    requiresPartner: true,
    stubEffects: ['+unit cohesion', 'time cost', 'stress if rushed'],
  },
  {
    id: 'set_up_camp',
    label: 'Set up camp',
    kind: 'camp',
    blurb: 'Choose ground, raise shelters, dig a fire pit.',
    minParticipants: 2,
    maxParticipants: 6,
    timeCostMinutes: 90,
    requiresPartner: true,
    stubEffects: ['+safety', '+comfort', 'personality clashes possible'],
  },
  {
    id: 'scout_path',
    label: 'Scout the path ahead',
    kind: 'travel',
    blurb: 'Walk the next stretch and report hazards.',
    minParticipants: 1,
    maxParticipants: 2,
    timeCostMinutes: 40,
    stubEffects: ['+trust if reliable', 'injury risk stub', 'map intel'],
  },
  {
    id: 'share_watch',
    label: 'Share a night watch',
    kind: 'talk',
    blurb: 'Keep the fire and talk quietly while others sleep.',
    minParticipants: 2,
    maxParticipants: 2,
    timeCostMinutes: 120,
    requiresPartner: true,
    stubEffects: ['+intimacy (non-erotic)', 'mood sync', 'secret chance'],
  },
  {
    id: 'cook_meal',
    label: 'Cook a shared meal',
    kind: 'leisure',
    blurb: 'Prepare supper from stores and forage.',
    minParticipants: 1,
    maxParticipants: 4,
    timeCostMinutes: 50,
    stubEffects: ['+happiness', '+relationship', 'food quality stub'],
  },
  {
    id: 'tend_wounds',
    label: 'Tend wounds',
    kind: 'chore',
    blurb: 'Clean and dress injuries after a scrap.',
    minParticipants: 2,
    maxParticipants: 2,
    timeCostMinutes: 25,
    requiresPartner: true,
    stubEffects: ['+gratitude', '−stress (patient)', 'skill check stub'],
  },
  {
    id: 'do_laundry',
    label: 'Do laundry',
    kind: 'chore',
    blurb: 'Wash soiled underthings and cloth — blood, seed, and travel grime.',
    minParticipants: 1,
    maxParticipants: 2,
    timeCostMinutes: 35,
    stubEffects: [
      'clear underwear soil',
      '+gratitude if washed for another',
      '−shame (owner)',
    ],
  },
  {
    id: 'bathe',
    label: 'Bathe',
    kind: 'chore',
    blurb: 'Wash the body clean; rinse crotch soil and camp dust.',
    minParticipants: 1,
    maxParticipants: 1,
    timeCostMinutes: 20,
    stubEffects: ['clear skin crotchSoil', '−wantsBath', '−stress soft'],
  },
  {
    id: 'bathe_together',
    label: 'Bathe together',
    kind: 'leisure',
    blurb: 'Share water and wash — practical, intimate, or both.',
    minParticipants: 2,
    maxParticipants: 2,
    timeCostMinutes: 30,
    requiresPartner: true,
    stubEffects: [
      'clear skin soil (both)',
      '+warmth',
      'desireHeat if attracted',
    ],
  },
];

export function getSocialTaskTemplate(id: string): SocialTaskTemplate | undefined {
  return SOCIAL_TASK_TEMPLATES.find((t) => t.id === id);
}
