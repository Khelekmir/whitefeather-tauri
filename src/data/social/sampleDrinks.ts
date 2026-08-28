/**
 * Lab sample drinks for Playground — not inventory items yet.
 * Future alcohol items should expose the same volumeMl + abvPercent (+ kind).
 */
export type AlcoholKind = 'beer' | 'wine' | 'liquor' | 'mead';

/** How fast the held serving is drained while time passes. */
export type DrinkPace = 'slam' | 'quick' | 'moderate' | 'casual' | 'sip';

/** Instant volume bumps from the held serving (no time / metabolism). */
export type DrinkSipAction = 'gulp' | 'mouthful' | 'sip';

export interface AlcoholDrink {
  id: string;
  label: string;
  /** Serving volume in milliliters. */
  volumeMl: number;
  /** Alcohol by volume percent (5 = 5% ABV). */
  abvPercent: number;
  /** Maps to socialStats.static.alcoholTolerance keys when present. */
  kind: AlcoholKind;
}

/** In-progress serving on the character (Playground / future tavern). */
export interface HeldDrink {
  drink: AlcoholDrink;
  remainingMl: number;
  pace: DrinkPace;
}

export const SAMPLE_DRINKS: AlcoholDrink[] = [
  { id: 'ale', label: 'Ale', volumeMl: 355, abvPercent: 5, kind: 'beer' },
  { id: 'wine', label: 'Wine', volumeMl: 150, abvPercent: 12, kind: 'wine' },
  { id: 'spirits', label: 'Spirits', volumeMl: 44, abvPercent: 40, kind: 'liquor' },
  { id: 'mead', label: 'Mead', volumeMl: 300, abvPercent: 8, kind: 'mead' },
];

export const DRINK_PACES: DrinkPace[] = [
  'slam',
  'quick',
  'moderate',
  'casual',
  'sip',
];

export const DRINK_SIP_ACTIONS: DrinkSipAction[] = ['gulp', 'mouthful', 'sip'];
