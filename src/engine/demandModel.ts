import type { Airport, Route, Airline } from '@/types';
import { PRICE_ELASTICITY, REP_PRICE_FACTOR, AIRPORT_BASE_CAPACITY, AIRPORT_DEMAND_GROWTH_RATE } from '@/utils/constants';

const SIZE_MULTIPLIER: Record<string, number> = {
  small: 0.3, medium: 1.0, large: 2.5, major: 5.0,
};

export function getBaselineDailyPax(origin: Airport, dest: Airport): number {
  const distFactor = 1 / (1 + Math.sqrt((origin.lat - dest.lat) ** 2 + (origin.lon - dest.lon) ** 2) / 40);
  const hubBonus = (origin.isHub ? 1.1 : 1) * (dest.isHub ? 1.1 : 1);
  return 50 * SIZE_MULTIPLIER[origin.size] * SIZE_MULTIPLIER[dest.size] * distFactor * hubBonus;
}

export function getCompetitivenessScore(price: number, avgCompetitorPrice: number): number {
  if (avgCompetitorPrice <= 0) return 1;
  if (price <= 0) return 5;
  return Math.pow(price / avgCompetitorPrice, PRICE_ELASTICITY);
}

function repPricePremium(reputationScore: number): number {
  return 1 + (reputationScore - 50) * REP_PRICE_FACTOR;
}

/**
 * Returns the fraction of baseline daily demand the player captures.
 * With competitors: competitive market share via price elasticity.
 * Without competitors: demand is price-elastic vs referencePrice (cost-based
 * fair price). Charging above reference reduces demand; below fills the plane.
 *
 * Reputation acts as a price premium: passengers perceive the price as
 * (actualPrice / repPremium). High-rep airlines can charge more for the same
 * market share; low-rep airlines are penalised even at the same price.
 */
export function getPlayerMarketShare(
  routeOrigin: string,
  routeDest: string,
  playerPrice: number,
  allAirlines: Airline[],
  allRoutes: Route[],
  referencePrice?: number,
  playerAirlineId = 'player',
  cabin: 'economy' | 'business' = 'economy',
  excludeRouteId?: string,
): number {
  const getPrice = (r: Route) => cabin === 'business' ? r.priceBusiness : r.priceEconomy;

  const routesOnPair = allRoutes.filter(
    r => r.isActive &&
      r.id !== excludeRouteId &&
      ((r.originIata === routeOrigin && r.destinationIata === routeDest) ||
       (r.originIata === routeDest && r.destinationIata === routeOrigin)) &&
      (cabin === 'economy' || getPrice(r) > 0),
  );

  const playerAirline = allAirlines.find(a => a.id === playerAirlineId);
  const playerPremium = playerAirline ? repPricePremium(playerAirline.reputationScore) : 1;
  const playerEffectivePrice = playerPrice / playerPremium;

  if (routesOnPair.length === 0) {
    if (referencePrice && referencePrice > 0) {
      if (playerEffectivePrice <= 0) return 5;
      return Math.min(5, Math.pow(playerEffectivePrice / referencePrice, PRICE_ELASTICITY));
    }
    return 1;
  }

  const avgPrice = routesOnPair.reduce((sum, r) => sum + getPrice(r), 0) / routesOnPair.length;
  const playerScore = getCompetitivenessScore(playerEffectivePrice, avgPrice);
  const totalScore = routesOnPair.reduce((sum, r) => {
    const airline = allAirlines.find(a => a.id === r.airlineId);
    const premium = airline ? repPricePremium(airline.reputationScore) : 1;
    return sum + getCompetitivenessScore(getPrice(r) / premium, avgPrice);
  }, 0);

  return totalScore > 0 ? playerScore / totalScore : 1;
}

/** Total daily passengers the airport can absorb across all airlines, growing 1.5%/year from 1960. */
export function getAirportCapacity(size: string, gameYear: number): number {
  const base = AIRPORT_BASE_CAPACITY[size] ?? 1_200;
  return base * Math.pow(1 + AIRPORT_DEMAND_GROWTH_RATE, gameYear - 1960);
}

/**
 * Demand multiplier based on how saturated an airport is.
 * Free zone below 50% utilization. Linear decline from 1.0→0.4 between 50% and 150%.
 * Floor 0.4 — even a massively over-served airport retains some demand.
 */
export function airportSaturationMod(utilization: number): number {
  if (utilization <= 0.5) return 1.0;
  if (utilization >= 1.5) return 0.4;
  return 1.0 - 0.6 * ((utilization - 0.5) / 1.0);
}

export function getSuggestedEconomyPrice(totalCostPerFlight: number, totalSeats: number): number {
  if (totalSeats === 0) return 200;
  return Math.round((totalCostPerFlight / totalSeats) * 1.4);
}

/**
 * Demand multiplier from aircraft condition.
 * Full penalty kicks in below 70%; at condition 0 demand is 65% of normal.
 * Above 70%: no effect (passengers can't tell the difference).
 */
export function conditionDemandMod(condition: number): number {
  const threshold = 70;
  if (condition >= threshold) return 1.0;
  return 0.65 + 0.35 * (condition / threshold);
}
