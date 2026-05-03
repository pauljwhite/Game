export type AirlinePersonality =
  | 'aggressive'
  | 'balanced'
  | 'conservative'
  | 'budget'
  | 'premium';

export interface DailySnapshot {
  gameDay: number;
  revenue: number;
  costs: number;
  profit: number;
  passengers: number;
  cashEnd: number;
}

export interface Airline {
  id: string;
  name: string;
  iataPrefix: string;
  isPlayer: boolean;
  color: string;
  logoEmoji: string;
  cashUSD: number;
  totalDebt: number;
  hubIatas: string[];
  fleetIds: string[];
  routeIds: string[];
  personality: AirlinePersonality;
  foundedGameDay: number;
  isInsolvent: boolean;
  canBeTakenOver: boolean;
  marketSharePercent: number;
  reputationScore: number;
  totalPassengersAllTime: number;
  dailyStats: DailySnapshot[];
  crashPenaltyDaysLeft: number;
}
