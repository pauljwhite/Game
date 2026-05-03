import type { StateCreator } from 'zustand';
import type { GameState, GameSettings, GameSpeed } from '@/types';
import type { GameStore } from './index';

export interface GameSlice {
  gameTimeMs: number;
  speed: GameSpeed;
  isPaused: boolean;
  gameDay: number;
  lastEconomicsTick: number;
  settings: GameSettings;
  version: string;
  isInitialized: boolean;

  advanceTime: (newGameTimeMs: number, newGameDay: number) => void;
  setSpeed: (speed: GameSpeed) => void;
  togglePause: () => void;
  setLastEconomicsTick: (day: number) => void;
  initGameSettings: (settings: GameSettings) => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  playerAirlineName: 'My Airline',
  playerAirlineColor: '#3b82f6',
  playerAirlineEmoji: '✈️',
  startingCash: 30_000_000,
  difficulty: 'normal',
  aiCount: 6,
};

export const createGameSlice: StateCreator<GameStore, [['zustand/immer', never]], [], GameSlice> = (set) => ({
  gameTimeMs: 0,
  speed: 1,
  isPaused: false,
  gameDay: 0,
  lastEconomicsTick: -1,
  settings: DEFAULT_SETTINGS,
  version: '1.0.0',
  isInitialized: false,

  advanceTime: (newGameTimeMs, newGameDay) =>
    set((state) => {
      state.gameTimeMs = newGameTimeMs;
      state.gameDay = newGameDay;
    }),

  setSpeed: (speed) =>
    set((state) => {
      state.speed = speed;
      if (speed === 0) state.isPaused = true;
      else state.isPaused = false;
    }),

  togglePause: () =>
    set((state) => { state.isPaused = !state.isPaused; }),

  setLastEconomicsTick: (day) =>
    set((state) => { state.lastEconomicsTick = day; }),

  initGameSettings: (settings) =>
    set((state) => {
      state.settings = settings;
      state.isInitialized = true;
    }),
});

export type { GameState };
