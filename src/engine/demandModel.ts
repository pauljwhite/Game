import type { Airport, Route, Airline } from '@/types';
import { PRICE_ELASTICITY, REPUTATION_DEMAND_FACTOR } from '@/utils/constants';

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
  return Math.pow(price / avgCompetitorPrice, PRICE_ELASTICITY);
}

export function getPlayerMarketShare(
  routeOrigin: string,
  routeDest: string,
  playerPrice: number,
  allAirlines: Airline[],
  allRoutes: Route[],
): number {
  const routesOnPair = allRoutes.filter(
    r => r.isActive &&
      ((r.originIata === routeOrigin && r.destinationIata === routeDest) ||
       (r.originIata === routeDest && r.destinationIata === routeOrigin)),
  );

  if (routesOnPair.length === 0) return 1;

  const avgPrice = routesOnPair.reduce((sum, r) => sum + r.priceEconomy, 0) / routesOnPair.length;
  const playerScore = getCompetitivenessScore(playerPrice, avgPrice);
  const totalScore = routesOnPair.reduce((sum, r) => {
    const airline = allAirlines.find(a => a.id === r.airlineId);
    const repMod = airline ? 1 + (airline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR : 1;
    return sum + getCompetitivenessScore(r.priceEconomy, avgPrice) * repMod;
  }, 0);

  return totalScore > 0 ? playerScore / totalScore : 1;
}

export function getSuggestedEconomyPrice(totalCostPerFlight: number, totalSeats: number): number {
  if (totalSeats === 0) return 200;
  return Math.round((totalCostPerFlight / totalSeats) * 1.4);
}
