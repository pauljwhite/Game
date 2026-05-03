import type { StateCreator } from 'zustand';
import type { Airport, Airline, Aircraft, Route } from '@/types';
import { AIRPORTS } from '@/data/airports';
import type { GameStore } from './index';

export interface WorldSlice {
  airports: Record<string, Airport>;
  aiAirlines: Record<string, Airline>;
  aiAircraft: Record<string, Aircraft>;
  aiRoutes: Record<string, Route>;
  globalFuelPrice: number;
  newsTicker: string[];
  totalMarketPAX: number;

  initWorld: () => void;
  setAIAirlines: (airlines: Record<string, Airline>, aircraft: Record<string, Aircraft>, routes: Record<string, Route>) => void;
  updateAIAirline: (id: string, changes: Partial<Airline>) => void;
  addAIRoute: (route: Route) => void;
  removeAIRoute: (routeId: string) => void;
  pushNewsItem: (text: string) => void;
  setGlobalFuelPrice: (price: number) => void;
  updateTotalMarketPAX: (pax: number) => void;
  setAirportHub: (iata: string, isHub: boolean) => void;
  setAirportClosure: (iata: string, untilGameDay: number, reason: string) => void;
  updateAIAircraftCondition: (aircraftId: string, conditionDelta: number, hoursOwed: number) => void;
  updateAIAirlineStats: (id: string, netProfit: number, passengers: number) => void;
  removeAIAirline: (id: string) => void;
  addAIAirline: (airline: Airline) => void;
  addAIAircraft: (aircraft: Aircraft) => void;
  updateAIRoute: (routeId: string, changes: Partial<Route>) => void;
  aiAcquireAirline: (buyerId: string, targetId: string, cost: number) => void;
  setShareholding: (targetId: string, ownerId: string, newPercent: number) => void;
  applyAIDividend: (airlineId: string, amount: number) => void;
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
  newsTicker: ['Welcome to Mighty Airline Empire! Build your airline from the ground up.'],
  totalMarketPAX: 0,

  initWorld: () =>
    set((state) => {
      state.airports = createAirportMap();
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
      if (state.aiAirlines[route.airlineId]) {
        state.aiAirlines[route.airlineId].routeIds = state.aiAirlines[route.airlineId].routeIds.filter(id => id !== routeId);
      }
      delete state.aiRoutes[routeId];
    }),

  pushNewsItem: (text) =>
    set((state) => {
      state.newsTicker.unshift(text);
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
      if (ac.condition < 20) {
        ac.isGrounded = true;
        if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
          state.aiRoutes[ac.assignedRouteId].isActive = false;
        }
        ac.condition = Math.min(100, ac.condition + 40);
        ac.maintenanceHoursOwed = 0;
        ac.isGrounded = false;
        if (ac.assignedRouteId && state.aiRoutes[ac.assignedRouteId]) {
          state.aiRoutes[ac.assignedRouteId].isActive = true;
        }
      }
    }),

  updateAIAirlineStats: (id, netProfit, passengers) =>
    set((state) => {
      const airline = state.aiAirlines[id];
      if (!airline) return;
      airline.cashUSD += netProfit;
      airline.totalPassengersAllTime += passengers;
      airline.lastDailyProfit = netProfit;
      airline.isInsolvent = airline.cashUSD < -50_000_000;
      airline.canBeTakenOver = airline.cashUSD < 0 && Math.abs(airline.cashUSD) > 20_000_000;
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

  applyAIDividend: (airlineId, amount) =>
    set((state) => {
      if (state.aiAirlines[airlineId]) {
        state.aiAirlines[airlineId].cashUSD += amount;
      }
    }),
});
