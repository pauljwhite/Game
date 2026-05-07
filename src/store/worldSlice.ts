import type { StateCreator } from 'zustand';
import type { Airport, Airline, Aircraft, Route } from '@/types';
import type { NewsArticle, NewsTickerItem } from './uiSlice';
import { AIRPORTS } from '@/data/airports';
import { MAINTENANCE_TIERS, computeMaintenanceCost, getMaintenanceAgeMultiplier } from '@/utils/constants';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import type { MaintenanceTier } from '@/types/aircraft';
import { rawCompanyValue } from '@/engine/valuation';
import { calculateDailyLoanPayment } from '@/engine/finance';
import type { GameStore } from './index';

type AirlineStatsUpdate = {
  netProfit: number;
  passengers: number;
  revenue: number;
  costs: number;
  gameDay: number;
  recoverRep?: boolean;
};

type AircraftDeltaUpdate = { conditionDelta: number; hoursOwed: number };

type DailyEconomicsBatch = {
  playerRouteUpdates: Record<string, Partial<Route>>;
  playerAircraftUpdates: Record<string, AircraftDeltaUpdate>;
  playerMaintenanceCompletions: Array<{ aircraftId: string; newsText: string }>;
  playerMaintenanceStarts: Array<{ aircraftId: string; gameDay: number; tier: MaintenanceTier; newsText: string }>;
  playerCrashIds: string[];
  playerPnl: { netProfit: number; passengers: number; revenue: number; costs: number } | null;
  playerReputationDelta: number;
  aiRouteUpdates: Record<string, Partial<Route>>;
  aiAircraftUpdates: Record<string, AircraftDeltaUpdate>;
  aiCrashIds: string[];
  aiStatsUpdates: Record<string, AirlineStatsUpdate>;
  dividendPayments: Array<{ payerAirlineId: string; receiverOwnerId: string; amount: number }>;
  airportDailyPax: Record<string, number>;
  newsItems: Array<string | Omit<NewsTickerItem, 'id'>>;
  newspaperArticles: NewsArticle[];
};

export interface WorldSlice {
  airports: Record<string, Airport>;
  aiAirlines: Record<string, Airline>;
  aiAircraft: Record<string, Aircraft>;
  aiRoutes: Record<string, Route>;
  globalFuelPrice: number;
  newsTicker: NewsTickerItem[];
  totalMarketPAX: number;

  initWorld: () => void;
  setAIAirlines: (airlines: Record<string, Airline>, aircraft: Record<string, Aircraft>, routes: Record<string, Route>) => void;
  updateAIAirline: (id: string, changes: Partial<Airline>) => void;
  adjustAIAirlineReputation: (id: string, delta: number) => void;
  addAIRoute: (route: Route) => void;
  removeAIRoute: (routeId: string) => void;
  pushNewsItem: (item: string | Omit<NewsTickerItem, 'id'>) => void;
  setGlobalFuelPrice: (price: number) => void;
  updateTotalMarketPAX: (pax: number) => void;
  setAirportHub: (iata: string, isHub: boolean) => void;
  setAirportClosure: (iata: string, untilGameDay: number, reason: string) => void;
  airportDailyPax: Record<string, number>;
  setAirportDailyPax: (pax: Record<string, number>) => void;
  updateAIAircraftCondition: (aircraftId: string, conditionDelta: number, hoursOwed: number) => void;
  batchUpdateAIRoutes: (updates: Record<string, Partial<Route>>) => void;
  batchUpdateAIAircraft: (updates: Record<string, { conditionDelta: number; hoursOwed: number }>) => void;
  startAIMaintenance: (aircraftId: string, gameDay: number, tier: MaintenanceTier) => void;
  completeAIMaintenance: (aircraftId: string) => void;
  updateAIAirlineStats: (id: string, netProfit: number, passengers: number, revenue: number, costs: number, gameDay: number, recoverRep?: boolean) => void;
  batchUpdateAIAirlineStats: (updates: Record<string, { netProfit: number; passengers: number; revenue: number; costs: number; gameDay: number; recoverRep?: boolean }>) => void;
  removeAIAirline: (id: string) => void;
  addAIAirline: (airline: Airline) => void;
  addAIAircraft: (aircraft: Aircraft) => void;
  updateAIRoute: (routeId: string, changes: Partial<Route>) => void;
  aiAcquireAirline: (buyerId: string, targetId: string, cost: number) => void;
  setShareholding: (targetId: string, ownerId: string, newPercent: number) => void;
  sellAIShares: (sellerId: string, targetId: string, percent: number) => void;
  applyAIDividend: (airlineId: string, amount: number) => void;
  payDividend: (payerAirlineId: string, receiverOwnerId: string, amount: number) => void;
  batchPayDividends: (payments: Array<{ payerAirlineId: string; receiverOwnerId: string; amount: number }>) => void;
  applyDailyEconomicsBatch: (batch: DailyEconomicsBatch) => void;
  ignoreAIGrounding: (aircraftId: string) => void;
  triggerAICrash: (aircraftId: string) => void;
}

function createAirportMap(): Record<string, Airport> {
  const airports: Record<string, Airport> = {};
  AIRPORTS.forEach(ap => { airports[ap.iata] = { ...ap }; });
  return airports;
}

function addNewsItemToState(state: GameStore, item: string | Omit<NewsTickerItem, 'id'>): void {
  const baseItem = typeof item === 'string'
    ? { id: `news_${Date.now()}_${Math.random().toString(36).slice(2)}`, text: item }
    : { id: `news_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...item };
  const shouldCreateArticle = baseItem.playerRelated && !baseItem.articleId;
  const newsItem = shouldCreateArticle
    ? { ...baseItem, articleId: `${baseItem.id}_article`, severity: baseItem.severity ?? 'fleet' as const }
    : baseItem;
  if (shouldCreateArticle && newsItem.articleId) {
    state.newspaperQueue.push({
      id: newsItem.articleId,
      headline: state.airlines.player?.name ?? 'Airline Operations Update',
      subheadline: newsItem.text,
      paragraphs: [newsItem.text],
      severity: newsItem.severity === 'breaking' ? 'crash' : 'incident',
      gameDay: state.gameDay,
      suppressAutoOpen: true,
    });
    if (state.newspaperQueue.length > 8) state.newspaperQueue.shift();
  }
  state.newsTicker.unshift(newsItem);
  if (state.newsTicker.length > 20) state.newsTicker.pop();
}

function applyAircraftConditionDelta(
  ac: Aircraft,
  conditionDelta: number,
  hoursOwed: number,
  gameDay: number,
  groundThreshold: number,
  routes: Record<string, Route>,
): void {
  ac.condition = Math.max(0, Math.min(100, ac.condition + conditionDelta));
  ac.maintenanceHoursOwed += hoursOwed;
  ac.totalFlightHours += hoursOwed;
  const condFrac = Math.max(0, 1 - ac.condition / 100);
  const baseCrashRisk = condFrac ** 3;
  const agePenalty = Math.max(0, ((gameDay - ac.purchasedGameDay) / 365 - 15) * 0.01);
  ac.crashRisk = Math.min(0.95, baseCrashRisk + agePenalty);
  if (ac.condition < groundThreshold && !ac.isGrounded && ac.status !== 'maintenance') {
    ac.isGrounded = true;
    ac.knownFaultRiskMod = 1;
    ac.groundedReason = `Critical condition (${ac.condition.toFixed(0)}%) — requires maintenance`;
    if (ac.assignedRouteId && routes[ac.assignedRouteId]) {
      routes[ac.assignedRouteId].isActive = false;
    }
  }
}

function reconcilePlayerRouteIdsInState(state: Pick<GameStore, 'airlines' | 'routes'>): void {
  const player = state.airlines.player;
  if (!player) return;
  const seen = new Set<string>();
  player.routeIds = [...player.routeIds, ...Object.values(state.routes).filter(route => route.airlineId === 'player').map(route => route.id)]
    .filter(id => {
      if (seen.has(id) || state.routes[id]?.airlineId !== 'player') return false;
      seen.add(id);
      return true;
    });
}

export const createWorldSlice: StateCreator<GameStore, [['zustand/immer', never]], [], WorldSlice> = (set, get) => ({
  airports: createAirportMap(),
  aiAirlines: {},
  aiAircraft: {},
  aiRoutes: {},
  globalFuelPrice: 0.82,
  newsTicker: [{ id: 'welcome', text: 'Welcome to Mighty Airline Empire! Build your airline from the ground up.' }],
  totalMarketPAX: 0,
  airportDailyPax: {},

  setAirportDailyPax: (pax) => {
    const current = get().airportDailyPax;
    const currentKeys = Object.keys(current);
    const nextKeys = Object.keys(pax);
    if (
      currentKeys.length === nextKeys.length &&
      nextKeys.every(key => current[key] === pax[key])
    ) return;
    set((state) => { state.airportDailyPax = pax; });
  },

  initWorld: () =>
    set((state) => {
      state.airports = createAirportMap();
      state.airlines = {};
      state.aircraft = {};
      state.routes = {};
      state.aiAirlines = {};
      state.aiAircraft = {};
      state.aiRoutes = {};
      state.airportDailyPax = {};
      state.totalMarketPAX = 0;
      state.newsTicker = [{ id: 'welcome', text: 'Welcome to Mighty Airline Empire! Build your airline from the ground up.' }];
      state.newspaperQueue = [];
      state.selectedAirportIata = null;
      state.selectedRouteId = null;
      state.openPanel = null;
      state.modalPayload = null;
    }),

  setAIAirlines: (airlines, aircraft, routes) =>
    set((state) => {
      state.aiAirlines = airlines;
      state.aiAircraft = aircraft;
      state.aiRoutes = routes;
    }),

  updateAIAirline: (id, changes) =>
    set((state) => {
      if (state.aiAirlines[id]) Object.assign(state.aiAirlines[id], changes);
    }),

  adjustAIAirlineReputation: (id, delta) =>
    set((state) => {
      const airline = state.aiAirlines[id];
      if (!airline) return;
      airline.reputationScore = Math.max(0, Math.min(100, airline.reputationScore + delta));
    }),

  addAIRoute: (route) =>
    set((state) => {
      state.aiRoutes[route.id] = route;
      if (state.aiAirlines[route.airlineId]) {
        const routeIds = state.aiAirlines[route.airlineId].routeIds;
        if (!routeIds.includes(route.id)) routeIds.push(route.id);
      }
    }),

  removeAIRoute: (routeId) =>
    set((state) => {
      const route = state.aiRoutes[routeId];
      if (!route) return;
      if (route.aircraftId && state.aiAircraft[route.aircraftId]) {
        state.aiAircraft[route.aircraftId].assignedRouteId = null;
        state.aiAircraft[route.aircraftId].status = 'idle';
      }
      if (state.aiAirlines[route.airlineId]) {
        state.aiAirlines[route.airlineId].routeIds = state.aiAirlines[route.airlineId].routeIds.filter(id => id !== routeId);
      }
      delete state.aiRoutes[routeId];
    }),

  pushNewsItem: (item) =>
    set((state) => {
      addNewsItemToState(state, item);
    }),

  setGlobalFuelPrice: (price) =>
    set((state) => { state.globalFuelPrice = price; }),

  updateTotalMarketPAX: (pax) =>
    set((state) => { state.totalMarketPAX = pax; }),

  setAirportHub: (iata, isHub) =>
    set((state) => {
      if (state.airports[iata]) state.airports[iata].isHub = isHub;
    }),

  setAirportClosure: (iata, untilGameDay, reason) =>
    set((state) => {
      if (state.airports[iata]) {
        state.airports[iata].closedUntilGameDay = untilGameDay;
        state.airports[iata].closureReason = reason;
      }
    }),

  updateAIAircraftCondition: (aircraftId, conditionDelta, hoursOwed) =>
    set((state) => {
      const ac = state.aiAircraft[aircraftId];
      if (!ac) return;
      ac.condition = Math.max(0, Math.min(100, ac.condition + conditionDelta));
      ac.maintenanceHoursOwed += hoursOwed;
      ac.totalFlightHours += hoursOwed;
      const condFrac = Math.max(0, 1 - ac.condition / 100);
      const baseCrashRisk = condFrac ** 3;
      const agePenalty = Math.max(0, ((state.gameDay - ac.purchasedGameDay) / 365 - 15) * 0.01);
      ac.crashRisk = Math.min(0.95, baseCrashRisk + agePenalty);
      // Emergency grounding at critically low condition
      if (ac.condition < 15 && !ac.isGrounded && ac.status !== 'maintenance') {
        ac.isGrounded = true;
        ac.knownFaultRiskMod = 1; // reset when force-grounded
        if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
          state.aiRoutes[ac.assignedRouteId].isActive = false;
        }
      }
    }),

  batchUpdateAIRoutes: (updates) => {
    if (Object.keys(updates).length === 0) return;
    set((state) => {
      for (const [routeId, changes] of Object.entries(updates)) {
        if (state.aiRoutes[routeId]) Object.assign(state.aiRoutes[routeId], changes);
      }
    });
  },

  batchUpdateAIAircraft: (updates) => {
    if (Object.keys(updates).length === 0) return;
    set((state) => {
      for (const [acId, { conditionDelta, hoursOwed }] of Object.entries(updates)) {
        const ac = state.aiAircraft[acId];
        if (!ac) continue;
        ac.condition = Math.max(0, Math.min(100, ac.condition + conditionDelta));
        ac.maintenanceHoursOwed += hoursOwed;
        ac.totalFlightHours += hoursOwed;
        const condFrac = Math.max(0, 1 - ac.condition / 100);
        const baseCrashRisk = condFrac ** 3;
        const agePenalty = Math.max(0, ((state.gameDay - ac.purchasedGameDay) / 365 - 15) * 0.01);
        ac.crashRisk = Math.min(0.95, baseCrashRisk + agePenalty);
        if (ac.condition < 15 && !ac.isGrounded && ac.status !== 'maintenance') {
          ac.isGrounded = true;
          ac.knownFaultRiskMod = 1;
          if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
            state.aiRoutes[ac.assignedRouteId].isActive = false;
          }
        }
      }
    });
  },

  ignoreAIGrounding: (aircraftId) =>
    set((state) => {
      const ac = state.aiAircraft[aircraftId];
      if (!ac) return;
      ac.isGrounded = false;
      ac.groundedReason = undefined;
      ac.knownFaultRiskMod = 5;
      if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
        state.aiRoutes[ac.assignedRouteId].isActive = true;
      }
    }),

  triggerAICrash: (aircraftId) =>
    set((state) => {
      const ac = state.aiAircraft[aircraftId];
      if (!ac) return;
      const airline = state.aiAirlines[ac.airlineId];
      ac.status = 'crashed';
      if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
        state.aiRoutes[ac.assignedRouteId].aircraftId = null;
        state.aiRoutes[ac.assignedRouteId].isActive = false;
      }
      if (airline) {
        airline.fleetIds = airline.fleetIds.filter(id => id !== aircraftId);
        airline.reputationScore = Math.max(0, airline.reputationScore - 40);
        airline.cashUSD -= 25_000_000;
      }
      delete state.aiAircraft[aircraftId];
    }),

  startAIMaintenance: (aircraftId, gameDay, tier) =>
    set((state) => {
      const ac = state.aiAircraft[aircraftId];
      if (!ac) return;
      const airline = state.aiAirlines[ac.airlineId];
      const aircraftType = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
      if (!airline || !aircraftType) return;
      const cost = computeMaintenanceCost(tier, ac.maintenanceHoursOwed, aircraftType.maintenanceCostPerHourUSD, getMaintenanceAgeMultiplier(ac, state.gameDay));
      ac.status = 'maintenance';
      ac.isGrounded = true;
      ac.lastMaintenanceGameDay = gameDay;
      ac.activeMaintTier = tier;
      if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
        state.aiRoutes[ac.assignedRouteId].isActive = false;
      }
      airline.cashUSD -= cost;
    }),

  completeAIMaintenance: (aircraftId) =>
    set((state) => {
      const ac = state.aiAircraft[aircraftId];
      if (!ac) return;
      const tier = ac.activeMaintTier ?? 'standard';
      const gain = MAINTENANCE_TIERS[tier].conditionGain;
      ac.condition = gain >= 999 ? 100 : Math.min(100, ac.condition + gain);
      ac.maintenanceHoursOwed = 0;
      ac.isGrounded = false;
      ac.groundedReason = undefined;
      ac.activeMaintTier = null;
      ac.status = ac.assignedRouteId ? 'flying' : 'idle';
      ac.crashRisk = 0;
      ac.knownFaultRiskMod = 1;
      if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
        state.aiRoutes[ac.assignedRouteId].isActive = true;
      }
    }),

  updateAIAirlineStats: (id, netProfit, passengers, revenue, costs, gameDay, recoverRep = false) =>
    set((state) => {
      const airline = state.aiAirlines[id];
      if (!airline) return;
      airline.cashUSD += netProfit;
      airline.totalPassengersAllTime += passengers;
      airline.lastDailyProfit = netProfit;
      airline.isInsolvent = airline.cashUSD < -50_000_000;
      airline.canBeTakenOver = airline.cashUSD < 0 && Math.abs(airline.cashUSD) > 20_000_000;
      airline.dailyStats.push({ gameDay, revenue, costs, profit: netProfit, passengers, cashEnd: airline.cashUSD });
      if (airline.dailyStats.length > 365) airline.dailyStats.shift();
      if (recoverRep && !airline.isInsolvent && airline.reputationScore < 100) {
        airline.reputationScore = Math.min(100, airline.reputationScore + 0.3);
      }
    }),

  batchUpdateAIAirlineStats: (updates) => {
    if (Object.keys(updates).length === 0) return;
    set((state) => {
      for (const [id, { netProfit, passengers, revenue, costs, gameDay, recoverRep = false }] of Object.entries(updates)) {
        const airline = state.aiAirlines[id];
        if (!airline) continue;
        airline.cashUSD += netProfit;
        airline.totalPassengersAllTime += passengers;
        airline.lastDailyProfit = netProfit;
        airline.isInsolvent = airline.cashUSD < -50_000_000;
        airline.canBeTakenOver = airline.cashUSD < 0 && Math.abs(airline.cashUSD) > 20_000_000;
        airline.dailyStats.push({ gameDay, revenue, costs, profit: netProfit, passengers, cashEnd: airline.cashUSD });
        if (airline.dailyStats.length > 365) airline.dailyStats.shift();
        if (recoverRep && !airline.isInsolvent && airline.reputationScore < 100) {
          airline.reputationScore = Math.min(100, airline.reputationScore + 0.3);
        }
      }
    });
  },

  removeAIAirline: (id) =>
    set((state) => {
      const airline = state.aiAirlines[id];
      if (!airline) return;
      airline.routeIds.forEach(rid => { delete state.aiRoutes[rid]; });
      airline.fleetIds.forEach(aid => { delete state.aiAircraft[aid]; });
      delete state.aiAirlines[id];
    }),

  addAIAirline: (airline) =>
    set((state) => {
      state.aiAirlines[airline.id] = airline;
    }),

  addAIAircraft: (aircraft) =>
    set((state) => {
      state.aiAircraft[aircraft.id] = aircraft;
    }),

  updateAIRoute: (routeId, changes) =>
    set((state) => {
      if (state.aiRoutes[routeId]) Object.assign(state.aiRoutes[routeId], changes);
    }),

  aiAcquireAirline: (buyerId, targetId, cost) =>
    set((state) => {
      const buyer  = state.aiAirlines[buyerId];
      const target = state.aiAirlines[targetId];
      if (!buyer || !target) return;
      buyer.cashUSD -= cost;
      target.fleetIds.forEach(id => {
        const ac = state.aiAircraft[id];
        if (ac) { ac.airlineId = buyerId; buyer.fleetIds.push(id); }
      });
      target.routeIds.forEach(id => {
        const route = state.aiRoutes[id];
        if (route) { route.airlineId = buyerId; buyer.routeIds.push(id); }
      });
      // Transfer shares the target held in other airlines to buyer
      Object.entries(target.shareholders ?? {}).forEach(([otherId, pct]) => {
        const other = state.aiAirlines[otherId];
        if (other) {
          other.shareholders ??= {};
          other.shareholders[buyerId] = (other.shareholders[buyerId] ?? 0) + pct;
          delete other.shareholders[targetId];
        }
      });
      delete state.aiAirlines[targetId];
    }),

  setShareholding: (targetId, ownerId, newPercent) =>
    set((state) => {
      const target = state.aiAirlines[targetId];
      if (!target) return;
      target.shareholders ??= {};
      if (newPercent <= 0) {
        delete target.shareholders[ownerId];
      } else {
        target.shareholders[ownerId] = newPercent;
      }
    }),

  sellAIShares: (sellerId, targetId, percent) =>
    set((state) => {
      const seller = state.aiAirlines[sellerId];
      const target = state.aiAirlines[targetId];
      if (!seller || !target) return;
      const currentStake = (target.shareholders ?? {})[sellerId] ?? 0;
      if (percent <= 0 || percent > currentStake) return;
      const proceeds = Math.round((rawCompanyValue(target, state.aiAircraft, state.aiRoutes) / 100) * percent / 100_000) * 100_000;
      target.shareholders ??= {};
      const remaining = currentStake - percent;
      if (remaining <= 0) delete target.shareholders[sellerId];
      else target.shareholders[sellerId] = remaining;
      seller.cashUSD += proceeds;
    }),

  applyAIDividend: (airlineId, amount) =>
    set((state) => {
      if (state.aiAirlines[airlineId]) {
        state.aiAirlines[airlineId].cashUSD += amount;
      }
    }),

  payDividend: (payerAirlineId, receiverOwnerId, amount) =>
    set((state) => {
      // Deduct from the airline paying out the dividend
      if (state.aiAirlines[payerAirlineId]) {
        state.aiAirlines[payerAirlineId].cashUSD -= amount;
      }
      // Credit the shareholder
      if (receiverOwnerId === 'player') {
        if (state.airlines['player']) state.airlines['player'].cashUSD += amount;
      } else if (state.aiAirlines[receiverOwnerId]) {
        state.aiAirlines[receiverOwnerId].cashUSD += amount;
      }
    }),

  batchPayDividends: (payments) => {
    if (payments.length === 0) return;
    set((state) => {
      payments.forEach(({ payerAirlineId, receiverOwnerId, amount }) => {
        if (state.aiAirlines[payerAirlineId]) {
          state.aiAirlines[payerAirlineId].cashUSD -= amount;
        }
        if (receiverOwnerId === 'player') {
          if (state.airlines['player']) state.airlines['player'].cashUSD += amount;
        } else if (state.aiAirlines[receiverOwnerId]) {
          state.aiAirlines[receiverOwnerId].cashUSD += amount;
        }
      });
    });
  },

  applyDailyEconomicsBatch: (batch) =>
    set((state) => {
      const player = state.airlines.player;

      batch.playerMaintenanceCompletions.forEach(({ aircraftId }) => {
        const ac = state.aircraft[aircraftId];
        if (!ac) return;
        const tier = ac.activeMaintTier ?? 'standard';
        const gain = MAINTENANCE_TIERS[tier].conditionGain;
        ac.condition = gain >= 999 ? 100 : Math.min(100, ac.condition + gain);
        ac.maintenanceHoursOwed = 0;
        ac.isGrounded = false;
        ac.groundedReason = undefined;
        ac.activeMaintTier = null;
        ac.status = ac.assignedRouteId ? 'flying' : 'idle';
        ac.crashRisk = 0;
        ac.knownFaultRiskMod = 1;
        if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
          state.routes[ac.assignedRouteId].isActive = true;
        }
        if (player) {
          const repBoost = tier === 'full' ? 3 : tier === 'standard' ? 1.5 : 0.5;
          player.reputationScore = Math.min(100, player.reputationScore + repBoost);
        }
      });

      batch.playerMaintenanceStarts.forEach(({ aircraftId, gameDay, tier }) => {
        const ac = state.aircraft[aircraftId];
        if (!ac || !player) return;
        const aircraftType = AIRCRAFT_TYPES.find(type => type.id === ac.typeId);
        const cost = aircraftType
          ? computeMaintenanceCost(tier, ac.maintenanceHoursOwed, aircraftType.maintenanceCostPerHourUSD, getMaintenanceAgeMultiplier(ac, state.gameDay))
          : 0;
        ac.status = 'maintenance';
        ac.isGrounded = true;
        ac.lastMaintenanceGameDay = gameDay;
        ac.activeMaintTier = tier;
        player.cashUSD -= cost;
        if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
          state.routes[ac.assignedRouteId].isActive = false;
        }
      });

      for (const [routeId, changes] of Object.entries(batch.playerRouteUpdates)) {
        if (state.routes[routeId]) Object.assign(state.routes[routeId], changes);
      }
      for (const [acId, { conditionDelta, hoursOwed }] of Object.entries(batch.playerAircraftUpdates)) {
        const ac = state.aircraft[acId];
        if (ac) applyAircraftConditionDelta(ac, conditionDelta, hoursOwed, state.gameDay, 20, state.routes);
      }
      reconcilePlayerRouteIdsInState(state);

      if (player && batch.playerReputationDelta !== 0) {
        player.reputationScore = Math.max(0, Math.min(100, player.reputationScore + batch.playerReputationDelta));
      }

      if (player && batch.playerPnl) {
        let debtService = 0;
        if (player.loans?.length) {
          player.loans.forEach(loan => {
            const interest = (loan.principalUSD * loan.annualInterestRate) / 365;
            const scheduledPayment = loan.dailyPaymentUSD || calculateDailyLoanPayment(loan.principalUSD, loan.annualInterestRate, loan.termYears);
            const payment = Math.min(loan.principalUSD + interest, scheduledPayment);
            const principalPaid = Math.max(0, payment - interest);
            debtService += payment;
            loan.principalUSD = Math.max(0, loan.principalUSD - principalPaid);
          });
          player.loans = player.loans.filter(loan => loan.principalUSD > 1);
          player.totalDebt = player.loans.reduce((sum, loan) => sum + loan.principalUSD, 0);
        }
        const profitAfterDebt = batch.playerPnl.netProfit - debtService;
        player.cashUSD += profitAfterDebt;
        player.totalPassengersAllTime += batch.playerPnl.passengers;
        player.dailyStats.push({
          gameDay: state.gameDay,
          revenue: batch.playerPnl.revenue,
          costs: batch.playerPnl.costs + debtService,
          profit: profitAfterDebt,
          passengers: batch.playerPnl.passengers,
          cashEnd: player.cashUSD,
        });
        if (player.dailyStats.length > 365) player.dailyStats.shift();
        if (player.cashUSD < -100_000_000) player.isInsolvent = true;
        player.canBeTakenOver = player.cashUSD < 0 && Math.abs(player.cashUSD) > player.totalDebt * 2;
        if (player.reputationScore < 100) player.reputationScore = Math.min(100, player.reputationScore + 0.5);
        if (player.crashPenaltyDaysLeft > 0) player.crashPenaltyDaysLeft--;
      }

      batch.playerCrashIds.forEach(aircraftId => {
        const ac = state.aircraft[aircraftId];
        if (!ac || !player) return;
        ac.status = 'crashed';
        ac.isGrounded = true;
        ac.groundedReason = 'Aircraft lost in accident';
        ac.condition = 0;
        ac.crashRisk = 0;
        if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
          state.routes[ac.assignedRouteId].isActive = false;
        }
        player.cashUSD -= 50_000_000;
        player.reputationScore = Math.max(0, player.reputationScore - 45);
        player.crashPenaltyDaysLeft = 60;
      });

      for (const [routeId, changes] of Object.entries(batch.aiRouteUpdates)) {
        if (state.aiRoutes[routeId]) Object.assign(state.aiRoutes[routeId], changes);
      }
      for (const [acId, { conditionDelta, hoursOwed }] of Object.entries(batch.aiAircraftUpdates)) {
        const ac = state.aiAircraft[acId];
        if (ac) applyAircraftConditionDelta(ac, conditionDelta, hoursOwed, state.gameDay, 15, state.aiRoutes);
      }
      batch.aiCrashIds.forEach(aircraftId => {
        const ac = state.aiAircraft[aircraftId];
        if (!ac) return;
        const airline = state.aiAirlines[ac.airlineId];
        ac.status = 'crashed';
        if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
          state.aiRoutes[ac.assignedRouteId].aircraftId = null;
          state.aiRoutes[ac.assignedRouteId].isActive = false;
        }
        if (airline) {
          airline.fleetIds = airline.fleetIds.filter(id => id !== aircraftId);
          airline.reputationScore = Math.max(0, airline.reputationScore - 40);
          airline.cashUSD -= 25_000_000;
        }
        delete state.aiAircraft[aircraftId];
      });

      for (const [id, { netProfit, passengers, revenue, costs, gameDay, recoverRep = false }] of Object.entries(batch.aiStatsUpdates)) {
        const airline = state.aiAirlines[id];
        if (!airline) continue;
        airline.cashUSD += netProfit;
        airline.totalPassengersAllTime += passengers;
        airline.lastDailyProfit = netProfit;
        airline.isInsolvent = airline.cashUSD < -50_000_000;
        airline.canBeTakenOver = airline.cashUSD < 0 && Math.abs(airline.cashUSD) > 20_000_000;
        airline.dailyStats.push({ gameDay, revenue, costs, profit: netProfit, passengers, cashEnd: airline.cashUSD });
        if (airline.dailyStats.length > 365) airline.dailyStats.shift();
        if (recoverRep && !airline.isInsolvent && airline.reputationScore < 100) {
          airline.reputationScore = Math.min(100, airline.reputationScore + 0.3);
        }
      }

      batch.dividendPayments.forEach(({ payerAirlineId, receiverOwnerId, amount }) => {
        if (state.aiAirlines[payerAirlineId]) state.aiAirlines[payerAirlineId].cashUSD -= amount;
        if (receiverOwnerId === 'player') {
          if (state.airlines.player) state.airlines.player.cashUSD += amount;
        } else if (state.aiAirlines[receiverOwnerId]) {
          state.aiAirlines[receiverOwnerId].cashUSD += amount;
        }
      });

      state.airportDailyPax = batch.airportDailyPax;
      batch.newspaperArticles.forEach(article => {
        state.newspaperQueue.push(article);
        if (state.newspaperQueue.length > 8) state.newspaperQueue.shift();
      });
      batch.newsItems.forEach(item => addNewsItemToState(state, item));
    }),
});
