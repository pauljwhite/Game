export type GameSpeed = 0 | 60 | 300 | 1200 | 3600 | 14400;
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameObjective = 'last_airline_standing' | 'market_share';

export interface GameSettings {
  playerAirlineName: string;
  playerAirlineColor: string;
  playerAirlineEmoji: string;
  startingCash: number;
  difficulty: Difficulty;
  aiCount: number;
  startingYear: number;
  objective: GameObjective;
  targetMarketShare: number;
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
  hasWon: boolean;
}
