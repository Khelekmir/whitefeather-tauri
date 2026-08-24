// src/store/gameStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { GameState } from '../types/game';
import { createEmptyGameState } from '../types/game';
import { PLACEHOLDER_CHARACTERS } from '../data/placeholderCharacters';

/** Fresh game state pre-loaded with development placeholder units. */
export const createInitialGameState = (): GameState => ({
  ...createEmptyGameState(),
  units: [...PLACEHOLDER_CHARACTERS],
});

/** Fill missing lightweight fields so older saves still type-check at runtime. */
function normalizeUnit(raw: Record<string, unknown>): GameState['units'][0] {
  const sex = raw.sex === 'M' || raw.sex === 'F' ? raw.sex : 'M';
  return {
    id: typeof raw.id === 'string' ? raw.id : `unit_${Date.now()}`,
    name: typeof raw.name === 'string' ? raw.name : 'Unknown',
    sex,
    age: typeof raw.age === 'number' ? raw.age : 0,
    description: typeof raw.description === 'string' ? raw.description : '',
    personality: typeof raw.personality === 'string' ? raw.personality : '',
    temperament: typeof raw.temperament === 'string' ? raw.temperament : '',
    note: typeof raw.note === 'string' ? raw.note : raw.note === null ? null : null,
    class: typeof raw.class === 'string' ? raw.class : 'Soldier',
    level: typeof raw.level === 'number' ? raw.level : 1,
    hp: typeof raw.hp === 'number' ? raw.hp : 20,
    maxHp: typeof raw.maxHp === 'number' ? raw.maxHp : 20,
    position:
      raw.position && typeof raw.position === 'object'
        ? {
            x: Number((raw.position as { x?: number }).x) || 0,
            y: Number((raw.position as { y?: number }).y) || 0,
          }
        : { x: 0, y: 0 },
    allegiance:
      raw.allegiance === 'enemy' || raw.allegiance === 'ally' || raw.allegiance === 'player'
        ? raw.allegiance
        : 'player',
    relationship: typeof raw.relationship === 'number' ? raw.relationship : 50,
    arousal: typeof raw.arousal === 'number' ? raw.arousal : 0,
    stress: typeof raw.stress === 'number' ? raw.stress : 0,
    traits: Array.isArray(raw.traits) ? (raw.traits as string[]) : [],
  };
}

/** Normalize a loaded payload into a full GameState (legacy field names, missing keys). */
function normalizeGameState(raw: Partial<GameState> & Record<string, unknown>): GameState {
  const legacyInventory = raw.inventory;
  const caravan = Array.isArray(raw.caravan)
    ? raw.caravan
    : Array.isArray(legacyInventory)
      ? (legacyInventory as string[])
      : [];

  const units = Array.isArray(raw.units)
    ? raw.units.map((u) => normalizeUnit((u ?? {}) as unknown as Record<string, unknown>))
    : [];

  return {
    chapter: typeof raw.chapter === 'number' ? raw.chapter : 1,
    turn: typeof raw.turn === 'number' ? raw.turn : 1,
    phase: (raw.phase as GameState['phase']) || 'player',
    mapId: typeof raw.mapId === 'string' ? raw.mapId : 'prologue',
    units,
    gold: typeof raw.gold === 'number' ? raw.gold : 0,
    caravan,
    storyFlags:
      raw.storyFlags && typeof raw.storyFlags === 'object'
        ? (raw.storyFlags as Record<string, boolean>)
        : {},
    lastAutosave:
      typeof raw.lastAutosave === 'string'
        ? raw.lastAutosave
        : new Date().toISOString(),
  };
}

interface GameStore {
  gameState: GameState;
  /** Last save/load message for DevBuild feedback */
  lastSaveMessage: string | null;

  // Core actions
  setGameState: (state: GameState) => void;
  updateUnit: (unitId: string, updates: Partial<GameState['units'][0]>) => void;
  /** Replace roster with the built-in placeholder cast (dev convenience). */
  loadPlaceholderCharacters: () => void;
  clearSaveMessage: () => void;

  // Save / Load — return true on success
  saveGameAutosave: () => Promise<boolean>;
  saveGameManual: (filename: string) => Promise<boolean>;
  loadGame: (filename?: string) => Promise<boolean>;
  deleteGame: (filename: string) => Promise<boolean>;
  listSaves: () => Promise<string[]>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialGameState(),
  lastSaveMessage: null,

  setGameState: (state) => set({ gameState: state }),

  updateUnit: (unitId, updates) => {
    set((state) => ({
      gameState: {
        ...state.gameState,
        units: state.gameState.units.map((unit) =>
          unit.id === unitId ? { ...unit, ...updates } : unit
        ),
      },
    }));
  },

  loadPlaceholderCharacters: () => {
    set((state) => ({
      gameState: {
        ...state.gameState,
        units: [...PLACEHOLDER_CHARACTERS],
      },
      lastSaveMessage: `Loaded placeholder cast (${PLACEHOLDER_CHARACTERS.length} units)`,
    }));
  },

  clearSaveMessage: () => set({ lastSaveMessage: null }),

  saveGameAutosave: async () => {
    try {
      const currentState = {
        ...get().gameState,
        lastAutosave: new Date().toISOString(),
      };
      await invoke('save_game_autosave', { state: currentState });
      set({
        gameState: currentState,
        lastSaveMessage: 'Autosave successful',
      });
      console.log('✅ Autosave successful');
      return true;
    } catch (err) {
      const msg = `Autosave failed: ${err}`;
      console.error(msg);
      set({ lastSaveMessage: msg });
      return false;
    }
  },

  saveGameManual: async (filename: string) => {
    try {
      const currentState = {
        ...get().gameState,
        lastAutosave: new Date().toISOString(),
      };
      await invoke('save_game_manual', {
        filename,
        state: currentState,
      });
      set({ lastSaveMessage: `Saved as: ${filename}` });
      console.log(`✅ Saved as: ${filename}`);
      return true;
    } catch (err) {
      const msg = `Failed to save as ${filename}: ${err}`;
      console.error(msg);
      set({ lastSaveMessage: msg });
      return false;
    }
  },

  loadGame: async (filename?: string) => {
    try {
      let loaded: GameState;

      if (filename) {
        loaded = await invoke<GameState>('load_game', { filename });
        console.log(`✅ Loaded: ${filename}`);
      } else {
        loaded = await invoke<GameState>('load_game');
        console.log('✅ Loaded autosave');
      }

      const normalized = normalizeGameState(loaded as GameState & Record<string, unknown>);
      set({
        gameState: normalized,
        lastSaveMessage: filename
          ? `Loaded: ${filename} (${normalized.units.length} units)`
          : `Loaded autosave (${normalized.units.length} units)`,
      });
      return true;
    } catch (err) {
      // No autosave yet is common on first run — keep current state
      const msg = filename
        ? `Load failed (${filename}): ${err}`
        : `Autosave load skipped: ${err}`;
      console.warn(msg);
      // Only surface as an error message when a specific file was requested
      if (filename) {
        set({ lastSaveMessage: msg });
      }
      return false;
    }
  },

  deleteGame: async (filename: string) => {
    try {
      await invoke('delete_game', { filename });
      set({ lastSaveMessage: `Deleted: ${filename}` });
      console.log(`✅ Deleted: ${filename}`);
      return true;
    } catch (err) {
      const msg = `Failed to delete ${filename}: ${err}`;
      console.error(msg);
      set({ lastSaveMessage: msg });
      return false;
    }
  },

  listSaves: async () => {
    try {
      return await invoke<string[]>('list_saves');
    } catch (err) {
      console.error('Failed to list saves:', err);
      return [];
    }
  },
}));
