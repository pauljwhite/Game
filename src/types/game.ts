export type GameSpeed = 0 | 1 | 5 | 10 | 50 | 100;
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface GameSettings {
  playerAirlineName: string;
  playerAirlineColor: string;
  playerAirlineEmoji: string;
  startingCash: number;
  difficulty: Difficulty;
  aiCount: number;
}

export interface GameState {
  settings: GameSettings;
  gameTimeMs: number;
  speed: GameSpeed;
  isPaused: boolean;
  gameDay: number;
  lastEconomicsTick: number;
  version: string;
  isInitialized: boolean;
}
