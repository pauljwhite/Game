import type { Airline, Route, Aircraft, Airport, AircraftType } from '@/types';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { getBaselineDailyPax, getPlayerMarketShare } from './demandModel';
import { computeFlightCost } from './economicsEngine';
import { haversineKm } from '@/utils/geo';
import { v4 as uuidv4 } from 'uuid';

type StoreState = ReturnType<typeof import('@/store/index')['useGameStore']['getState']>;

const AI_EXPAND_INTERVAL_DAYS: Record<string, number> = {
  aggressive: 3,
  balanced: 7,
  budget: 7,
  premium: 10,
  conservative: 14,
};

const AI_PRICE_MULTIPLIER: Record<string, number> = {
  aggressive: 0.90,
  balanced: 1.00,
  budget: 0.75,
  premium: 1.40,
  conservative: 1.05,
};

const AI_LOAD_TARGET: Record<string, number> = {
  aggressive: 0.75,
  balanced: 0.70,
  budget: 0.85,
  premium: 0.55,
  conservative: 0.65,
};

export function runAITick(store: StoreState, gameDay: number): void {
  const { aiAirlines, aiAircraft, aiRoutes, airports } = store;
  const allRoutes = [...Object.values(store.routes), ...Object.values(aiRoutes)];
  const allAirlines = [...Object.values(store.airlines), ...Object.values(aiAirlines)];

  Object.values(aiAirlines).forEach(airline => {
    if (airline.isInsolvent) return;

    // Drop unprofitable routes when cash is tight
    if (airline.cashUSD < 5_000_000) {
      dropWorstRoute(airline, aiRoutes, store);
    }

    // Expand: buy aircraft + create route
    const expandInterval = AI_EXPAND_INTERVAL_DAYS[airline.personality] ?? 7;
    if (gameDay % expandInterval === (Math.abs(airline.id.charCodeAt(0)) % expandInterval)) {
      tryExpand(airline, aiAircraft, aiRoutes, airports, allAirlines, allRoutes, store, gameDay);
    }

    // Price adjustment toward load factor target
    adjustPrices(airline, aiRoutes, AI_PRICE_MULTIPLIER[airline.personality] ?? 1.0, AI_LOAD_TARGET[airline.personality] ?? 0.70, allAirlines, allRoutes, airports, store);
  });
}

function dropWorstRoute(airline: Airline, aiRoutes: Record<string, Route>, store: StoreState): void {
  let worstRouteId: string | null = null;
  let worstProfit = 0;

  airline.routeIds.forEach(rid => {
    const route = aiRoutes[rid];
    if (!route) return;
    if (route.dailyProfit < worstProfit) {
      worstProfit = route.dailyProfit;
      worstRouteId = rid;
    }
  });

  if (worstRouteId) {
    store.removeAIRoute(worstRouteId);
    store.pushNewsItem(`${airline.name} has suspended a loss-making route.`);
  }
}

function tryExpand(
  airline: Airline,
  _aiAircraft: Record<string, Aircraft>,
  aiRoutes: Record<string, Route>,
  airports: Record<string, Airport>,
  allAirlines: Airline[],
  allRoutes: Route[],
  store: StoreState,
  gameDay: number,
): void {
  const currentGameYear = 1960 + Math.floor(gameDay / 365);
  const affordableTypes = AIRCRAFT_TYPES
    .filter(t => t.yearIntroduced <= currentGameYear && t.purchasePrice <= airline.cashUSD * 0.4)
    .sort((a, b) => b.seatsEconomy - a.seatsEconomy);

  if (affordableTypes.length === 0) return;

  // Pick aircraft type appropriate to airline personality
  let chosenType: AircraftType;
  if (airline.personality === 'budget') {
    chosenType = affordableTypes[affordableTypes.length - 1]; // cheapest
  } else if (airline.personality === 'premium') {
    chosenType = affordableTypes.find(t => t.category === 'widebody') ?? affordableTypes[0];
  } else {
    chosenType = affordableTypes[Math.floor(affordableTypes.length / 2)]; // mid-range
  }

  if (airline.cashUSD < chosenType.purchasePrice) return;

  // Find a good new route from hub
  const hubIata = airline.hubIatas[0];
  if (!hubIata || !airports[hubIata]) return;

  const hubAirport = airports[hubIata];
  const candidateAirports = Object.values(airports)
    .filter(ap => {
      if (ap.iata === hubIata) return false;
      const dist = haversineKm(hubAirport.lat, hubAirport.lon, ap.lat, ap.lon);
      if (dist > chosenType.rangeKm || dist < 200) return false;
      // Don't duplicate existing AI routes from this hub
      const alreadyFlown = airline.routeIds.some(rid => {
        const r = aiRoutes[rid];
        return r && ((r.originIata === hubIata && r.destinationIata === ap.iata) ||
          (r.originIata === ap.iata && r.destinationIata === hubIata));
      });
      return !alreadyFlown;
    })
    .sort((a, b) => {
      const paxA = getBaselineDailyPax(hubAirport, a);
      const paxB = getBaselineDailyPax(hubAirport, b);
      return paxB - paxA;
    });

  if (candidateAirports.length === 0) return;

  const destAirport = candidateAirports[0];
  const dist = haversineKm(hubAirport.lat, hubAirport.lon, destAirport.lat, destAirport.lon);

  // Create aircraft
  const newAircraftId = `ai-ac-${uuidv4()}`;
  const newAircraft: Aircraft = {
    id: newAircraftId,
    typeId: chosenType.id,
    airlineId: airline.id,
    name: `${airline.name} ${chosenType.model}`,
    purchasedGameDay: gameDay,
    condition: 100,
    maintenanceHoursOwed: 0,
    isGrounded: false,
    lastMaintenanceGameDay: gameDay,
    crashRisk: 0,
    status: 'flying',
    assignedRouteId: null,
    totalFlightHours: 0,
    currentLat: hubAirport.lat,
    currentLon: hubAirport.lon,
    flightProgress: 0,
  };

  // Create route
  const newRouteId = `ai-route-${uuidv4()}`;
  const basePrice = Math.round((computeFlightCost(
    { distanceKm: dist, flightsPerWeek: 7 } as Route,
    newAircraft,
    chosenType,
    hubAirport,
    destAirport,
  ).totalCost / chosenType.seatsEconomy) * 1.4);

  const priceMultiplier = AI_PRICE_MULTIPLIER[airline.personality] ?? 1.0;
  const newRoute: Route = {
    id: newRouteId,
    airlineId: airline.id,
    originIata: hubIata,
    destinationIata: destAirport.iata,
    aircraftId: newAircraftId,
    flightsPerWeek: 7,
    priceEconomy: Math.round(basePrice * priceMultiplier),
    priceBusiness: Math.round(basePrice * priceMultiplier * 4),
    isActive: true,
    createdGameDay: gameDay,
    distanceKm: dist,
    dailyRevenue: 0,
    dailyCost: 0,
    dailyProfit: 0,
    loadFactorEconomy: 0,
    loadFactorBusiness: 0,
    dailyPassengers: 0,
    flightDurationHours: dist / chosenType.cruiseSpeedKmh,
  };

  newAircraft.assignedRouteId = newRouteId;

  // Deduct cash and add to store
  store.updateAIAirline(airline.id, {
    cashUSD: airline.cashUSD - chosenType.purchasePrice,
    fleetIds: [...airline.fleetIds, newAircraftId],
  });

  store.setAIAirlines(
    store.aiAirlines,
    { ...store.aiAircraft, [newAircraftId]: newAircraft },
    store.aiRoutes,
  );
  store.addAIRoute(newRoute);

  void allAirlines;
  void allRoutes;
}

function adjustPrices(
  airline: Airline,
  aiRoutes: Record<string, Route>,
  targetMultiplier: number,
  loadTarget: number,
  allAirlines: Airline[],
  allRoutes: Route[],
  airports: Record<string, Airport>,
  store: StoreState,
): void {
  airline.routeIds.forEach(rid => {
    const route = aiRoutes[rid];
    if (!route) return;

    const origin = airports[route.originIata];
    const dest = airports[route.destinationIata];
    if (!origin || !dest) return;

    const marketShare = getPlayerMarketShare(
      route.originIata, route.destinationIata,
      route.priceEconomy, allAirlines, allRoutes,
    );

    // If underperforming load target, lower prices slightly; if overperforming, raise
    const lf = route.loadFactorEconomy || 0.5;
    let priceDelta = 0;
    if (lf < loadTarget - 0.1) priceDelta = -0.03; // drop 3%
    else if (lf > loadTarget + 0.1) priceDelta = +0.03; // raise 3%

    if (priceDelta !== 0) {
      const newPrice = Math.max(50, Math.round(route.priceEconomy * (1 + priceDelta)));
      store.updateAIAirline(airline.id, {}); // trigger re-render
      // Directly mutate via store's internal mechanism — we update through the route
      const updatedRoute: Route = { ...route, priceEconomy: newPrice, priceBusiness: Math.round(newPrice * 4 * targetMultiplier) };
      store.addAIRoute(updatedRoute); // addAIRoute overwrites if same id
    }

    void marketShare;
  });
}
