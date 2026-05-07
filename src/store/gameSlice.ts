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
  hasWon: boolean;

  advanceTime: (newGameTimeMs: number, newGameDay: number) => void;
  setSpeed: (speed: GameSpeed) => void;
  togglePause: () => void;
  setLastEconomicsTick: (day: number) => void;
  initGameSettings: (settings: GameSettings) => void;
  setHasWon: () => void;
  resetGame: () => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  playerAirlineName: 'My Airline',
  playerAirlineColor: '#3b82f6',
  playerAirlineEmoji: '✈️',
  startingCash: 30_000_000,
  difficulty: 'normal',
  aiCount: 6,
  startingYear: 1960,
  objective: 'last_airline_standing',
  targetMarketShare: 60,
};

const DEFAULT_SPEED: GameSpeed = 300;

export const createGameSlice: StateCreator<GameStore, [['zustand/immer', never]], [], GameSlice> = (set) => ({
  gameTimeMs: 0,
  speed: DEFAULT_SPEED,
  isPaused: false,
  gameDay: 0,
  lastEconomicsTick: -1,
  settings: DEFAULT_SETTINGS,
  version: '1.0.0',
  isInitialized: false,
  hasWon: false,

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
      state.speed = DEFAULT_SPEED;
      state.isPaused = false;
      state.lastEconomicsTick = -1;
      state.isInitialized = true;
      state.hasWon = false;
    }),

  setHasWon: () =>
    set((state) => { state.hasWon = true; }),

  resetGame: () =>
    set((state) => {
      state.isInitialized = false;
      state.gameTimeMs = 0;
      state.gameDay = 0;
      state.lastEconomicsTick = -1;
      state.hasWon = false;
      state.speed = DEFAULT_SPEED;
      state.isPaused = false;
    }),
});

export type { GameState };
