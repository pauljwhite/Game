import type { Aircraft, AircraftType, Airline, Airport, Route } from '@/types';
import { REP_PRICE_FACTOR, REPUTATION_DEMAND_FACTOR, HUB_DEMAND_BONUS } from '@/utils/constants';
import { computeFlightCost } from './economicsEngine';
import {
  MAX_REASONABLE_FARE_MULTIPLIER,
  airportSaturationMod,
  conditionDemandMod,
  getAirportCapacity,
  getBaselineDailyPax,
  getCompetitivenessScore,
  getSoloPriceDemandShare,
} from './demandModel';

export interface RouteOptimisationInput {
  route: Route;
  aircraft: Aircraft;
  aircraftType: AircraftType;
  origin: Airport;
  destination: Airport;
  globalFuelPrice: number;
  playerAirline: Airline | undefined;
  competitorAirlines: Record<string, Airline>;
  competitorRoutes: Route[];
  airportDailyPax?: Record<string, number>;
  gameDay?: number;
}

export interface RouteOptimisationResult {
  flightsPerWeek: number;
  priceEconomy: number;
  priceBusiness: number;
  dailyProfit: number;
}

interface MarketContext {
  pairCompetitors: Route[];
  referencePrice: number;
  referencePriceBiz: number;
  baselinePax: number;
  repMod: number;
  condMod: number;
  playerPremium: number;
}

function routePairKey(origin: string, dest: string): string {
  return origin < dest ? `${origin}:${dest}` : `${dest}:${origin}`;
}

function repPricePremium(reputationScore: number): number {
  return 1 + (reputationScore - 50) * REP_PRICE_FACTOR;
}

export function normaliseOptimisedPrice(value: number): number {
  if (value <= 0) return 0;
  const step = value < 200 ? 5 : value < 1000 ? 10 : value < 5000 ? 50 : 100;
  return Math.max(0, Math.round(value / step) * step);
}

function getMarketContext(input: RouteOptimisationInput): MarketContext {
  const { route, aircraft, aircraftType, origin, destination, globalFuelPrice, playerAirline, competitorRoutes } = input;
  const costs = computeFlightCost(route, aircraft, aircraftType, origin, destination, globalFuelPrice, input.gameDay);
  const totalSeats = aircraftType.seatsEconomy + aircraftType.seatsBusiness;
  const referencePrice = totalSeats > 0 ? Math.round(costs.totalCost / totalSeats * 1.3) : 200;
  const referencePriceBiz = referencePrice * 4;
  const pair = routePairKey(route.originIata, route.destinationIata);
  const pairCompetitors = competitorRoutes.filter(candidate =>
    candidate.id !== route.id &&
    candidate.isActive &&
    routePairKey(candidate.originIata, candidate.destinationIata) === pair,
  );

  const gameYear = 1960 + Math.floor((input.gameDay ?? 0) / 365);
  const originUtil = (input.airportDailyPax?.[origin.iata] ?? 0) / getAirportCapacity(origin, gameYear);
  const destUtil = (input.airportDailyPax?.[destination.iata] ?? 0) / getAirportCapacity(destination, gameYear);
  const saturationMod = airportSaturationMod(originUtil) * airportSaturationMod(destUtil);
  const baselinePax = getBaselineDailyPax(origin, destination) * (origin.isHub || destination.isHub ? HUB_DEMAND_BONUS : 1) * saturationMod;
  const repMod = playerAirline ? 1 + (playerAirline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR : 1;
  const condMod = conditionDemandMod(aircraft.condition);
  const playerPremium = playerAirline ? repPricePremium(playerAirline.reputationScore) : 1;

  return { pairCompetitors, referencePrice, referencePriceBiz, baselinePax, repMod, condMod, playerPremium };
}

function getCabinMarketShare(
  input: RouteOptimisationInput,
  context: MarketContext,
  price: number,
  referencePriceForCabin: number,
  cabin: 'economy' | 'business',
): number {
  const getPrice = (candidate: Route) => cabin === 'business' ? candidate.priceBusiness : candidate.priceEconomy;
  const cabinCompetitors = cabin === 'economy'
    ? context.pairCompetitors
    : context.pairCompetitors.filter(candidate => getPrice(candidate) > 0);
  const ownEffectivePrice = price / context.playerPremium;

  if (cabinCompetitors.length === 0) {
    return getSoloPriceDemandShare(ownEffectivePrice, referencePriceForCabin);
  }

  const competitorEffectivePrices = cabinCompetitors.map(candidate => {
    const airline = input.competitorAirlines[candidate.airlineId];
    const premium = airline ? repPricePremium(airline.reputationScore) : 1;
    return getPrice(candidate) / premium;
  });
  const avgPrice = competitorEffectivePrices.reduce((sum, competitorPrice) => sum + competitorPrice, 0) / competitorEffectivePrices.length;
  const ownScore = getCompetitivenessScore(ownEffectivePrice, avgPrice);
  const competitorScore = competitorEffectivePrices.reduce((sum, competitorPrice) => sum + getCompetitivenessScore(competitorPrice, avgPrice), 0);
  return ownScore / Math.max(ownScore + competitorScore, 0.0001);
}

function estimateCabinRevenue(
  input: RouteOptimisationInput,
  context: MarketContext,
  flightsPerWeek: number,
  price: number,
  cabin: 'economy' | 'business',
): number {
  const seats = cabin === 'business' ? input.aircraftType.seatsBusiness : input.aircraftType.seatsEconomy;
  if (seats <= 0) return 0;

  const flightsPerDay = flightsPerWeek / 7;
  const capacity = seats * flightsPerDay;
  const referencePrice = cabin === 'business' ? context.referencePriceBiz : context.referencePrice;
  const demandShare = cabin === 'business' ? 0.10 : 0.90;
  const marketShare = getCabinMarketShare(input, context, price, referencePrice, cabin);
  const pax = Math.min(capacity, Math.floor(context.baselinePax * demandShare * marketShare * context.repMod * context.condMod));
  return pax * price;
}

function estimateOptimisedProfit(
  input: RouteOptimisationInput,
  context: MarketContext,
  flightsPerWeek: number,
  priceEconomy: number,
  priceBusiness: number,
) {
  const costs = computeFlightCost({ ...input.route, flightsPerWeek, priceEconomy, priceBusiness }, input.aircraft, input.aircraftType, input.origin, input.destination, input.globalFuelPrice, input.gameDay);
  const dailyCost = costs.totalCost * (flightsPerWeek / 7);
  const dailyRevenue =
    estimateCabinRevenue(input, context, flightsPerWeek, priceEconomy, 'economy') +
    estimateCabinRevenue(input, context, flightsPerWeek, priceBusiness, 'business');

  return { dailyProfit: dailyRevenue - dailyCost };
}

function buildPriceCandidates(
  input: RouteOptimisationInput,
  context: MarketContext,
  flightsPerWeek: number,
  currentPrice: number,
  cabin: 'economy' | 'business',
): number[] {
  const seats = cabin === 'business' ? input.aircraftType.seatsBusiness : input.aircraftType.seatsEconomy;
  if (seats <= 0) return [0];

  const referencePrice = cabin === 'business' ? context.referencePriceBiz : context.referencePrice;
  const demandShare = cabin === 'business' ? 0.10 : 0.90;
  const competitorPrices = context.pairCompetitors
    .map(route => cabin === 'business' ? route.priceBusiness : route.priceEconomy)
    .filter(price => price > 0);
  const dailyCapacity = seats * (flightsPerWeek / 7);
  const unconstrainedDemand = context.baselinePax * demandShare * context.repMod * context.condMod;
  const soloCapacityPrice = dailyCapacity > 0 && unconstrainedDemand > 0
    ? referencePrice * Math.pow(Math.max(unconstrainedDemand / dailyCapacity, 0.0001), 0.5) * context.playerPremium
    : referencePrice;
  const maxPrice = referencePrice * MAX_REASONABLE_FARE_MULTIPLIER;
  const prices = new Set<number>([0, Math.min(currentPrice, maxPrice), referencePrice, Math.min(soloCapacityPrice, maxPrice)]);

  for (let multiplier = 0.05; multiplier <= 3.0001; multiplier += 0.05) prices.add(referencePrice * multiplier);
  for (let multiplier = 3.1; multiplier <= MAX_REASONABLE_FARE_MULTIPLIER + 0.0001; multiplier += 0.1) prices.add(referencePrice * multiplier);
  competitorPrices.forEach(price => {
    prices.add(Math.min(price, maxPrice));
    prices.add(Math.min(price * 0.9, maxPrice));
    prices.add(Math.min(price * 1.1, maxPrice));
  });
  prices.add(maxPrice);

  return Array.from(prices)
    .map(price => Math.min(maxPrice, normaliseOptimisedPrice(price)))
    .filter(price => price >= 0 && price <= maxPrice)
    .sort((a, b) => a - b);
}

function optimiseCabinPrice(
  input: RouteOptimisationInput,
  context: MarketContext,
  flightsPerWeek: number,
  currentPrice: number,
  cabin: 'economy' | 'business',
): { price: number; revenue: number } {
  const candidates = buildPriceCandidates(input, context, flightsPerWeek, currentPrice, cabin);
  const initialPrice = candidates[0] ?? 0;
  let best = { price: initialPrice, revenue: estimateCabinRevenue(input, context, flightsPerWeek, initialPrice, cabin) };

  for (const price of candidates) {
    const revenue = estimateCabinRevenue(input, context, flightsPerWeek, price, cabin);
    if (revenue > best.revenue) best = { price, revenue };
  }

  return best;
}

export function optimiseRouteSettings(input: RouteOptimisationInput): RouteOptimisationResult {
  const context = getMarketContext(input);
  let best: RouteOptimisationResult | null = null;

  for (let candidateFlights = 1; candidateFlights <= 21; candidateFlights++) {
    const economy = optimiseCabinPrice(input, context, candidateFlights, input.route.priceEconomy, 'economy');
    const business = input.aircraftType.seatsBusiness > 0
      ? optimiseCabinPrice(input, context, candidateFlights, input.route.priceBusiness, 'business')
      : { price: 0, revenue: 0 };
    const estimate = estimateOptimisedProfit(input, context, candidateFlights, economy.price, business.price);
    if (!best || estimate.dailyProfit > best.dailyProfit) {
      best = {
        flightsPerWeek: candidateFlights,
        priceEconomy: economy.price,
        priceBusiness: business.price,
        dailyProfit: estimate.dailyProfit,
      };
    }
  }

  return best ?? {
    flightsPerWeek: input.route.flightsPerWeek,
    priceEconomy: input.route.priceEconomy,
    priceBusiness: input.aircraftType.seatsBusiness > 0 ? input.route.priceBusiness : 0,
    dailyProfit: estimateOptimisedProfit(input, context, input.route.flightsPerWeek, input.route.priceEconomy, input.route.priceBusiness).dailyProfit,
  };
}

export function getRouteOptimisationChanges(input: RouteOptimisationInput): Pick<Route, 'flightsPerWeek' | 'priceEconomy' | 'priceBusiness'> | null {
  const optimised = optimiseRouteSettings(input);
  const currentBusinessPrice = input.aircraftType.seatsBusiness > 0 ? input.route.priceBusiness : 0;
  const optimisedBusinessPrice = input.aircraftType.seatsBusiness > 0 ? optimised.priceBusiness : 0;

  if (
    optimised.flightsPerWeek === input.route.flightsPerWeek &&
    optimised.priceEconomy === input.route.priceEconomy &&
    optimisedBusinessPrice === currentBusinessPrice
  ) {
    return null;
  }

  return {
    flightsPerWeek: optimised.flightsPerWeek,
    priceEconomy: optimised.priceEconomy,
    priceBusiness: optimisedBusinessPrice,
  };
}
