export interface Position { x: number; y: number; }

/**
 * Lightweight roster unit (saves, Character List, DevBuild).
 * Detailed combat/social/lewd live in types/characters.ts.
 */
export interface Unit {
  id: string;
  name: string;
  sex: 'M' | 'F';
  age: number;
  description: string;

  /** From social_stats.static in the old character CSV */
  personality: string;
  temperament: string;
  note: string | null;

  class: string;
  level: number;
  hp: number;
  maxHp: number;
  position: Position;
  allegiance: 'player' | 'enemy' | 'ally';
  relationship: number;
  arousal: number;
  stress: number;
  traits: string[];
}

export interface GameState {
  chapter: number;
  turn: number;
  phase: 'player' | 'enemy' | 'ally' | 'cutscene' | 'campfire' | 'night';
  mapId: string;
  units: Unit[];
  gold: number;
  caravan: string[];
  storyFlags: Record<string, boolean>;
  lastAutosave: string;
}

export const createEmptyGameState = (): GameState => ({
  chapter: 1,
  turn: 1,
  phase: 'player',
  mapId: 'prologue',
  units: [],
  gold: 500,
  caravan: [],
  storyFlags: {},
  lastAutosave: new Date().toISOString(),
});
