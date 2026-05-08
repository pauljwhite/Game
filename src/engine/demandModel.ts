import type { Airport, Route, Airline } from '@/types';
import { PRICE_ELASTICITY, REP_PRICE_FACTOR, AIRPORT_BASE_CAPACITY, AIRPORT_DEMAND_GROWTH_RATE } from '@/utils/constants';
import { haversineKm } from '@/utils/geo';

export const MAX_REASONABLE_FARE_MULTIPLIER = 3;

const SIZE_MULTIPLIER: Record<string, number> = {
  small: 0.3, medium: 1.0, large: 2.5, major: 5.0,
};

const INTERNATIONAL_REACH: Record<string, number> = {
  small: 0.14, medium: 0.28, large: 0.68, major: 1.0,
};

const MAJOR_MARKET_COUNTRIES = new Set([
  'US', 'CN', 'GB', 'DE', 'FR', 'ES', 'IT', 'JP', 'IN', 'BR', 'CA', 'AU', 'RU',
  'MX', 'TR', 'AE', 'SG', 'KR', 'NL', 'TH', 'ID', 'SA', 'ZA',
]);

const COUNTRY_AFFINITY: Record<string, string[]> = {
  GB: ['IE', 'US', 'CA', 'AU', 'IN', 'ES', 'FR', 'DE', 'NL', 'AE'],
  IE: ['GB', 'US', 'CA', 'ES', 'FR'],
  RU: ['KZ', 'UZ', 'AM', 'GE', 'AZ', 'CN', 'TR', 'AE', 'DE'],
  US: ['CA', 'MX', 'GB', 'JP', 'DE', 'FR', 'CN', 'BR'],
  CA: ['US', 'GB', 'FR', 'MX'],
  AU: ['NZ', 'GB', 'US', 'SG', 'ID', 'CN', 'JP'],
  NZ: ['AU', 'US', 'GB'],
  CN: ['HK', 'MO', 'TW', 'JP', 'KR', 'TH', 'SG', 'US', 'RU'],
  JP: ['KR', 'CN', 'TW', 'US', 'TH'],
  KR: ['JP', 'CN', 'US', 'VN'],
  IN: ['GB', 'AE', 'SG', 'TH', 'US', 'CA', 'MY'],
  AE: ['IN', 'GB', 'SA', 'PK', 'EG', 'US', 'RU'],
  FR: ['GB', 'DE', 'ES', 'IT', 'BE', 'CH', 'US', 'DZ', 'MA'],
  DE: ['GB', 'FR', 'IT', 'ES', 'AT', 'CH', 'TR', 'US'],
  ES: ['GB', 'FR', 'DE', 'IT', 'PT', 'MA'],
  IT: ['FR', 'DE', 'ES', 'GB', 'CH'],
  TR: ['DE', 'RU', 'GB', 'NL', 'AE'],
  BR: ['AR', 'US', 'PT', 'CL', 'UY'],
};

function isLargeCountry(country: string): boolean {
  return ['US', 'CN', 'RU', 'CA', 'AU', 'BR', 'IN'].includes(country);
}

function hash01(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function pairAffinity(origin: Airport, dest: Airport): number {
  const pair = hash01(`${origin.iata}:${dest.iata}`);
  const originPreference = hash01(`${origin.iata}:${dest.country}:${dest.region}`);
  return 0.78 + pair * 0.3 + originPreference * 0.22;
}

function destinationAffinity(origin: Airport, dest: Airport, distanceKm: number): number {
  let affinity = 1;
  const isDomestic = origin.country === dest.country;
  const originReach = INTERNATIONAL_REACH[origin.size] ?? 0.3;
  const destReach = INTERNATIONAL_REACH[dest.size] ?? 0.3;

  if (isDomestic) {
    affinity *= isLargeCountry(origin.country) ? 2.6 : 1.85;
    if (distanceKm < 350) affinity *= 0.75;
    else if (distanceKm < 1_500) affinity *= 1.25;
    else if (distanceKm < 4_000 && isLargeCountry(origin.country)) affinity *= 1.35;

    if (origin.size !== 'major' && (dest.size === 'large' || dest.size === 'major')) {
      affinity *= 1.35;
    }
  } else {
    const longHaul = distanceKm > 3_000;
    affinity *= longHaul
      ? Math.max(0.08, originReach * (0.35 + destReach))
      : 0.48 + originReach * 0.55;

    if (origin.region === dest.region) affinity *= 1.35;
    if (COUNTRY_AFFINITY[origin.country]?.includes(dest.country) || COUNTRY_AFFINITY[dest.country]?.includes(origin.country)) {
      affinity *= 1.15 + originReach * 0.25;
    }
  }

  if (distanceKm < 750) affinity *= 1.25;
  else if (distanceKm < 2_500) affinity *= 1.12;
  else if (distanceKm > 6_000) affinity *= origin.size === 'major' ? 0.9 : 0.42;

  if (!isDomestic && originReach >= 0.65 && MAJOR_MARKET_COUNTRIES.has(origin.country) && MAJOR_MARKET_COUNTRIES.has(dest.country)) {
    affinity *= 1.12;
  }

  if (!isDomestic && (origin.size === 'major' || (origin.size === 'large' && dest.size === 'major'))) {
    affinity *= 1.18;
  }

  return Math.max(0.08, Math.min(4.2, affinity * pairAffinity(origin, dest)));
}

export function getBaselineDailyPax(origin: Airport, dest: Airport): number {
  const distanceKm = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
  const distFactor = 1 / (1 + distanceKm / 4_500);
  const hubBonus = (origin.isHub ? 1.1 : 1) * (dest.isHub ? 1.1 : 1);
  return 50 * SIZE_MULTIPLIER[origin.size] * SIZE_MULTIPLIER[dest.size] * distFactor * destinationAffinity(origin, dest, distanceKm) * hubBonus;
}

export function getCompetitivenessScore(price: number, avgCompetitorPrice: number): number {
  if (avgCompetitorPrice <= 0) return 1;
  if (price <= 0) return 5;
  return Math.pow(price / avgCompetitorPrice, PRICE_ELASTICITY);
}

export function getSoloPriceDemandShare(price: number, referencePrice: number): number {
  if (referencePrice <= 0) return 1;
  if (price <= 0) return 5;

  const priceRatio = Math.max(0.05, price / referencePrice);
  const elasticDemand = Math.pow(priceRatio, PRICE_ELASTICITY);
  const gougePenalty = priceRatio > 2 ? Math.pow(2 / priceRatio, 3.5) : 1;

  return Math.max(0, Math.min(5, elasticDemand * gougePenalty));
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
      return getSoloPriceDemandShare(playerEffectivePrice, referencePrice);
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
  return Math.round((totalCostPerFlight / totalSeats) * 1.3);
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
