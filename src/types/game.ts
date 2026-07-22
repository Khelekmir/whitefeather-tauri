export interface Position { x: number; y: number; }

export interface Unit {
  id: string;
  name: string;
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
  inventory: string[];
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
  inventory: [],
  storyFlags: {},
  lastAutosave: new Date().toISOString(),
});