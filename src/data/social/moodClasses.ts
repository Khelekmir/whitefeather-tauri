/**
 * Gameplay mood classes — mechanics care about these.
 * Flavor text is a presentation layer on top.
 */
export const MOOD_CLASSES = [
  'open',
  'warm',
  'playful',
  'driven',
  'affectionate',
  'withdrawn',
  'irritable',
  'anxious',
  'melancholy',
  'tired',
  'overwhelmed',
  'frustrated',
] as const;

export type MoodClass = (typeof MOOD_CLASSES)[number];

/** How a mood class tends to modify social / relationship gains (stub multipliers). */
export interface MoodReceptivity {
  /** Shared chores, camp labor */
  chore: number;
  /** Talks, watches, confessions */
  talk: number;
  /** Conflict, rivalry beats */
  friction: number;
  /** Soft affection / bonding (non-erotic) */
  bond: number;
}

export const MOOD_RECEPTIVITY: Record<MoodClass, MoodReceptivity> = {
  open: { chore: 1.1, talk: 1.2, friction: 0.9, bond: 1.15 },
  warm: { chore: 1.15, talk: 1.25, friction: 0.8, bond: 1.3 },
  playful: { chore: 1.05, talk: 1.15, friction: 0.85, bond: 1.2 },
  driven: { chore: 1.25, talk: 0.9, friction: 1.1, bond: 0.95 },
  affectionate: { chore: 1.05, talk: 1.2, friction: 0.75, bond: 1.35 },
  withdrawn: { chore: 0.85, talk: 0.7, friction: 0.9, bond: 0.75 },
  irritable: { chore: 0.8, talk: 0.65, friction: 1.35, bond: 0.7 },
  anxious: { chore: 0.9, talk: 0.85, friction: 1.15, bond: 0.9 },
  melancholy: { chore: 0.85, talk: 0.95, friction: 1.05, bond: 0.85 },
  tired: { chore: 0.7, talk: 0.8, friction: 1.0, bond: 0.85 },
  overwhelmed: { chore: 0.65, talk: 0.6, friction: 1.2, bond: 0.7 },
  frustrated: { chore: 0.85, talk: 0.75, friction: 1.3, bond: 0.8 },
};
