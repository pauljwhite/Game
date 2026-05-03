import type { StateCreator } from 'zustand';
import type { Airline, Aircraft, Route, AircraftType } from '@/types';
import type { MaintenanceTier } from '@/types/aircraft';
import { v4 as uuid } from 'uuid';
import { haversineKm } from '@/utils/geo';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { computeMaintenanceCost, MAINTENANCE_TIERS } from '@/utils/constants';
import { computeAircraftValue, calculateBuyoutPrice, rawCompanyValue, calculateSharePrice } from '@/engine/valuation';
import type { GameStore } from './index';

export interface RouteConfig {
  originIata: string;
  destinationIata: string;
  aircraftId: string | null;
  flightsPerWeek: number;
  priceEconomy: number;
  priceBusiness: number;
}

export interface PlayerSlice {
  playerAirlineId: string;
  airlines: Record<string, Airline>;
  aircraft: Record<string, Aircraft>;
  routes: Record<string, Route>;

  initPlayer: (settings: { name: string; color: string; emoji: string; startingCash: number; gameDay: number }) => void;
  buyAircraft: (typeId: string, aircraftType: AircraftType, gameDay: number) => string | null;
  sellAircraft: (aircraftId: string) => void;
  createRoute: (config: RouteConfig, airports: Record<string, { lat: number; lon: number }>, gameDay: number) => string | null;
  updateRoute: (routeId: string, changes: Partial<Route>) => void;
  deleteRoute: (routeId: string) => void;
  designateHub: (iata: string) => void;
  removeHub: (iata: string) => void;
  assignAircraftToRoute: (aircraftId: string, routeId: string | null) => void;
  applyDailyPnL: (airlineId: string, netProfit: number, passengers: number, snapshot: { revenue: number; costs: number }) => void;
  takeoverAirline: (targetAirlineId: string, aiAirlines: Record<string, Airline>, aiRoutes: Record<string, Route>, aiAircraft: Record<string, Aircraft>) => void;
  updateRouteStats: (routeId: string, stats: Partial<Route>) => void;
  updateAircraftCondition: (aircraftId: string, conditionDelta: number, hoursOwed: number) => void;
  groundAircraft: (aircraftId: string, reason?: string) => void;
  startMaintenance: (aircraftId: string, gameDay: number, tier: MaintenanceTier) => void;
  completeMaintenance: (aircraftId: string) => void;
  setAutoMaintenance: (aircraftId: string, enabled: boolean, threshold: number, tier: MaintenanceTier) => void;
  triggerCrash: (aircraftId: string) => void;
  applyReputationHit: (airlineId: string, delta: number) => void;
  recoverReputation: (airlineId: string) => void;
  setPRCampaign: (airlineId: string) => void;
  rebrandAirline: (newName: string | null, newColor: string | null, cost: number) => void;
  buyShares: (targetId: string, percent: number, source: 'market' | string) => void;
  applyDividend: (amount: number) => void;
}

const PLAYER_ID = 'player';

export const createPlayerSlice: StateCreator<GameStore, [['zustand/immer', never]], [], PlayerSlice> = (set, get) => ({
  playerAirlineId: PLAYER_ID,
  airlines: {},
  aircraft: {},
  routes: {},

  initPlayer: ({ name, color, emoji, startingCash, gameDay }) =>
    set((state) => {
      const airline: Airline = {
        id: PLAYER_ID,
        name,
        iataPrefix: name.substring(0, 2).toUpperCase(),
        isPlayer: true,
        color,
        logoEmoji: emoji,
        cashUSD: startingCash,
        totalDebt: 0,
        hubIatas: [],
        fleetIds: [],
        routeIds: [],
        personality: 'balanced',
        foundedGameDay: gameDay,
        isInsolvent: false,
        canBeTakenOver: false,
        marketSharePercent: 0,
        reputationScore: 70,
        totalPassengersAllTime: 0,
        dailyStats: [],
        crashPenaltyDaysLeft: 0,
        shareholders: {},
        lastDailyProfit: 0,
      };
      state.airlines[PLAYER_ID] = airline;
    }),

  buyAircraft: (typeId, aircraftType, gameDay) => {
    const airline = get().airlines[PLAYER_ID];
    if (!airline || airline.cashUSD < aircraftType.purchasePrice) return null;
    const id = uuid();
    set((state) => {
      const ac: Aircraft = {
        id, typeId, name: `${aircraftType.model} #${id.slice(0, 4).toUpperCase()}`,
        airlineId: PLAYER_ID,
        purchasedGameDay: gameDay, totalFlightHours: 0,
        condition: 100, maintenanceHoursOwed: 0, isGrounded: false,
        lastMaintenanceGameDay: gameDay, crashRisk: 0,
        assignedRouteId: null, status: 'idle',
        currentLat: 0, currentLon: 0, flightProgress: 0,
        activeMaintTier: null,
        autoMaintenanceEnabled: false,
        autoMaintenanceThreshold: 40,
        autoMaintenanceTier: 'standard' as MaintenanceTier,
      };
      state.aircraft[id] = ac;
      state.airlines[PLAYER_ID].fleetIds.push(id);
      state.airlines[PLAYER_ID].cashUSD -= aircraftType.purchasePrice;
    });
    return id;
  },

  sellAircraft: (aircraftId) =>
    set((state) => {
      const ac = state.aircraft[aircraftId];
      if (!ac || ac.airlineId !== PLAYER_ID) return;
      // Remove from route
      if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
        state.routes[ac.assignedRouteId].aircraftId = null;
        state.routes[ac.assignedRouteId].isActive = false;
      }
      const aircraftType = AIRCRAFT_TYPES.find(type => type.id === ac.typeId);
      const salePrice = aircraftType ? computeAircraftValue(ac, aircraftType, state.gameDay) : 0;
      state.airlines[PLAYER_ID].cashUSD += salePrice;
      state.airlines[PLAYER_ID].fleetIds = state.airlines[PLAYER_ID].fleetIds.filter(id => id !== aircraftId);
      delete state.aircraft[aircraftId];
    }),

  createRoute: (config, airports, gameDay) => {
    const origin = airports[config.originIata];
    const dest = airports[config.destinationIata];
    if (!origin || !dest) return null;
    const id = uuid();
    const distanceKm = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
    set((state) => {
      const route: Route = {
        id, airlineId: PLAYER_ID,
        originIata: config.originIata, destinationIata: config.destinationIata,
        aircraftId: config.aircraftId, flightsPerWeek: config.flightsPerWeek,
        priceEconomy: config.priceEconomy, priceBusiness: config.priceBusiness,
        isActive: config.aircraftId !== null,
        createdGameDay: gameDay, distanceKm,
        flightDurationHours: 0,
        dailyPassengers: 0, dailyRevenue: 0, dailyCost: 0, dailyProfit: 0,
        loadFactorEconomy: 0, loadFactorBusiness: 0,
      };
      state.routes[id] = route;
      state.airlines[PLAYER_ID].routeIds.push(id);
      if (config.aircraftId && state.aircraft[config.aircraftId]) {
        state.aircraft[config.aircraftId].assignedRouteId = id;
        state.aircraft[config.aircraftId].status = 'flying';
      }
    });
    return id;
  },

  updateRoute: (routeId, changes) =>
    set((state) => { Object.assign(state.routes[routeId], changes); }),

  deleteRoute: (routeId) =>
    set((state) => {
      const route = state.routes[routeId];
      if (!route) return;
      if (route.aircraftId && state.aircraft[route.aircraftId]) {
        state.aircraft[route.aircraftId].assignedRouteId = null;
        state.aircraft[route.aircraftId].status = 'idle';
      }
      state.airlines[PLAYER_ID].routeIds = state.airlines[PLAYER_ID].routeIds.filter(id => id !== routeId);
      delete state.routes[routeId];
    }),

  designateHub: (iata) =>
    set((state) => {
      if (!state.airlines[PLAYER_ID].hubIatas.includes(iata)) {
        state.airlines[PLAYER_ID].hubIatas.push(iata);
      }
      if (state.airports[iata]) state.airports[iata].isHub = true;
    }),

  removeHub: (iata) =>
    set((state) => {
      state.airlines[PLAYER_ID].hubIatas = state.airlines[PLAYER_ID].hubIatas.filter(h => h !== iata);
      if (state.airports[iata]) state.airports[iata].isHub = false;
    }),

  assignAircraftToRoute: (aircraftId, routeId) =>
    set((state) => {
      const ac = state.aircraft[aircraftId];
      if (!ac) return;
      if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
        state.routes[ac.assignedRouteId].aircraftId = null;
        state.routes[ac.assignedRouteId].isActive = false;
      }
      ac.assignedRouteId = routeId;
      ac.status = routeId ? 'flying' : 'idle';
      if (routeId && state.routes[routeId]) {
        state.routes[routeId].aircraftId = aircraftId;
        // Only activate if the aircraft is not grounded; completeMaintenance activates it when clear
        state.routes[routeId].isActive = !ac.isGrounded;
      }
    }),

  applyDailyPnL: (airlineId, netProfit, passengers, snapshot) =>
    set((state) => {
      const airline = state.airlines[airlineId];
      if (!airline) return;
      airline.cashUSD += netProfit;
      airline.totalPassengersAllTime += passengers;
      airline.dailyStats.push({
        gameDay: state.gameDay,
        revenue: snapshot.revenue,
        costs: snapshot.costs,
        profit: netProfit,
        passengers,
        cashEnd: airline.cashUSD,
      });
      if (airline.dailyStats.length > 365) airline.dailyStats.shift();
      if (airline.cashUSD < -100_000_000) airline.isInsolvent = true;
      airline.canBeTakenOver = airline.cashUSD < 0 && Math.abs(airline.cashUSD) > airline.totalDebt * 2;
    }),

  takeoverAirline: (targetAirlineId, aiAirlines, aiRoutes, aiAircraft) =>
    set((state) => {
      const target = aiAirlines[targetAirlineId];
      if (!target) return;
      const playerStake = (target.shareholders ?? {})['player'] ?? 0;
      if (!target.isInsolvent && playerStake < 50) return;
      const { totalPrice } = calculateBuyoutPrice(target, aiAircraft, aiRoutes);
      const ownedValue = rawCompanyValue(target, aiAircraft, aiRoutes) * (playerStake / 100);
      const adjustedPrice = Math.max(0, totalPrice - ownedValue);
      state.airlines[PLAYER_ID].cashUSD -= adjustedPrice;

      // Transfer fleet — reset grounding and initialise player-only fields
      target.fleetIds.forEach(id => {
        const ac = aiAircraft[id];
        if (!ac) return;
        const hasRoute = !!ac.assignedRouteId;
        state.aircraft[id] = {
          ...ac,
          airlineId: PLAYER_ID,
          isGrounded: false,
          status: hasRoute ? 'flying' : 'idle',
          // Initialise fields that AI aircraft never set
          currentLat: ac.currentLat ?? 0,
          currentLon: ac.currentLon ?? 0,
          flightProgress: ac.flightProgress ?? 0,
          activeMaintTier: ac.activeMaintTier ?? null,
          autoMaintenanceEnabled: false,
          autoMaintenanceThreshold: 40,
          autoMaintenanceTier: (ac.autoMaintenanceTier as MaintenanceTier) ?? 'standard',
        };
        state.airlines[PLAYER_ID].fleetIds.push(id);
      });

      // Transfer routes — force active so economics runs on next tick
      target.routeIds.forEach(id => {
        const route = aiRoutes[id];
        if (!route) return;
        const hasAircraft = !!route.aircraftId && !!aiAircraft[route.aircraftId];
        state.routes[id] = {
          ...route,
          airlineId: PLAYER_ID,
          isActive: hasAircraft,
          // Reset stale stats so first player tick sets fresh values
          dailyRevenue: 0,
          dailyCost: 0,
          dailyProfit: 0,
          loadFactorEconomy: 0,
          loadFactorBusiness: 0,
          dailyPassengers: 0,
        };
        state.airlines[PLAYER_ID].routeIds.push(id);
      });
    }),

  updateRouteStats: (routeId, stats) =>
    set((state) => { Object.assign(state.routes[routeId], stats); }),

  updateAircraftCondition: (aircraftId, conditionDelta, hoursOwed) =>
    set((state) => {
      const ac = state.aircraft[aircraftId];
      if (!ac) return;
      ac.condition = Math.max(0, Math.min(100, ac.condition + conditionDelta));
      ac.maintenanceHoursOwed += hoursOwed;
      ac.totalFlightHours += hoursOwed;
      const baseCrashRisk = Math.max(0, (40 - ac.condition) / 40) ** 2;
      const agePenalty = Math.max(0, ((state.gameDay - ac.purchasedGameDay) / 365 - 15) * 0.01);
      ac.crashRisk = Math.min(0.95, baseCrashRisk + agePenalty);
      if (ac.condition < 20 && !ac.isGrounded) {
        ac.isGrounded = true;
        ac.groundedReason = `Critical condition (${ac.condition.toFixed(0)}%) — requires maintenance`;
        if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
          state.routes[ac.assignedRouteId].isActive = false;
        }
      }
    }),

  groundAircraft: (aircraftId, reason) =>
    set((state) => {
      const ac = state.aircraft[aircraftId];
      if (!ac) return;
      ac.isGrounded = true;
      if (reason) ac.groundedReason = reason;
      if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
        state.routes[ac.assignedRouteId].isActive = false;
      }
    }),

  startMaintenance: (aircraftId, gameDay, tier) =>
    set((state) => {
      const ac = state.aircraft[aircraftId];
      if (!ac) return;
      ac.status = 'maintenance';
      ac.isGrounded = true;
      ac.lastMaintenanceGameDay = gameDay;
      ac.activeMaintTier = tier;
      const aircraftType = AIRCRAFT_TYPES.find(type => type.id === ac.typeId);
      const cost = aircraftType
        ? computeMaintenanceCost(tier, ac.maintenanceHoursOwed, aircraftType.maintenanceCostPerHourUSD)
        : 0;
      state.airlines[PLAYER_ID].cashUSD -= cost;
      if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
        state.routes[ac.assignedRouteId].isActive = false;
      }
    }),

  completeMaintenance: (aircraftId) =>
    set((state) => {
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
      if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
        state.routes[ac.assignedRouteId].isActive = true;
      }
      // Reputation boost for proactive maintenance
      const repBoost = tier === 'full' ? 3 : tier === 'standard' ? 1.5 : 0.5;
      const airline = state.airlines[PLAYER_ID];
      if (airline) airline.reputationScore = Math.min(100, airline.reputationScore + repBoost);
    }),

  setAutoMaintenance: (aircraftId, enabled, threshold, tier) =>
    set((state) => {
      const ac = state.aircraft[aircraftId];
      if (!ac) return;
      ac.autoMaintenanceEnabled = enabled;
      ac.autoMaintenanceThreshold = threshold;
      ac.autoMaintenanceTier = tier;
    }),

  triggerCrash: (aircraftId) =>
    set((state) => {
      const ac = state.aircraft[aircraftId];
      if (!ac) return;
      ac.status = 'crashed';
      if (ac.assignedRouteId && state.routes[ac.assignedRouteId]) {
        state.routes[ac.assignedRouteId].aircraftId = null;
        state.routes[ac.assignedRouteId].isActive = false;
      }
      state.airlines[PLAYER_ID].fleetIds = state.airlines[PLAYER_ID].fleetIds.filter(id => id !== aircraftId);
      state.airlines[PLAYER_ID].cashUSD -= 50_000_000;
      state.airlines[PLAYER_ID].reputationScore = Math.max(0, state.airlines[PLAYER_ID].reputationScore - 25);
      state.airlines[PLAYER_ID].crashPenaltyDaysLeft = 30;
      delete state.aircraft[aircraftId];
    }),

  applyReputationHit: (airlineId, delta) =>
    set((state) => {
      if (state.airlines[airlineId]) {
        state.airlines[airlineId].reputationScore = Math.max(0, Math.min(100, state.airlines[airlineId].reputationScore + delta));
      }
    }),

  recoverReputation: (airlineId) =>
    set((state) => {
      const airline = state.airlines[airlineId];
      if (!airline) return;
      if (airline.reputationScore < 100) airline.reputationScore = Math.min(100, airline.reputationScore + 0.3);
      if (airline.crashPenaltyDaysLeft > 0) airline.crashPenaltyDaysLeft--;
    }),

  setPRCampaign: (airlineId) =>
    set((state) => {
      const airline = state.airlines[airlineId];
      if (!airline || airline.cashUSD < 5_000_000) return;
      airline.cashUSD -= 5_000_000;
      airline.reputationScore = Math.min(100, airline.reputationScore + 10);
    }),

  rebrandAirline: (newName, newColor, cost) =>
    set((state) => {
      const airline = state.airlines[PLAYER_ID];
      if (!airline || airline.cashUSD < cost) return;
      airline.cashUSD -= cost;
      if (newName) airline.name = newName;
      if (newColor) airline.color = newColor;
    }),

  buyShares: (targetId, percent, source) => {
    const state = get();
    const target = state.aiAirlines[targetId];
    const player = state.airlines[PLAYER_ID];
    if (!target || !player) return;

    const currentPlayerPct = (target.shareholders ?? {})[PLAYER_ID] ?? 0;
    const isSecondary = source !== 'market';

    const cost = calculateSharePrice(
      percent, currentPlayerPct, target, state.aiAircraft, state.aiRoutes, isSecondary,
    );

    if (player.cashUSD < cost) return;

    if (isSecondary) {
      const sellerPct = (target.shareholders ?? {})[source] ?? 0;
      if (sellerPct < percent) return;
    } else {
      const ownedTotal = Object.values(target.shareholders ?? {}).reduce((s, v) => s + v, 0);
      if (100 - ownedTotal < percent) return;
    }

    set((s) => {
      const t = s.aiAirlines[targetId];
      const p = s.airlines[PLAYER_ID];
      if (!t || !p) return;
      t.shareholders ??= {};
      t.shareholders[PLAYER_ID] = (t.shareholders[PLAYER_ID] ?? 0) + percent;
      if (isSecondary) {
        const prev = t.shareholders[source] ?? 0;
        const remaining = prev - percent;
        if (remaining <= 0) delete t.shareholders[source];
        else t.shareholders[source] = remaining;
      }
      p.cashUSD -= cost;
    });

    get().pushNewsItem(
      `You acquired ${percent}% stake in ${target.name} for ${
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cost)
      }.`,
    );
  },

  applyDividend: (amount) =>
    set((state) => {
      if (state.airlines[PLAYER_ID]) {
        state.airlines[PLAYER_ID].cashUSD += amount;
      }
    }),
});
