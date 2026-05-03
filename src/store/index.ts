import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import { createGameSlice, type GameSlice } from './gameSlice';
import { createPlayerSlice, type PlayerSlice } from './playerSlice';
import { createWorldSlice, type WorldSlice } from './worldSlice';
import { createUISlice, type UISlice } from './uiSlice';

export type GameStore = GameSlice & PlayerSlice & WorldSlice & UISlice;

const VALID_GAME_SPEEDS = new Set([0, 60, 300, 1200, 3600, 14400]);
const DEFAULT_GAME_SPEED = 300;

function migratePersistedState(persistedState: unknown): unknown {
  if (!persistedState || typeof persistedState !== 'object') return persistedState;

  const state = persistedState as Partial<GameStore>;
  if (VALID_GAME_SPEEDS.has(state.speed as number)) return state;

  return {
    ...state,
    speed: DEFAULT_GAME_SPEED,
    isPaused: false,
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    immer((...a) => ({
      ...createGameSlice(...a),
      ...createPlayerSlice(...a),
      ...createWorldSlice(...a),
      ...createUISlice(...a),
    })),
    {
      name: 'airline-empire-save',
      version: 3,
      migrate: migratePersistedState,
      partialize: (state) => {
        // Exclude transient UI state from persistence
        const { selectedAirportIata: _s, selectedRouteId: _r, openPanel: _p, openModal: _m, modalPayload: _mp, ...rest } = state;
        return rest;
      },
    },
  ),
);

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated());
  useEffect(() => {
    if (!hydrated) {
      const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
      return unsub;
    }
  }, [hydrated]);
  return hydrated;
}
