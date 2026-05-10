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
    saveGame: () => Promise<void>;                    // Rolling autosave
    loadGame: () => Promise<void>;                    // Load autosave
    saveGameNamed: (filename: string) => Promise<void>; // Manual / chapter saves
    listSaves: () => Promise<string[]>;               // List all save files
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

    // Rolling autosave (overwrites autosave.json)
    saveGame: async () => {
        try {
            const currentState = { ...get().gameState, lastAutosave: new Date().toISOString() };
            await invoke('save_game', { state: currentState });
            set({ gameState: currentState });
            console.log('✅ Autosave successful');
        } catch (err) {
            console.error('Autosave failed:', err);
        }
    },

    // Load the rolling autosave
    loadGame: async () => {
        try {
            const loaded = await invoke<GameState>('load_game');
            set({ gameState: loaded });
            console.log('✅ Game loaded from autosave');
        } catch (err) {
            console.error('Load failed:', err);
        }
    },

    // Named save (chapter saves, manual saves, etc.)
    saveGameNamed: async (filename: string) => {
        try {
            const currentState = { ...get().gameState, lastAutosave: new Date().toISOString() };
            await invoke('save_game_named', {
                filename,
                state: currentState
            });
            console.log(`✅ Saved as: ${filename}`);
        } catch (err) {
            console.error(`Failed to save as ${filename}:`, err);
        }
    },

    // List all available save files
    listSaves: async () => {
        try {
            return await invoke<string[]>('list_saves');
        } catch (err) {
            console.error('Failed to list saves:', err);
            return [];
        }
    },
}));