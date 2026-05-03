import type { Airline, Aircraft, Route } from '@/types';
import type { AircraftType } from '@/types/aircraft';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';

const typeMap = Object.fromEntries(AIRCRAFT_TYPES.map(t => [t.id, t]));

/**
 * Current resale value of an owned aircraft.
 * Depreciates with age, condition, and flight hours.
 */
export function computeAircraftValue(ac: Aircraft, type: AircraftType, currentGameDay: number): number {
  const ageDays  = Math.max(0, currentGameDay - ac.purchasedGameDay);
  const ageYears = ageDays / 365;

  // Age: linear depreciation to 20% floor over 20 years
  const ageFactor  = Math.max(0.20, 1 - ageYears / 20);
  // Condition: 20% floor at 0%, 100% at perfect condition
  const condFactor = 0.20 + 0.80 * (ac.condition / 100);
  // Hours: small penalty for high-cycle aircraft, 80% floor
  const hoursFactor = Math.max(0.80, 1 - ac.totalFlightHours / 100_000);

  return Math.round(type.purchasePrice * 0.75 * ageFactor * condFactor * hoursFactor);
}

export interface BuyoutValuation {
  fleetValue: number;    // residual aircraft value
  routeValue: number;    // 2× annual profit on profitable routes
  cashValue: number;     // positive cash held
  debtValue: number;     // debt to assume (negative)
  controlPremium: number;
  totalPrice: number;
}

export function calculateBuyoutPrice(
  target: Airline,
  aiAircraft: Record<string, Aircraft>,
  aiRoutes: Record<string, Route>,
): BuyoutValuation {
  // Fleet: residual value scales with condition (30% floor)
  const fleetValue = target.fleetIds.reduce((sum, id) => {
    const ac = aiAircraft[id];
    if (!ac) return sum;
    const type = typeMap[ac.typeId];
    if (!type) return sum;
    return sum + type.purchasePrice * (0.3 + 0.7 * (ac.condition / 100));
  }, 0);

  // Route network: 2 years of annual profit (profitable routes only)
  const annualProfit = target.routeIds.reduce((sum, id) => {
    const route = aiRoutes[id];
    if (!route) return sum;
    return sum + Math.max(0, route.dailyProfit * 365);
  }, 0);
  const routeValue = annualProfit * 2;

  const cashValue = Math.max(0, target.cashUSD);
  const debtValue = Math.abs(Math.min(0, target.cashUSD));

  const raw = fleetValue + routeValue + cashValue - debtValue;
  const controlPremium = Math.max(0, raw * 0.2);
  const totalPrice = Math.max(1_000_000, Math.round((raw + controlPremium) / 500_000) * 500_000);

  return { fleetValue, routeValue, cashValue, debtValue, controlPremium, totalPrice };
}

export function rawCompanyValue(
  target: Airline,
  aiAircraft: Record<string, Aircraft>,
  aiRoutes: Record<string, Route>,
): number {
  const fleetValue = target.fleetIds.reduce((sum, id) => {
    const ac = aiAircraft[id];
    if (!ac) return sum;
    const type = typeMap[ac.typeId];
    if (!type) return sum;
    return sum + type.purchasePrice * (0.3 + 0.7 * (ac.condition / 100));
  }, 0);
  const annualProfit = target.routeIds.reduce((sum, id) => {
    const route = aiRoutes[id];
    if (!route) return sum;
    return sum + Math.max(0, route.dailyProfit * 365);
  }, 0);
  const routeValue = annualProfit * 2;
  const cashAdj = target.cashUSD; // positive: asset, negative: liability
  return Math.max(0, fleetValue + routeValue + cashAdj);
}

export function calculateSharePrice(
  percentToBuy: number,
  currentPlayerPercent: number,
  target: Airline,
  aiAircraft: Record<string, Aircraft>,
  aiRoutes: Record<string, Route>,
  fromSecondaryMarket = false,
): number {
  const baseValue = rawCompanyValue(target, aiAircraft, aiRoutes);
  const pricePerPct = baseValue / 100;

  // Block size premium
  const willCrossMajority = currentPlayerPercent < 50 && (currentPlayerPercent + percentToBuy) >= 50;
  let blockMultiplier: number;
  if (willCrossMajority) {
    blockMultiplier = 1.25;
  } else if (percentToBuy > 25) {
    blockMultiplier = 1.1;
  } else if (percentToBuy > 10) {
    blockMultiplier = 1.05;
  } else {
    blockMultiplier = 1.0;
  }

  const secondaryPremium = fromSecondaryMarket ? 1.15 : 1.0;
  const total = pricePerPct * percentToBuy * blockMultiplier * secondaryPremium;
  return Math.round(total / 100_000) * 100_000; // round to nearest $100k
}
