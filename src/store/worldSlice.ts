import type { StateCreator } from 'zustand';
import type { Airport, Airline, Aircraft, Route } from '@/types';
import type { NewsTickerItem } from './uiSlice';
import { AIRPORTS } from '@/data/airports';
import { MAINTENANCE_TIERS, computeMaintenanceCost, getMaintenanceAgeMultiplier } from '@/utils/constants';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import type { MaintenanceTier } from '@/types/aircraft';
import { rawCompanyValue } from '@/engine/valuation';
import type { GameStore } from './index';

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
  removeAIAirline: (id: string) => void;
  addAIAirline: (airline: Airline) => void;
  addAIAircraft: (aircraft: Aircraft) => void;
  updateAIRoute: (routeId: string, changes: Partial<Route>) => void;
  aiAcquireAirline: (buyerId: string, targetId: string, cost: number) => void;
  setShareholding: (targetId: string, ownerId: string, newPercent: number) => void;
  sellAIShares: (sellerId: string, targetId: string, percent: number) => void;
  applyAIDividend: (airlineId: string, amount: number) => void;
  payDividend: (payerAirlineId: string, receiverOwnerId: string, amount: number) => void;
  ignoreAIGrounding: (aircraftId: string) => void;
  triggerAICrash: (aircraftId: string) => void;
}

function createAirportMap(): Record<string, Airport> {
  const airports: Record<string, Airport> = {};
  AIRPORTS.forEach(ap => { airports[ap.iata] = { ...ap }; });
  return airports;
}

export const createWorldSlice: StateCreator<GameStore, [['zustand/immer', never]], [], WorldSlice> = (set) => ({
  airports: createAirportMap(),
  aiAirlines: {},
  aiAircraft: {},
  aiRoutes: {},
  globalFuelPrice: 0.82,
  newsTicker: [{ id: 'welcome', text: 'Welcome to Mighty Airline Empire! Build your airline from the ground up.' }],
  totalMarketPAX: 0,
  airportDailyPax: {},

  setAirportDailyPax: (pax) =>
    set((state) => { state.airportDailyPax = pax; }),

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

  batchUpdateAIRoutes: (updates) =>
    set((state) => {
      for (const [routeId, changes] of Object.entries(updates)) {
        if (state.aiRoutes[routeId]) Object.assign(state.aiRoutes[routeId], changes);
      }
    }),

  batchUpdateAIAircraft: (updates) =>
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
    }),

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
});
