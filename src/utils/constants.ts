export const FUEL_PRICE_USD_PER_LITER = 0.82;
export const HUB_COST_DISCOUNT = 0.15;
export const HUB_DEMAND_BONUS = 1.20;
export const HUB_ANNUAL_FEE_USD = 2_000_000;
export const CREW_COST_PER_FLIGHT_HOUR_USD = 400;
export const PRICE_ELASTICITY = -1.4;
export const REPUTATION_DEMAND_FACTOR = 0.005;
export const AIRPORT_BASE_CAPACITY: Record<string, number> = {
  small: 300, medium: 1_200, large: 4_000, major: 12_000,
};
export const AIRPORT_DEMAND_GROWTH_RATE = 0.015; // 1.5%/game-year from 1960
// Reputation as price premium: passengers treat your price as (price / premium) where
// premium = 1 + (reputationScore - 50) * REP_PRICE_FACTOR
// Rep 100 → 1.2× premium (can charge ~20% more for same share); rep 0 → 0.8× (25% penalty)
export const REP_PRICE_FACTOR = 0.004;
export const CRASH_SCALE_FACTOR = 0.0008;
export const CRASH_REPUTATION_HIT = 25;
export const CRASH_FINE_USD = 50_000_000;
export const CRASH_DEMAND_PENALTY_DAYS = 30;
export const CRASH_DEMAND_PENALTY_PCT = 0.15;
export const MAINTENANCE_RESTORE_PARTIAL = 40;

import type { MaintenanceTier } from '@/types/aircraft';
export type { MaintenanceTier };

export const MAINTENANCE_TIERS: Record<MaintenanceTier, {
  label: string;
  conditionGain: number;  // 999 = restore to 100
  minHoursBase: number;
  hoursOwedFactor: number;
  costMultiplier: number;
  durationDays: number;
  desc: string;
}> = {
  light: {
    label: 'Light',
    conditionGain: 20,
    minHoursBase: 3,
    hoursOwedFactor: 0.5,
    costMultiplier: 2.0,
    durationDays: 1,
    desc: '+20 condition, 1 day. Cheap but poor value per point.',
  },
  standard: {
    label: 'Standard',
    conditionGain: 50,
    minHoursBase: 6,
    hoursOwedFactor: 1.0,
    costMultiplier: 1.5,
    durationDays: 2,
    desc: '+50 condition, 2 days. Best cost-per-point balance.',
  },
  full: {
    label: 'Full Overhaul',
    conditionGain: 999,
    minHoursBase: 10,
    hoursOwedFactor: 1.0,
    costMultiplier: 2.2,
    durationDays: 4,
    desc: 'Restore to 100%, 4 days. Most efficient when badly degraded.',
  },
};

export function computeMaintenanceCost(tier: MaintenanceTier, hoursOwed: number, ratePerHour: number): number {
  const cfg = MAINTENANCE_TIERS[tier];
  const hoursBilled = Math.max(cfg.minHoursBase, hoursOwed * cfg.hoursOwedFactor);
  return Math.round(hoursBilled * ratePerHour * cfg.costMultiplier);
}
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
