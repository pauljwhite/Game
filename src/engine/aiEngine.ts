import type { Airline, Route, Aircraft, Airport, AircraftType } from '@/types';
import type { MaintenanceTier } from '@/types/aircraft';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { getBaselineDailyPax } from './demandModel';
import { computeFlightCost } from './economicsEngine';
import { haversineKm } from '@/utils/geo';
import { v4 as uuidv4 } from 'uuid';
import {
  FUEL_PRICE_USD_PER_LITER,
  HUB_DEMAND_BONUS,
  MAINTENANCE_TIERS,
  PRICE_ELASTICITY,
  REP_PRICE_FACTOR,
  REPUTATION_DEMAND_FACTOR,
  computeMaintenanceCost,
  getMaintenanceAgeMultiplier,
} from '@/utils/constants';
import { canAirportHandleAircraft } from '@/utils/runway';
import type { AIAirlineInit } from '@/data/airlinesInit';
import { pickUnusedAirlineColor } from '@/data/airlineColors';
import { useGameStore } from '@/store';
import { rawCompanyValue } from './valuation';

type StoreState = ReturnType<typeof import('@/store/index')['useGameStore']['getState']>;

// ── Airline name generation ───────────────────────────────────────────────────

const NAME_PREFIXES = [
  'Atlas', 'Nordic', 'Pacific', 'Horizon', 'Stellar', 'Astra', 'Pinnacle',
  'Summit', 'Cardinal', 'Zenith', 'Liberty', 'Frontier', 'Pioneer', 'Vanguard',
  'Polar', 'Tropic', 'Alpine', 'Sahara', 'Orient', 'Andean', 'Caspian',
  'Baltic', 'Adriatic', 'Iberian', 'Boreal', 'Austral', 'Solar', 'Nova',
  'Apex', 'Crown', 'Delta', 'Omega', 'Laurentian', 'Aegean', 'Amber',
  'Azure', 'Borealis', 'Cascade', 'Crest', 'Equinox', 'Falcon', 'Garuda',
  'Halcyon', 'Indigo', 'Jade', 'Kestrel', 'Lodestar', 'Magellan', 'Nimbus',
  'Orion', 'Pegasus', 'Quest', 'Raptor', 'Solaris', 'Tasman', 'Uluru',
  'Venture', 'Windward', 'Xcalibur', 'Yellowstone', 'Zephyr',
];

const NAME_SUFFIXES = [
  'Air', 'Airlines', 'Airways', 'Aviation', 'Express', 'Connect',
  'Jet', 'Wings', 'Lines', 'Global', 'Link', 'Sky', 'Aero', 'Fly',
];

const AIRLINE_EMOJIS = ['✈️', '🛫', '🌍', '🌎', '🌏', '🦅', '🌐', '⭐', '🌟', '🚀', '🌙', '🦉', '🦆', '🌊', '🏔️'];

const SPAWN_HUBS = [
  'JFK', 'LAX', 'LHR', 'CDG', 'FRA', 'AMS', 'NRT', 'HKG', 'SIN', 'DXB',
  'SYD', 'GRU', 'MEX', 'JNB', 'BOM', 'PEK', 'ICN', 'BKK', 'KUL', 'IST',
  'ATL', 'ORD', 'DFW', 'MIA', 'SFO', 'YYZ', 'MAD', 'BCN', 'FCO', 'MUC',
  'ZRH', 'VIE', 'CPH', 'OSL', 'ARN', 'WAW', 'LIS', 'ATH', 'CAI', 'NBO',
  'CPT', 'DEL', 'BLR', 'MNL', 'CGK', 'AKL', 'SCL', 'BOG', 'LIM', 'YVR',
];

const PERSONALITIES: Airline['personality'][] = ['aggressive', 'balanced', 'budget', 'premium', 'conservative'];

function generateAirlineName(existingNames: Set<string>): { name: string; iataPrefix: string } {
  let name = '';
  for (let i = 0; i < 30; i++) {
    const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
    name = `${prefix} ${suffix}`;
    if (!existingNames.has(name)) break;
  }
  const words = name.split(' ');
  const iataPrefix = words.map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return { name, iataPrefix };
}

const MAX_AI_AIRLINES = 16;
const SPAWN_CHECK_INTERVAL = 15; // game days between spawn checks
const SPAWN_PROBABILITY_BASE = 0.50;
const SPAWN_PROBABILITY_LOW  = 0.90; // when fewer than 4 active AI airlines

function trySpawnNewAirline(store: StoreState, gameDay: number): void {
  if (gameDay % SPAWN_CHECK_INTERVAL !== 0) return;
  const { aiAirlines, airports } = store;
  const activeCount = Object.values(aiAirlines).filter(a => !a.isInsolvent).length;
  if (activeCount >= MAX_AI_AIRLINES) return;
  const spawnProb = activeCount < 4 ? SPAWN_PROBABILITY_LOW : SPAWN_PROBABILITY_BASE;
  if (Math.random() > spawnProb) return;

  const existingNames = new Set([
    ...Object.values(aiAirlines).map(a => a.name),
    ...Object.values(store.airlines).map(a => a.name),
  ]);
  const usedHubs = new Set(Object.values(aiAirlines).flatMap(a => a.hubIatas));
  const availableHubs = SPAWN_HUBS.filter(h => !usedHubs.has(h) && airports[h]);
  if (availableHubs.length === 0) return;

  const hubIata = availableHubs[Math.floor(Math.random() * availableHubs.length)];
  const { name, iataPrefix } = generateAirlineName(existingNames);
  const color = pickUnusedAirlineColor(Object.values(aiAirlines).map(airline => airline.color), gameDay + activeCount);
  const emoji = AIRLINE_EMOJIS[Math.floor(Math.random() * AIRLINE_EMOJIS.length)];
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

  const newAirline: Airline = {
    id: `ai-spawned-${uuidv4()}`,
    name, iataPrefix,
    isPlayer: false,
    color, logoEmoji: emoji,
    cashUSD: 30_000_000 + Math.floor(Math.random() * 30_000_000),
    totalDebt: 0,
    hubIatas: [hubIata],
    fleetIds: [], routeIds: [],
    personality,
    foundedGameDay: gameDay,
    isInsolvent: false, canBeTakenOver: false,
    marketSharePercent: 0,
    reputationScore: 50,
    totalPassengersAllTime: 0,
    dailyStats: [],
    crashPenaltyDaysLeft: 0,
    shareholders: {},
    lastDailyProfit: 0,
    maintenancePolicy: { enabled: false, threshold: 40, tier: 'standard', autoMaintainIssues: false },
  };

  store.addAIAirline(newAirline);
  store.setAirportHub(hubIata, true);
  store.pushNewsItem(`NEW ENTRANT: ${name} has launched operations with a new hub at ${hubIata}.`);
}

const AI_EXPAND_INTERVAL_DAYS: Record<string, number> = {
  aggressive: 5,
  balanced: 8,
  budget: 8,
  premium: 12,
  conservative: 16,
};

const AI_PURCHASE_CASH_SHARE: Record<string, number> = {
  aggressive: 0.34,
  balanced: 0.28,
  budget: 0.30,
  premium: 0.30,
  conservative: 0.24,
};

const AI_MIN_CASH_RESERVE_AFTER_PURCHASE = 12_000_000;
const AI_MIN_EXPANSION_PROFIT_PER_DAY = 6_000;
const AI_CASH_STRESS_THRESHOLD = 15_000_000;
const AI_CRITICAL_CASH_THRESHOLD = 5_000_000;

const AI_PRICE_MULTIPLIER: Record<string, number> = {
  aggressive: 0.90,
  balanced: 1.00,
  budget: 0.75,
  premium: 1.20,
  conservative: 1.05,
};

const AI_LOAD_TARGET: Record<string, number> = {
  aggressive: 0.75,
  balanced: 0.70,
  budget: 0.85,
  premium: 0.65,
  conservative: 0.65,
};

function aiCashReserve(airline: Airline): number {
  return AI_MIN_CASH_RESERVE_AFTER_PURCHASE + airline.fleetIds.length * 2_500_000;
}

function repPricePremium(reputationScore: number): number {
  return 1 + (reputationScore - 50) * REP_PRICE_FACTOR;
}

function aiScheduleOffset(id: string, interval: number): number {
  return Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % interval;
}

function createAIAircraft(
  airline: Airline,
  aircraftType: AircraftType,
  gameDay: number,
  origin: Airport,
  id = `ai-ac-${uuidv4()}`,
): Aircraft {
  return {
    id,
    typeId: aircraftType.id,
    airlineId: airline.id,
    name: `${airline.name} ${aircraftType.model}`,
    purchasedGameDay: gameDay,
    condition: 100,
    maintenanceHoursOwed: 0,
    isGrounded: false,
    lastMaintenanceGameDay: gameDay,
    crashRisk: 0,
    status: 'flying',
    assignedRouteId: null,
    totalFlightHours: 0,
    currentLat: origin.lat,
    currentLon: origin.lon,
    flightProgress: 0,
    activeMaintTier: null,
    autoMaintenanceEnabled: false,
    autoMaintenanceThreshold: 40,
    autoMaintenanceTier: 'standard',
    knownFaultRiskMod: 1,
    excludedFromPolicy: false,
  };
}

interface AIOperationPlan {
  aircraftType: AircraftType;
  origin: Airport;
  dest: Airport;
  distanceKm: number;
  flightsPerWeek: number;
  priceEconomy: number;
  priceBusiness: number;
  expectedDailyRevenue: number;
  expectedDailyCost: number;
  expectedDailyProfit: number;
  expectedLoadFactor: number;
}

function estimateAIOperation(
  airline: Airline,
  aircraftType: AircraftType,
  origin: Airport,
  dest: Airport,
  gameDay: number,
  fuelPriceUSDPerLiter: number,
  priceMultiplier = AI_PRICE_MULTIPLIER[airline.personality] ?? 1,
): AIOperationPlan | null {
  if (!canAirportHandleAircraft(origin, aircraftType) || !canAirportHandleAircraft(dest, aircraftType)) return null;
  const distanceKm = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
  if (distanceKm > aircraftType.rangeKm || distanceKm < 200) return null;

  const flightsPerWeek = distanceKm > 5500 ? 5 : 7;
  const aircraft = createAIAircraft(airline, aircraftType, gameDay, origin, 'ai-plan');
  const flightCosts = computeFlightCost(
    { distanceKm, flightsPerWeek } as Route,
    aircraft,
    aircraftType,
    origin,
    dest,
    fuelPriceUSDPerLiter,
    gameDay,
  );
  const flightsPerDay = flightsPerWeek / 7;
  const totalSeats = aircraftType.seatsEconomy + aircraftType.seatsBusiness;
  const costPerSeat = totalSeats > 0 ? flightCosts.totalCost / totalSeats : 200;
  const priceEconomy = Math.max(50, Math.round(costPerSeat * 1.45 * priceMultiplier));
  const priceBusiness = aircraftType.seatsBusiness > 0 ? Math.round(priceEconomy * 4) : 0;
  const referencePrice = Math.max(50, costPerSeat * 1.3);
  const effectivePrice = priceEconomy / repPricePremium(airline.reputationScore);
  const priceDemandMod = Math.min(1.35, Math.pow(Math.max(0.1, effectivePrice / referencePrice), PRICE_ELASTICITY));
  const baselinePax = getBaselineDailyPax(origin, dest) * HUB_DEMAND_BONUS;
  const repMod = 1 + (airline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR;
  const ecoCapacity = aircraftType.seatsEconomy * flightsPerDay;
  const bizCapacity = aircraftType.seatsBusiness * flightsPerDay;
  const ecoPax = Math.min(ecoCapacity, Math.floor(baselinePax * 0.90 * repMod * priceDemandMod));
  const bizPax = Math.min(bizCapacity, Math.floor(baselinePax * 0.08 * repMod * Math.min(1.15, priceDemandMod)));
  const expectedDailyRevenue = ecoPax * priceEconomy + bizPax * priceBusiness;
  const expectedDailyCost = flightCosts.totalCost * flightsPerDay;
  const expectedDailyProfit = expectedDailyRevenue - expectedDailyCost;
  const expectedLoadFactor = totalSeats > 0 ? (ecoPax + bizPax) / (totalSeats * flightsPerDay) : 0;

  return {
    aircraftType,
    origin,
    dest,
    distanceKm,
    flightsPerWeek,
    priceEconomy,
    priceBusiness,
    expectedDailyRevenue,
    expectedDailyCost,
    expectedDailyProfit,
    expectedLoadFactor,
  };
}

function buildAIRouteFromPlan(airline: Airline, aircraftId: string, plan: AIOperationPlan, gameDay: number, routeId = `ai-route-${uuidv4()}`): Route {
  return {
    id: routeId,
    airlineId: airline.id,
    originIata: plan.origin.iata,
    destinationIata: plan.dest.iata,
    aircraftId,
    flightsPerWeek: plan.flightsPerWeek,
    priceEconomy: plan.priceEconomy,
    priceBusiness: plan.priceBusiness,
    isActive: true,
    createdGameDay: gameDay,
    distanceKm: plan.distanceKm,
    dailyRevenue: 0,
    dailyCost: 0,
    dailyProfit: 0,
    loadFactorEconomy: 0,
    loadFactorBusiness: 0,
    dailyPassengers: 0,
    flightDurationHours: plan.distanceKm / plan.aircraftType.cruiseSpeedKmh,
  };
}

function findBestAIPlan(
  airline: Airline,
  aircraftTypes: AircraftType[],
  aiRoutes: Record<string, Route>,
  airports: Record<string, Airport>,
  gameDay: number,
  fuelPriceUSDPerLiter: number,
  preferredDestIata?: string,
): AIOperationPlan | null {
  const hubIata = airline.hubIatas[0];
  if (!hubIata || !airports[hubIata]) return null;
  const hubAirport = airports[hubIata];
  const candidates = preferredDestIata && airports[preferredDestIata]
    ? [airports[preferredDestIata]]
    : Object.values(airports);

  const plans = aircraftTypes.flatMap(aircraftType => (
    candidates.flatMap(dest => {
      if (dest.iata === hubIata) return [];
      const alreadyFlown = airline.routeIds.some(rid => {
        const route = aiRoutes[rid];
        return route && ((route.originIata === hubIata && route.destinationIata === dest.iata) ||
          (route.originIata === dest.iata && route.destinationIata === hubIata));
      });
      if (alreadyFlown) return [];
      const plan = estimateAIOperation(airline, aircraftType, hubAirport, dest, gameDay, fuelPriceUSDPerLiter);
      return plan ? [plan] : [];
    })
  ));

  return plans
    .filter(plan => plan.expectedLoadFactor >= 0.35)
    .sort((a, b) => b.expectedDailyProfit - a.expectedDailyProfit)[0] ?? null;
}

export function createInitialAIOperations(
  configs: AIAirlineInit[],
  aiAirlines: Record<string, Airline>,
  airports: Record<string, Airport>,
  gameDay: number,
  fuelPriceUSDPerLiter = FUEL_PRICE_USD_PER_LITER,
): { aiAircraft: Record<string, Aircraft>; aiRoutes: Record<string, Route> } {
  const aiAircraft: Record<string, Aircraft> = {};
  const aiRoutes: Record<string, Route> = {};

  configs.forEach((config, index) => {
    const airline = aiAirlines[`ai-${index}`];
    if (!airline) return;
    const starterType = AIRCRAFT_TYPES.find(type => type.id === config.startingAircraftTypeId);
    if (!starterType) return;
    const plan = findBestAIPlan(airline, [starterType], aiRoutes, airports, gameDay, fuelPriceUSDPerLiter, config.secondHub) ??
      findBestAIPlan(airline, [starterType], aiRoutes, airports, gameDay, fuelPriceUSDPerLiter);
    if (!plan) return;

    const aircraft = createAIAircraft(airline, starterType, gameDay, plan.origin);
    const route = buildAIRouteFromPlan(airline, aircraft.id, plan, gameDay);
    aircraft.assignedRouteId = route.id;
    aiAircraft[aircraft.id] = aircraft;
    aiRoutes[route.id] = route;
    airline.fleetIds.push(aircraft.id);
    airline.routeIds.push(route.id);
    airline.cashUSD -= starterType.purchasePrice;
  });

  return { aiAircraft, aiRoutes };
}

// ── Maintenance discipline by personality ────────────────────────────────────
// Threshold: condition % at which maintenance is triggered
// Tier: quality of work — premium/conservative pay for better upkeep
const AI_MAINT_THRESHOLD: Record<string, number> = {
  premium:      65,   // very proactive — brand depends on safety image
  conservative: 52,
  balanced:     40,
  aggressive:   28,   // cuts corners, flies degraded to save money
  budget:       18,   // bare minimum — will fly nearly to grounding
};

const AI_MAINT_TIER: Record<string, MaintenanceTier> = {
  premium:      'full',
  conservative: 'standard',
  balanced:     'standard',
  aggressive:   'light',
  budget:       'light',
};

function runAIMaintenanceTick(store: StoreState, gameDay: number): void {
  const { aiAirlines, aiAircraft } = store;

  Object.values(aiAirlines).forEach(airline => {
    if (airline.isInsolvent) return;

    const threshold = AI_MAINT_THRESHOLD[airline.personality] ?? 40;
    const tier = (AI_MAINT_TIER[airline.personality] ?? 'standard') as MaintenanceTier;
    const maintDuration = MAINTENANCE_TIERS[tier].durationDays;

    airline.fleetIds.forEach(acId => {
      const ac = aiAircraft[acId];
      if (!ac || ac.status === 'crashed') return;

      // Complete elapsed maintenance
      if (ac.status === 'maintenance') {
        if (gameDay - ac.lastMaintenanceGameDay >= maintDuration) {
          store.completeAIMaintenance(acId);
        }
        return;
      }

      // Trigger maintenance when condition falls below personality threshold
      if (ac.condition <= threshold) {
        const aircraftType = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
        if (!aircraftType) return;
        const cost = computeMaintenanceCost(tier, ac.maintenanceHoursOwed, aircraftType.maintenanceCostPerHourUSD, getMaintenanceAgeMultiplier(ac, gameDay));
        // Skip if airline can't afford it (they'll keep flying degraded — risky but realistic)
        if (airline.cashUSD < cost) return;
        store.startAIMaintenance(acId, gameDay, tier);
      }
    });
  });
}

const AI_BUYOUT_INTERVAL = 90;   // days between AI-to-AI acquisition checks
const AI_BUYOUT_PROBABILITY = 0.08;
const AI_DISSOLVE_INTERVAL = 30;  // days between dissolution checks
const AI_DISSOLVE_PROBABILITY = 0.40;
const AI_DISSOLVE_THRESHOLD = -100_000_000;

function tryAIBuyout(store: StoreState, gameDay: number): void {
  if (gameDay % AI_BUYOUT_INTERVAL !== 0) return;
  if (Math.random() > AI_BUYOUT_PROBABILITY) return;

  const { aiAirlines } = store;

  const targets = Object.values(aiAirlines).filter(a => a.canBeTakenOver || a.isInsolvent);
  if (targets.length === 0) return;

  const buyers = Object.values(aiAirlines).filter(a =>
    !a.isInsolvent &&
    a.cashUSD > 30_000_000 &&
    (a.personality === 'aggressive' || a.personality === 'balanced'),
  );
  if (buyers.length === 0) return;

  const target = targets[Math.floor(Math.random() * targets.length)];
  const buyer  = buyers[Math.floor(Math.random() * buyers.length)];
  if (buyer.id === target.id) return;

  // Discounted distress price: fleet residual minus debt
  const cost = Math.max(0, target.fleetIds.length * 5_000_000 - Math.abs(Math.min(0, target.cashUSD)));
  if (buyer.cashUSD < cost) return;

  store.aiAcquireAirline(buyer.id, target.id, cost);
  store.pushNewsItem(`ACQUISITION: ${buyer.name} has acquired ${target.name}.`);
}

function tryDissolveInsolvent(store: StoreState, gameDay: number): void {
  if (gameDay % AI_DISSOLVE_INTERVAL !== 0) return;
  Object.values(store.aiAirlines).forEach(airline => {
    if (!airline.isInsolvent) return;
    if (airline.cashUSD > AI_DISSOLVE_THRESHOLD) return;
    if (Math.random() < AI_DISSOLVE_PROBABILITY) {
      store.pushNewsItem(`${airline.name} has been dissolved after prolonged insolvency.`);
      store.removeAIAirline(airline.id);
    }
  });
}

function trySellAIShares(store: StoreState): void {
  const { aiAirlines } = store;
  Object.values(aiAirlines).forEach(seller => {
    if (seller.cashUSD > 8_000_000) return; // only sell when cash is tight
    // Find cross-holdings this airline has in other AI airlines
    Object.entries(aiAirlines).forEach(([targetId, target]) => {
      if (targetId === seller.id) return;
      const stake = (target.shareholders ?? {})[seller.id] ?? 0;
      if (stake <= 0) return;
      // Sell half the stake (round to whole percent, minimum 1%)
      const toSell = Math.max(1, Math.floor(stake / 2));
      store.sellAIShares(seller.id, targetId, toSell);
    });
  });
}

export function runAITick(store: StoreState, gameDay: number): void {
  const perfStart = typeof performance !== 'undefined' ? performance.now() : 0;
  void store;

  useGameStore.setState((state) => {
    const { aiAirlines, aiAircraft, aiRoutes, airports } = state;
    const pushAINews = (text: string) => {
      state.newsTicker.unshift({ id: `news_${Date.now()}_${Math.random().toString(36).slice(2)}`, text });
      if (state.newsTicker.length > 20) state.newsTicker.pop();
    };

    // Spawn new airline
    if (gameDay % SPAWN_CHECK_INTERVAL === 0) {
      const activeCount = Object.values(aiAirlines).filter(a => !a.isInsolvent).length;
      const spawnProb = activeCount < 4 ? SPAWN_PROBABILITY_LOW : SPAWN_PROBABILITY_BASE;
      if (activeCount < MAX_AI_AIRLINES && Math.random() <= spawnProb) {
        const existingNames = new Set([
          ...Object.values(aiAirlines).map(a => a.name),
          ...Object.values(state.airlines).map(a => a.name),
        ]);
        const usedHubs = new Set(Object.values(aiAirlines).flatMap(a => a.hubIatas));
        const availableHubs = SPAWN_HUBS.filter(h => !usedHubs.has(h) && airports[h]);
        const hubIata = availableHubs[Math.floor(Math.random() * availableHubs.length)];
        if (hubIata) {
          const { name, iataPrefix } = generateAirlineName(existingNames);
          const color = pickUnusedAirlineColor(Object.values(aiAirlines).map(airline => airline.color), gameDay + activeCount);
          const emoji = AIRLINE_EMOJIS[Math.floor(Math.random() * AIRLINE_EMOJIS.length)];
          const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
          const newAirline: Airline = {
            id: `ai-spawned-${uuidv4()}`,
            name, iataPrefix,
            isPlayer: false,
            color, logoEmoji: emoji,
            cashUSD: 30_000_000 + Math.floor(Math.random() * 30_000_000),
            totalDebt: 0,
            hubIatas: [hubIata],
            fleetIds: [], routeIds: [],
            personality,
            foundedGameDay: gameDay,
            isInsolvent: false, canBeTakenOver: false,
            marketSharePercent: 0,
            reputationScore: 50,
            totalPassengersAllTime: 0,
            dailyStats: [],
            crashPenaltyDaysLeft: 0,
            shareholders: {},
            lastDailyProfit: 0,
            maintenancePolicy: { enabled: false, threshold: 40, tier: 'standard', autoMaintainIssues: false },
          };
          aiAirlines[newAirline.id] = newAirline;
          airports[hubIata].isHub = true;
          pushAINews(`NEW ENTRANT: ${name} has launched operations with a new hub at ${hubIata}.`);
        }
      }
    }

    // AI buyouts
    if (gameDay % AI_BUYOUT_INTERVAL === 0 && Math.random() <= AI_BUYOUT_PROBABILITY) {
      const targets = Object.values(aiAirlines).filter(a => a.canBeTakenOver || a.isInsolvent);
      const buyers = Object.values(aiAirlines).filter(a =>
        !a.isInsolvent &&
        a.cashUSD > 30_000_000 &&
        (a.personality === 'aggressive' || a.personality === 'balanced'),
      );
      const target = targets[Math.floor(Math.random() * targets.length)];
      const buyer = buyers[Math.floor(Math.random() * buyers.length)];
      if (target && buyer && buyer.id !== target.id) {
        const cost = Math.max(0, target.fleetIds.length * 5_000_000 - Math.abs(Math.min(0, target.cashUSD)));
        if (buyer.cashUSD >= cost) {
          buyer.cashUSD -= cost;
          target.fleetIds.forEach(id => {
            const ac = aiAircraft[id];
            if (ac) { ac.airlineId = buyer.id; buyer.fleetIds.push(id); }
          });
          target.routeIds.forEach(id => {
            const route = aiRoutes[id];
            if (route) { route.airlineId = buyer.id; buyer.routeIds.push(id); }
          });
          Object.entries(target.shareholders ?? {}).forEach(([otherId, pct]) => {
            const other = aiAirlines[otherId];
            if (other) {
              other.shareholders ??= {};
              other.shareholders[buyer.id] = (other.shareholders[buyer.id] ?? 0) + pct;
              delete other.shareholders[target.id];
            }
          });
          delete aiAirlines[target.id];
          pushAINews(`ACQUISITION: ${buyer.name} has acquired ${target.name}.`);
        }
      }
    }

    // Dissolve long-insolvent airlines
    if (gameDay % AI_DISSOLVE_INTERVAL === 0) {
      Object.values(aiAirlines).forEach(airline => {
        if (!airline.isInsolvent || airline.cashUSD > AI_DISSOLVE_THRESHOLD) return;
        if (Math.random() >= AI_DISSOLVE_PROBABILITY) return;
        pushAINews(`${airline.name} has been dissolved after prolonged insolvency.`);
        airline.routeIds.forEach(rid => { delete aiRoutes[rid]; });
        airline.fleetIds.forEach(aid => { delete aiAircraft[aid]; });
        delete aiAirlines[airline.id];
      });
    }

    // Maintenance, route triage, expansion, share sales, pricing
    Object.values(aiAirlines).forEach(airline => {
      if (airline.isInsolvent) return;

      const threshold = AI_MAINT_THRESHOLD[airline.personality] ?? 40;
      const tier = (AI_MAINT_TIER[airline.personality] ?? 'standard') as MaintenanceTier;
      const maintDuration = MAINTENANCE_TIERS[tier].durationDays;
      airline.fleetIds.forEach(acId => {
        const ac = aiAircraft[acId];
        if (!ac || ac.status === 'crashed') return;
        if (ac.status === 'maintenance') {
          if (gameDay - ac.lastMaintenanceGameDay >= maintDuration) {
            const gain = MAINTENANCE_TIERS[ac.activeMaintTier ?? 'standard'].conditionGain;
            ac.condition = gain >= 999 ? 100 : Math.min(100, ac.condition + gain);
            ac.maintenanceHoursOwed = 0;
            ac.isGrounded = false;
            ac.groundedReason = undefined;
            ac.activeMaintTier = null;
            ac.status = ac.assignedRouteId ? 'flying' : 'idle';
            ac.crashRisk = 0;
            ac.knownFaultRiskMod = 1;
            if (ac.assignedRouteId && aiRoutes[ac.assignedRouteId]) aiRoutes[ac.assignedRouteId].isActive = true;
          }
          return;
        }
        if (ac.condition <= threshold) {
          const aircraftType = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
          if (!aircraftType) return;
          const cost = computeMaintenanceCost(tier, ac.maintenanceHoursOwed, aircraftType.maintenanceCostPerHourUSD, getMaintenanceAgeMultiplier(ac, gameDay));
          if (airline.cashUSD < cost) return;
          ac.status = 'maintenance';
          ac.isGrounded = true;
          ac.lastMaintenanceGameDay = gameDay;
          ac.activeMaintTier = tier;
          if (ac.assignedRouteId && aiRoutes[ac.assignedRouteId]) aiRoutes[ac.assignedRouteId].isActive = false;
          airline.cashUSD -= cost;
        }
      });

      if (airline.cashUSD < AI_CASH_STRESS_THRESHOLD) {
        const maxRoutes = airline.cashUSD < AI_CRITICAL_CASH_THRESHOLD ? 3 : 1;
        const worstRoutes = airline.routeIds
          .map(routeId => aiRoutes[routeId])
          .filter((route): route is Route => !!route && route.dailyProfit < -2_500)
          .sort((a, b) => a.dailyProfit - b.dailyProfit)
          .slice(0, maxRoutes);
        worstRoutes.forEach(route => {
          if (route.aircraftId && aiAircraft[route.aircraftId]) {
            aiAircraft[route.aircraftId].assignedRouteId = null;
            aiAircraft[route.aircraftId].status = 'idle';
          }
          airline.routeIds = airline.routeIds.filter(id => id !== route.id);
          delete aiRoutes[route.id];
          pushAINews(`${airline.name} has suspended a loss-making route.`);
        });
      }

      const expandInterval = AI_EXPAND_INTERVAL_DAYS[airline.personality] ?? 7;
      if (airline.cashUSD > aiCashReserve(airline) && gameDay % expandInterval === aiScheduleOffset(airline.id, expandInterval)) {
        const currentGameYear = 1960 + Math.floor(gameDay / 365);
        const maxPurchaseShare = AI_PURCHASE_CASH_SHARE[airline.personality] ?? 0.28;
        const cashReserve = aiCashReserve(airline);
        const affordableTypes = AIRCRAFT_TYPES
          .filter(t =>
            t.yearIntroduced <= currentGameYear &&
            t.purchasePrice <= airline.cashUSD * maxPurchaseShare &&
            airline.cashUSD - t.purchasePrice >= cashReserve
          )
          .sort((a, b) => b.seatsEconomy - a.seatsEconomy);
        const plan = affordableTypes.length > 0
          ? findBestAIPlan(airline, affordableTypes, aiRoutes, airports, gameDay, state.globalFuelPrice || FUEL_PRICE_USD_PER_LITER)
          : null;
        if (plan && plan.expectedDailyProfit >= AI_MIN_EXPANSION_PROFIT_PER_DAY) {
          const newAircraft = createAIAircraft(airline, plan.aircraftType, gameDay, plan.origin);
          const newRoute = buildAIRouteFromPlan(airline, newAircraft.id, plan, gameDay);
          newAircraft.assignedRouteId = newRoute.id;
          airline.cashUSD -= plan.aircraftType.purchasePrice;
          airline.fleetIds.push(newAircraft.id);
          airline.routeIds.push(newRoute.id);
          aiAircraft[newAircraft.id] = newAircraft;
          aiRoutes[newRoute.id] = newRoute;
        }
      }

      if (airline.cashUSD <= 8_000_000) {
        Object.entries(aiAirlines).forEach(([targetId, target]) => {
          if (targetId === airline.id) return;
          const stake = (target.shareholders ?? {})[airline.id] ?? 0;
          if (stake <= 0) return;
          const toSell = Math.max(1, Math.floor(stake / 2));
          const proceeds = Math.round((rawCompanyValue(target, aiAircraft, aiRoutes) / 100) * toSell / 100_000) * 100_000;
          target.shareholders ??= {};
          const remaining = stake - toSell;
          if (remaining <= 0) delete target.shareholders[airline.id];
          else target.shareholders[airline.id] = remaining;
          airline.cashUSD += proceeds;
        });
      }

      const targetMultiplier = AI_PRICE_MULTIPLIER[airline.personality] ?? 1.0;
      const loadTarget = AI_LOAD_TARGET[airline.personality] ?? 0.70;
      airline.routeIds.forEach(rid => {
        const route = aiRoutes[rid];
        if (!route || route.dailyCost <= 0 || route.dailyPassengers <= 0) return;
        const currentPrice = Math.max(50, route.priceEconomy);
        const currentPax = Math.max(1, route.dailyPassengers || 1);
        const loadFactor = route.loadFactorEconomy || 0.5;
        const estimatedCapacity = Math.max(currentPax, currentPax / Math.max(0.15, loadFactor));
        const steps = [0.84, 0.90, 0.96, 1.00, 1.04, 1.08, 1.14, 1.20];
        const best = steps
          .map(multiplier => {
            const price = Math.max(50, Math.round(currentPrice * multiplier));
            const demand = currentPax * Math.pow(price / currentPrice, PRICE_ELASTICITY);
            const loadBias = loadFactor < loadTarget - 0.12 && multiplier > 1 ? 0.92 : 1;
            const pax = Math.min(estimatedCapacity, demand * loadBias);
            const revenue = pax * price;
            return { price, profit: revenue - route.dailyCost };
          })
          .sort((a, b) => b.profit - a.profit)[0];
        if (best && Math.abs(best.price - currentPrice) / currentPrice >= 0.025) {
          route.priceEconomy = best.price;
          route.priceBusiness = route.priceBusiness > 0 ? Math.round(best.price * 4 * targetMultiplier) : 0;
        }
      });
    });
  });

  if (typeof import.meta !== 'undefined' && import.meta.env.DEV) {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : 0) - perfStart;
    if (elapsed > 50) console.info(`[perf] ai date-change ${elapsed.toFixed(1)}ms`);
  }
}

function dropWorstRoutes(airline: Airline, aiRoutes: Record<string, Route>, store: StoreState, maxRoutes: number): void {
  const worstRoutes = airline.routeIds
    .map(routeId => aiRoutes[routeId])
    .filter((route): route is Route => !!route && route.dailyProfit < -2_500)
    .sort((a, b) => a.dailyProfit - b.dailyProfit)
    .slice(0, maxRoutes);

  worstRoutes.forEach(route => {
    store.removeAIRoute(route.id);
    store.pushNewsItem(`${airline.name} has suspended a loss-making route.`);
  });
}

function tryExpand(
  airline: Airline,
  _aiAircraft: Record<string, Aircraft>,
  aiRoutes: Record<string, Route>,
  airports: Record<string, Airport>,
  store: StoreState,
  gameDay: number,
): void {
  const currentGameYear = 1960 + Math.floor(gameDay / 365);
  const maxPurchaseShare = AI_PURCHASE_CASH_SHARE[airline.personality] ?? 0.28;
  const cashReserve = aiCashReserve(airline);
  const affordableTypes = AIRCRAFT_TYPES
    .filter(t =>
      t.yearIntroduced <= currentGameYear &&
      t.purchasePrice <= airline.cashUSD * maxPurchaseShare &&
      airline.cashUSD - t.purchasePrice >= cashReserve
    )
    .sort((a, b) => b.seatsEconomy - a.seatsEconomy);

  if (affordableTypes.length === 0) return;

  const plan = findBestAIPlan(
    airline,
    affordableTypes,
    aiRoutes,
    airports,
    gameDay,
    store.globalFuelPrice || FUEL_PRICE_USD_PER_LITER,
  );
  if (!plan || plan.expectedDailyProfit < AI_MIN_EXPANSION_PROFIT_PER_DAY) return;

  // Create aircraft
  const newAircraft = createAIAircraft(airline, plan.aircraftType, gameDay, plan.origin);
  const newRoute = buildAIRouteFromPlan(airline, newAircraft.id, plan, gameDay);

  newAircraft.assignedRouteId = newRoute.id;

  // Deduct cash, register aircraft, create route
  store.updateAIAirline(airline.id, {
    cashUSD: airline.cashUSD - plan.aircraftType.purchasePrice,
    fleetIds: [...airline.fleetIds, newAircraft.id],
  });
  store.addAIAircraft(newAircraft);
  store.addAIRoute(newRoute);
}

function adjustPrices(
  airline: Airline,
  aiRoutes: Record<string, Route>,
  targetMultiplier: number,
  loadTarget: number,
  store: StoreState,
): void {
  airline.routeIds.forEach(rid => {
    const route = aiRoutes[rid];
    if (!route) return;
    if (route.dailyCost <= 0 || route.dailyPassengers <= 0) return;

    const currentPrice = Math.max(50, route.priceEconomy);
    const currentPax = Math.max(1, route.dailyPassengers || 1);
    const loadFactor = route.loadFactorEconomy || 0.5;
    const estimatedCapacity = Math.max(currentPax, currentPax / Math.max(0.15, loadFactor));
    const steps = [0.84, 0.90, 0.96, 1.00, 1.04, 1.08, 1.14, 1.20];
    const best = steps
      .map(multiplier => {
        const price = Math.max(50, Math.round(currentPrice * multiplier));
        const demand = currentPax * Math.pow(price / currentPrice, PRICE_ELASTICITY);
        const loadBias = loadFactor < loadTarget - 0.12 && multiplier > 1 ? 0.92 : 1;
        const pax = Math.min(estimatedCapacity, demand * loadBias);
        const revenue = pax * price;
        return { price, profit: revenue - route.dailyCost };
      })
      .sort((a, b) => b.profit - a.profit)[0];

    if (best && Math.abs(best.price - currentPrice) / currentPrice >= 0.025) {
      const updatedRoute: Route = {
        ...route,
        priceEconomy: best.price,
        priceBusiness: route.priceBusiness > 0 ? Math.round(best.price * 4 * targetMultiplier) : 0,
      };
      store.addAIRoute(updatedRoute); // addAIRoute overwrites if same id
    }
  });
}

void trySpawnNewAirline;
void runAIMaintenanceTick;
void tryAIBuyout;
void tryDissolveInsolvent;
void trySellAIShares;
void dropWorstRoutes;
void tryExpand;
void adjustPrices;
