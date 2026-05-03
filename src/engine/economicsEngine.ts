import type { Route, Aircraft, AircraftType, Airport } from '@/types';
import {
  HUB_COST_DISCOUNT, HUB_DEMAND_BONUS,
  HUB_ANNUAL_FEE_USD, CREW_COST_PER_FLIGHT_HOUR_USD,
  REPUTATION_DEMAND_FACTOR, CRASH_DEMAND_PENALTY_PCT, DAY_MS,
  MAINTENANCE_TIERS,
} from '@/utils/constants';
import { getBaselineDailyPax, getPlayerMarketShare } from './demandModel';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';

export function computeFlightCost(
  route: Route,
  aircraft: Aircraft,
  aircraftType: AircraftType,
  origin: Airport,
  dest: Airport,
  fuelPriceUSDPerLiter: number,
): { fuelCost: number; maintenanceCost: number; airportFees: number; crewCost: number; totalCost: number; flightDurationHours: number } {
  const flightDurationHours = route.distanceKm / aircraftType.cruiseSpeedKmh;
  const fuelLiters = (route.distanceKm / 100) * aircraftType.fuelBurnLPer100Km;
  const fuelCost = fuelLiters * fuelPriceUSDPerLiter;
  const conditionFactor = 1 + (100 - aircraft.condition) / 200;
  const maintenanceCost = aircraftType.maintenanceCostPerHourUSD * flightDurationHours * conditionFactor;
  const crewCost = CREW_COST_PER_FLIGHT_HOUR_USD * flightDurationHours;
  const hubDiscount = (origin.isHub || dest.isHub) ? (1 - HUB_COST_DISCOUNT) : 1;
  const airportFees = (origin.landingFee + dest.landingFee) * hubDiscount;
  const totalCost = fuelCost + maintenanceCost + crewCost + airportFees;
  return { fuelCost, maintenanceCost, airportFees, crewCost, totalCost, flightDurationHours };
}

export function runDailyTick(store: ReturnType<typeof import('@/store/index')['useGameStore']['getState']>): void {
  const state = store;
  const {
    gameDay, aircraft, routes, airlines, airports, aiAirlines, aiRoutes, aiAircraft,
    globalFuelPrice,
  } = state;
  const { aircraft: _ac, routes: _r, ...rest } = state;
  void rest;

  const allRoutes = [...Object.values(routes), ...Object.values(aiRoutes)];
  const allAirlines = [...Object.values(airlines), ...Object.values(aiAirlines)];

  // Player economics
  const playerAirline = airlines['player'];
  if (playerAirline && !playerAirline.isInsolvent) {
    Object.values(aircraft).forEach(ac => {
      if (ac.airlineId === 'player' && ac.status === 'maintenance') {
        const tier = ac.activeMaintTier ?? 'standard';
        const durationDays = MAINTENANCE_TIERS[tier].durationDays;
        if (gameDay - ac.lastMaintenanceGameDay >= durationDays) {
          store.completeMaintenance(ac.id);
          store.pushNewsItem(`${ac.name} has completed ${MAINTENANCE_TIERS[tier].label.toLowerCase()} maintenance and returned to service.`);
        }
      }
      // Auto-maintenance trigger
      if (
        ac.airlineId === 'player' &&
        ac.status !== 'maintenance' && ac.status !== 'crashed' &&
        !ac.isGrounded &&
        ac.autoMaintenanceEnabled &&
        ac.condition <= ac.autoMaintenanceThreshold
      ) {
        store.startMaintenance(ac.id, gameDay, ac.autoMaintenanceTier ?? 'standard');
        store.pushNewsItem(`Auto-maintenance triggered for ${ac.name} (condition ${ac.condition.toFixed(0)}%).`);
      }
    });

    let totalRevenue = 0;
    let totalFuelCost = 0;
    let totalMaintenanceCost = 0;
    let totalAirportFees = 0;
    let totalCrewCost = 0;
    let totalPassengers = 0;

    const playerRouteIds = playerAirline.routeIds;
    playerRouteIds.forEach(routeId => {
      const route = routes[routeId];
      if (!route || !route.isActive || !route.aircraftId) return;
      const ac = aircraft[route.aircraftId];
      if (!ac || ac.isGrounded || ac.status === 'maintenance') return;

      const origin = airports[route.originIata];
      const dest = airports[route.destinationIata];
      if (!origin || !dest) return;

      const aircraftType: AircraftType | undefined = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
      if (!aircraftType) return;

      const flightCosts = computeFlightCost(route, ac, aircraftType, origin, dest, globalFuelPrice);
      const flightsPerDay = route.flightsPerWeek / 7;

      // Demand calculation — reference price drives solo-route elasticity
      const totalSeats = aircraftType.seatsEconomy + aircraftType.seatsBusiness;
      const referencePrice = totalSeats > 0 ? Math.round(flightCosts.totalCost / totalSeats * 1.4) : 200;
      const baselinePax = getBaselineDailyPax(origin, dest) * (origin.isHub || dest.isHub ? HUB_DEMAND_BONUS : 1);
      const repMod = 1 + (playerAirline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR;
      const crashPenalty = playerAirline.crashPenaltyDaysLeft > 0 ? (1 - CRASH_DEMAND_PENALTY_PCT) : 1;
      const marketShare = getPlayerMarketShare(route.originIata, route.destinationIata, route.priceEconomy, allAirlines, allRoutes, referencePrice);
      const dailyPax = Math.floor(baselinePax * marketShare * repMod * crashPenalty);

      const ecoCapacity = aircraftType.seatsEconomy * flightsPerDay;
      const bizCapacity = aircraftType.seatsBusiness * flightsPerDay;
      const bizSplit = Math.min(0.25, Math.max(0.05, 0.10 * Math.sqrt(route.priceBusiness / (route.priceEconomy * 6 + 1))));
      const ecoPax = Math.min(ecoCapacity, Math.floor(dailyPax * (1 - bizSplit)));
      const bizPax = Math.min(bizCapacity, Math.floor(dailyPax * bizSplit));

      const dailyRevenue = ecoPax * route.priceEconomy + bizPax * route.priceBusiness;
      const dailyCost = flightCosts.totalCost * flightsPerDay;
      const dailyProfit = dailyRevenue - dailyCost;

      const lfe = ecoCapacity > 0 ? ecoPax / ecoCapacity : 0;
      const lfb = bizCapacity > 0 ? bizPax / bizCapacity : 0;

      store.updateRouteStats(routeId, {
        dailyRevenue, dailyCost, dailyProfit,
        loadFactorEconomy: lfe, loadFactorBusiness: lfb,
        dailyPassengers: ecoPax + bizPax,
        flightDurationHours: flightCosts.flightDurationHours,
      });

      totalRevenue += dailyRevenue;
      totalFuelCost += flightCosts.fuelCost * flightsPerDay;
      totalMaintenanceCost += flightCosts.maintenanceCost * flightsPerDay;
      totalAirportFees += flightCosts.airportFees * flightsPerDay;
      totalCrewCost += flightCosts.crewCost * flightsPerDay;
      totalPassengers += ecoPax + bizPax;

      // Condition degradation
      const conditionLoss = flightsPerDay * flightCosts.flightDurationHours * 0.08;
      store.updateAircraftCondition(ac.id, -conditionLoss, flightsPerDay * flightCosts.flightDurationHours);

      // Crash check
      if (ac.crashRisk > 0.001 && Math.random() < ac.crashRisk * flightsPerDay * 0.0008) {
        store.triggerCrash(ac.id);
        store.pushNewsItem(`BREAKING: ${playerAirline.name} ${aircraftType.model} crashes on ${route.originIata}->${route.destinationIata} route!`);
      }
    });

    const hubFees = (playerAirline.hubIatas.length * HUB_ANNUAL_FEE_USD) / 365;
    const totalCost = totalFuelCost + totalMaintenanceCost + totalAirportFees + totalCrewCost + hubFees;
    const netProfit = totalRevenue - totalCost;

    store.applyDailyPnL('player', netProfit, totalPassengers, { revenue: totalRevenue, costs: totalCost });
    store.recoverReputation('player');
  }

  // AI economics (same model as player, capped by seat capacity)
  Object.values(aiAirlines).forEach(aiAirline => {
    if (aiAirline.isInsolvent) return;
    let aiRevenue = 0;
    let aiCost = 0;
    let aiPax = 0;

    aiAirline.routeIds.forEach(routeId => {
      const route = aiRoutes[routeId];
      if (!route || !route.isActive || !route.aircraftId) return;
      const ac = aiAircraft[route.aircraftId];
      if (!ac || ac.isGrounded) return;
      const origin = airports[route.originIata];
      const dest = airports[route.destinationIata];
      if (!origin || !dest) return;

      const aircraftType: AircraftType | undefined = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
      if (!aircraftType) return;

      const flightCosts = computeFlightCost(route, ac, aircraftType, origin, dest, globalFuelPrice);
      const flightsPerDay = route.flightsPerWeek / 7;

      // Reference price for solo-route elasticity (same formula as player)
      const totalSeats = aircraftType.seatsEconomy + aircraftType.seatsBusiness;
      const referencePrice = totalSeats > 0 ? Math.round(flightCosts.totalCost / totalSeats * 1.4) : 200;

      const baselinePax = getBaselineDailyPax(origin, dest);
      const marketShare = getPlayerMarketShare(
        route.originIata, route.destinationIata,
        route.priceEconomy, allAirlines, allRoutes, referencePrice,
      );
      const demandPax = Math.floor(baselinePax * marketShare);

      // Cap to actual seat capacity
      const ecoCapacity = Math.floor(aircraftType.seatsEconomy * flightsPerDay);
      const dailyPax = Math.min(demandPax, ecoCapacity);
      const loadFactor = ecoCapacity > 0 ? dailyPax / ecoCapacity : 0;

      const dailyRevenue = dailyPax * route.priceEconomy;
      const dailyCost = flightCosts.totalCost * flightsPerDay;
      const dailyProfit = dailyRevenue - dailyCost;

      aiRevenue += dailyRevenue;
      aiCost += dailyCost;
      aiPax += dailyPax;

      store.updateAIRoute(routeId, {
        dailyRevenue, dailyCost, dailyProfit,
        loadFactorEconomy: loadFactor,
        dailyPassengers: dailyPax,
      });

      store.updateAIAircraftCondition(
        ac.id,
        -(flightsPerDay * flightCosts.flightDurationHours * 0.08),
        flightsPerDay * flightCosts.flightDurationHours,
      );
    });

    store.updateAIAirlineStats(aiAirline.id, aiRevenue - aiCost, aiPax);
  });

  // Recalculate market shares
  const totalPax = Object.values(airlines).reduce((s, a) => s + a.totalPassengersAllTime, 0) +
    Object.values(aiAirlines).reduce((s, a) => s + a.totalPassengersAllTime, 0);
  void totalPax;
  void gameDay;
  void allRoutes;
  void _ac;
  void _r;
}

export function msToGameDate(gameTimeMs: number): Date {
  const epoch = new Date(1960, 0, 1).getTime();
  return new Date(epoch + gameTimeMs);
}

export function gameDayFromMs(gameTimeMs: number): number {
  return Math.floor(gameTimeMs / DAY_MS);
}
