import type { Airport, AirportSize } from '@/types';

export interface HubUpgradeState {
  terminalLevel: number;
  loungeLevel: number;
}

export const MAX_HUB_TERMINAL_LEVEL = 3;
export const MAX_FIRST_CLASS_LOUNGE_LEVEL = 3;

const TERMINAL_CAPACITY_MULTIPLIER = [1, 1.35, 1.8, 2.5];
const LOUNGE_DEMAND_MULTIPLIER = [1, 1.06, 1.12, 1.2];

const TERMINAL_BASE_COST: Record<AirportSize, number> = {
  small: 60_000_000,
  medium: 140_000_000,
  large: 350_000_000,
  major: 800_000_000,
};

const LOUNGE_BASE_COST: Record<AirportSize, number> = {
  small: 18_000_000,
  medium: 45_000_000,
  large: 120_000_000,
  major: 260_000_000,
};

function clampLevel(value: unknown, max: number): number {
  return Math.min(max, Math.max(0, Math.floor(typeof value === 'number' ? value : 0)));
}

export function getHubTerminalLevel(airport: Airport): number {
  return clampLevel(airport.hubTerminalLevel, MAX_HUB_TERMINAL_LEVEL);
}

export function getFirstClassLoungeLevel(airport: Airport): number {
  return clampLevel(airport.firstClassLoungeLevel, MAX_FIRST_CLASS_LOUNGE_LEVEL);
}

export function getHubCapacityMultiplier(airport: Airport): number {
  return TERMINAL_CAPACITY_MULTIPLIER[getHubTerminalLevel(airport)] ?? 1;
}

export function getHubDemandMultiplier(airport: Airport): number {
  if (!airport.isHub) return 1;
  return LOUNGE_DEMAND_MULTIPLIER[getFirstClassLoungeLevel(airport)] ?? 1;
}

export function getHubTerminalUpgradeCost(airport: Airport): number | null {
  const nextLevel = getHubTerminalLevel(airport) + 1;
  if (nextLevel > MAX_HUB_TERMINAL_LEVEL) return null;
  return Math.round((TERMINAL_BASE_COST[airport.size] ?? TERMINAL_BASE_COST.medium) * (1 + (nextLevel - 1) * 0.75));
}

export function getFirstClassLoungeUpgradeCost(airport: Airport): number | null {
  const nextLevel = getFirstClassLoungeLevel(airport) + 1;
  if (nextLevel > MAX_FIRST_CLASS_LOUNGE_LEVEL) return null;
  return Math.round((LOUNGE_BASE_COST[airport.size] ?? LOUNGE_BASE_COST.medium) * (1 + (nextLevel - 1) * 0.65));
}

export function getHubUpgradeState(airport: Airport): HubUpgradeState {
  return {
    terminalLevel: getHubTerminalLevel(airport),
    loungeLevel: getFirstClassLoungeLevel(airport),
  };
}
