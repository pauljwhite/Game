export const FUEL_PRICE_USD_PER_LITER = 0.82;
export const HUB_COST_DISCOUNT = 0.15;
export const HUB_DEMAND_BONUS = 1.20;
export const HUB_ANNUAL_FEE_USD = 2_000_000;
export const CREW_COST_PER_FLIGHT_HOUR_USD = 400;
export const PRICE_ELASTICITY = -1.4;
export const REPUTATION_DEMAND_FACTOR = 0.005;
export const CRASH_SCALE_FACTOR = 0.0008;
export const CRASH_REPUTATION_HIT = 25;
export const CRASH_FINE_USD = 50_000_000;
export const CRASH_DEMAND_PENALTY_DAYS = 30;
export const CRASH_DEMAND_PENALTY_PCT = 0.15;
export const MAINTENANCE_RESTORE_PARTIAL = 40;
export const CONDITION_GROUNDING_THRESHOLD = 20;
export const CONDITION_WARNING_THRESHOLD = 35;
export const REPUTATION_RECOVERY_PER_DAY = 0.1;
export const PR_CAMPAIGN_COST = 5_000_000;
export const PR_CAMPAIGN_BOOST = 10;

export const GAME_EPOCH_YEAR = 1960;
export const DAY_MS = 86_400_000;
export const YEAR_MS = DAY_MS * 365;

export const STARTING_CASH: Record<string, number> = {
  easy: 50_000_000,
  normal: 30_000_000,
  hard: 15_000_000,
};

export const WIN_MARKET_SHARE = 50;
export const LOSE_CASH_THRESHOLD = -100_000_000;
