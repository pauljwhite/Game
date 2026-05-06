import type { Aircraft, AircraftType, Airline, Airport, Route } from '@/types';
import { PRICE_ELASTICITY, REP_PRICE_FACTOR, REPUTATION_DEMAND_FACTOR, HUB_DEMAND_BONUS } from '@/utils/constants';
import { computeFlightCost } from './economicsEngine';
import { conditionDemandMod, getBaselineDailyPax, getCompetitivenessScore } from './demandModel';

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
}

export interface RouteOptimisationResult {
  flightsPerWeek: number;
  priceEconomy: number;
  priceBusiness: number;
  dailyProfit: number;
}

function routePairKey(origin: string, dest: string): string {
  return origin < dest ? `${origin}:${dest}` : `${dest}:${origin}`;
}

function repPricePremium(reputationScore: number): number {
  return 1 + (reputationScore - 50) * REP_PRICE_FACTOR;
}

function normalisePrice(value: number): number {
  if (value <= 0) return 0;
  const step = value < 200 ? 5 : value < 1000 ? 10 : value < 5000 ? 50 : 100;
  return Math.max(0, Math.round(value / step) * step);
}

function estimateOptimisedProfit(input: RouteOptimisationInput, flightsPerWeek: number, priceEconomy: number, priceBusiness: number) {
  const { route, aircraft, aircraftType, origin, destination, globalFuelPrice, playerAirline, competitorAirlines, competitorRoutes } = input;
  const candidateRoute = { ...route, flightsPerWeek, priceEconomy, priceBusiness };
  const costs = computeFlightCost(candidateRoute, aircraft, aircraftType, origin, destination, globalFuelPrice);
  const flightsPerDay = flightsPerWeek / 7;
  const dailyCost = costs.totalCost * flightsPerDay;

  const totalSeats = aircraftType.seatsEconomy + aircraftType.seatsBusiness;
  const referencePrice = totalSeats > 0 ? Math.round(costs.totalCost / totalSeats * 1.3) : 200;
  const referencePriceBiz = referencePrice * 4;
  const pair = routePairKey(route.originIata, route.destinationIata);
  const pairCompetitors = competitorRoutes.filter(candidate =>
    candidate.id !== route.id &&
    candidate.isActive &&
    routePairKey(candidate.originIata, candidate.destinationIata) === pair,
  );

  const getMarketShare = (price: number, referencePriceForCabin: number, cabin: 'economy' | 'business'): number => {
    const getPrice = (candidate: Route) => cabin === 'business' ? candidate.priceBusiness : candidate.priceEconomy;
    const cabinCompetitors = cabin === 'economy'
      ? pairCompetitors
      : pairCompetitors.filter(candidate => getPrice(candidate) > 0);
    const playerPremium = playerAirline ? repPricePremium(playerAirline.reputationScore) : 1;
    const ownEffectivePrice = price / playerPremium;

    if (cabinCompetitors.length === 0) {
      if (ownEffectivePrice <= 0) return 5;
      return Math.min(5, Math.pow(ownEffectivePrice / referencePriceForCabin, PRICE_ELASTICITY));
    }

    const competitorEffectivePrices = cabinCompetitors.map(candidate => {
      const airline = competitorAirlines[candidate.airlineId];
      const premium = airline ? repPricePremium(airline.reputationScore) : 1;
      return getPrice(candidate) / premium;
    });
    const avgPrice = (ownEffectivePrice + competitorEffectivePrices.reduce((sum, price) => sum + price, 0)) / (competitorEffectivePrices.length + 1);
    const ownScore = getCompetitivenessScore(ownEffectivePrice, avgPrice);
    const competitorScore = competitorEffectivePrices.reduce((sum, price) => sum + getCompetitivenessScore(price, avgPrice), 0);
    return ownScore / Math.max(ownScore + competitorScore, 0.0001);
  };

  const baselinePax = getBaselineDailyPax(origin, destination) * (origin.isHub || destination.isHub ? HUB_DEMAND_BONUS : 1);
  const repMod = playerAirline ? 1 + (playerAirline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR : 1;
  const condMod = conditionDemandMod(aircraft.condition);

  const ecoCapacity = aircraftType.seatsEconomy * flightsPerDay;
  const ecoShare = getMarketShare(priceEconomy, referencePrice, 'economy');
  const ecoPax = Math.min(ecoCapacity, Math.floor(baselinePax * 0.90 * ecoShare * repMod * condMod));

  const bizCapacity = aircraftType.seatsBusiness * flightsPerDay;
  const bizShare = aircraftType.seatsBusiness > 0
    ? getMarketShare(priceBusiness, referencePriceBiz, 'business')
    : 0;
  const bizPax = Math.min(bizCapacity, Math.floor(baselinePax * 0.10 * bizShare * repMod * condMod));

  const dailyRevenue = ecoPax * priceEconomy + bizPax * priceBusiness;
  return { dailyProfit: dailyRevenue - dailyCost, referencePrice };
}

export function optimiseRouteSettings(input: RouteOptimisationInput): RouteOptimisationResult {
  const baseEstimate = estimateOptimisedProfit(input, input.route.flightsPerWeek, input.route.priceEconomy, input.route.priceBusiness);
  const ecoReference = baseEstimate.referencePrice;
  const bizReference = ecoReference * 4;
  const maxEco = ecoReference * 6;
  const maxBiz = bizReference * 6;
  const multipliers = [
    0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.60, 0.70,
    0.80, 0.90, 1.00, 1.10, 1.20, 1.35, 1.50, 1.75, 2.00, 2.25,
    2.50, 2.75, 3.00, 3.50, 4.00, 4.50, 5.00, 5.50, 6.00,
  ];
  const ecoPrices = Array.from(new Set([
    input.route.priceEconomy,
    ecoReference,
    ...multipliers.map(multiplier => normalisePrice(ecoReference * multiplier)),
  ])).filter(price => price >= 0 && price <= maxEco);
  const bizPrices = input.aircraftType.seatsBusiness > 0
    ? Array.from(new Set([
        input.route.priceBusiness,
        bizReference,
        ...multipliers.map(multiplier => normalisePrice(bizReference * multiplier)),
      ])).filter(price => price >= 0 && price <= maxBiz)
    : [0];

  let best: RouteOptimisationResult = {
    flightsPerWeek: input.route.flightsPerWeek,
    priceEconomy: input.route.priceEconomy,
    priceBusiness: input.aircraftType.seatsBusiness > 0 ? input.route.priceBusiness : 0,
    dailyProfit: baseEstimate.dailyProfit,
  };

  for (let candidateFlights = 1; candidateFlights <= 21; candidateFlights++) {
    for (const candidateEco of ecoPrices) {
      for (const candidateBiz of bizPrices) {
        const estimate = estimateOptimisedProfit(input, candidateFlights, candidateEco, candidateBiz);
        if (estimate.dailyProfit > best.dailyProfit) {
          best = {
            flightsPerWeek: candidateFlights,
            priceEconomy: candidateEco,
            priceBusiness: candidateBiz,
            dailyProfit: estimate.dailyProfit,
          };
        }
      }
    }
  }

  return best;
}
