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
const SAVE_VERSION = 5;

function uniqueExistingIds(ids: unknown, exists: (id: string) => boolean): string[] {
  if (!Array.isArray(ids)) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  ids.forEach(id => {
    if (typeof id !== 'string' || seen.has(id) || !exists(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result;
}

function sanitizePersistedState(state: Partial<GameStore>): Partial<GameStore> {
  const { airports: _airports, ...stateWithoutStaticAirports } = state;
  const aiRoutes = state.aiRoutes ?? {};
  const aiAircraft = state.aiAircraft ?? {};
  const routes = state.routes ?? {};
  const aircraft = state.aircraft ?? {};

  const aiAirlines = Object.fromEntries(
    Object.entries(state.aiAirlines ?? {}).map(([id, airline]) => [
      id,
      {
        ...airline,
        routeIds: uniqueExistingIds(airline.routeIds, routeId => aiRoutes[routeId]?.airlineId === id),
        fleetIds: uniqueExistingIds(airline.fleetIds, aircraftId => aiAircraft[aircraftId]?.airlineId === id),
      },
    ]),
  );

  const airlines = Object.fromEntries(
    Object.entries(state.airlines ?? {}).map(([id, airline]) => [
      id,
      {
        ...airline,
        routeIds: uniqueExistingIds(airline.routeIds, routeId => routes[routeId]?.airlineId === id),
        fleetIds: uniqueExistingIds(airline.fleetIds, aircraftId => aircraft[aircraftId]?.airlineId === id),
      },
    ]),
  );

  const sanitized: Partial<GameStore> = {
    ...stateWithoutStaticAirports,
    airlines,
    aiAirlines,
    speed: VALID_GAME_SPEEDS.has(state.speed as number) ? state.speed : DEFAULT_GAME_SPEED,
    isPaused: false,
  };

  if (Array.isArray(state.newsTicker)) sanitized.newsTicker = state.newsTicker.slice(0, 20);

  return sanitized;
}

function migratePersistedState(persistedState: unknown): unknown {
  if (!persistedState || typeof persistedState !== 'object') return persistedState;

  const state = persistedState as Partial<GameStore>;
  return sanitizePersistedState(state);
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
      version: SAVE_VERSION,
      migrate: migratePersistedState,
      partialize: (state) => {
        // Exclude transient UI state from persistence
        const { selectedAirportIata: _s, selectedRouteId: _r, openPanel: _p, openModal: _m, modalPayload: _mp, airports: _a, ...rest } = state;
        return sanitizePersistedState(rest);
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
