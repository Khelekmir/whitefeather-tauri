// src/store/gameStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { GameState } from '../types/game';

interface GameStore {
  gameState: GameState;

  // Core actions
  setGameState: (state: GameState) => void;
  updateUnit: (unitId: string, updates: Partial<GameState['units'][0]>) => void;

  // Save / Load
  saveGameAutosave: () => Promise<void>;           // Rolling autosave
  saveGameManual: (filename: string) => Promise<void>; // Chapter / named saves
  loadGame: (filename?: string) => Promise<void>;  // Load autosave or specific file
  listSaves: () => Promise<string[]>;              // List all save files
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: {
    chapter: 1,
    turn: 1,
    phase: 'player',
    mapId: 'prologue',
    units: [],
    gold: 500,
    inventory: [],
    storyFlags: {},
    lastAutosave: new Date().toISOString(),
  },

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

  // Rolling autosave
  saveGameAutosave: async () => {
    try {
      const currentState = { ...get().gameState, lastAutosave: new Date().toISOString() };
      await invoke('save_game_autosave', { state: currentState });
      set({ gameState: currentState });
      console.log('✅ Autosave successful');
    } catch (err) {
      console.error('Autosave failed:', err);
    }
  },

  // Manual / Chapter save
  saveGameManual: async (filename: string) => {
    try {
      const currentState = { ...get().gameState, lastAutosave: new Date().toISOString() };
      await invoke('save_game_manual', { 
        filename, 
        state: currentState 
      });
      console.log(`✅ Saved as: ${filename}`);
    } catch (err) {
      console.error(`Failed to save as ${filename}:`, err);
    }
  },

  // Unified load function (used for both autosave and named saves)
  loadGame: async (filename?: string) => {
    try {
      let loaded: GameState;

      if (filename) {
        // Load specific save file
        loaded = await invoke<GameState>('load_game', { filename });
        console.log(`✅ Loaded: ${filename}`);
      } else {
        // Load rolling autosave
        loaded = await invoke<GameState>('load_game');
        console.log('✅ Loaded autosave');
      }

      set({ gameState: loaded });
    } catch (err) {
      console.error('Load failed:', err);
    }
  },

  // List all saves
  listSaves: async () => {
    try {
      return await invoke<string[]>('list_saves');
    } catch (err) {
      console.error('Failed to list saves:', err);
      return [];
    }
  },
}));