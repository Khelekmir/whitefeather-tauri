/**
 * Fleeting mood swings — unit-local, fast-decay emotions in the mood space.
 * Distinct from durable pressures (shame ≠ embarrassment) and from dyadic ST.
 */

export const FLEETING_MOOD_SWINGS = [
  {
    id: 'embarrassment',
    label: 'Embarrassment',
    blurb: 'Situational social exposure — flush of being seen, not moral stain',
  },
  {
    id: 'fluster',
    label: 'Fluster',
    blurb: 'Attraction-tinged exposure / butterflies under attention',
  },
  {
    id: 'thrill',
    label: 'Thrill',
    blurb: 'Bright spike of excitement or daring',
  },
  {
    id: 'spooked',
    label: 'Spooked',
    blurb: 'Startle / unease that has not yet settled into standing fear',
  },
  {
    id: 'smug',
    label: 'Smug',
    blurb: 'Fleeting self-satisfaction after a win or public claim',
  },
] as const;

export type FleetingMoodSwingId = (typeof FLEETING_MOOD_SWINGS)[number]['id'];

export type FleetingMoodSwingScores = Partial<Record<FleetingMoodSwingId, number>>;

/** Short lexicon fragments appended to mood tells when a swing is salient. */
export const FLEETING_SWING_TELLS: Record<
  FleetingMoodSwingId,
  { F: string; M: string }
> = {
  embarrassment: {
    F: 'color high in her cheeks from being seen',
    M: 'color high in his cheeks from being seen',
  },
  fluster: {
    F: 'a little flustered under the attention',
    M: 'a little flustered under the attention',
  },
  thrill: {
    F: 'a bright thrill still running under her skin',
    M: 'a bright thrill still running under his skin',
  },
  spooked: {
    F: 'still a touch spooked',
    M: 'still a touch spooked',
  },
  smug: {
    F: 'a private smugness she has not shaken yet',
    M: 'a private smugness he has not shaken yet',
  },
};
