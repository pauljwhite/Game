import type { Route, Aircraft, AircraftType, Airport } from '@/types';
import {
  HUB_COST_DISCOUNT, HUB_DEMAND_BONUS,
  HUB_ANNUAL_FEE_USD, CREW_COST_PER_FLIGHT_HOUR_USD,
  REPUTATION_DEMAND_FACTOR, REP_PRICE_FACTOR, PRICE_ELASTICITY, CRASH_DEMAND_PENALTY_PCT, DAY_MS,
  MAINTENANCE_TIERS,
} from '@/utils/constants';
import { getBaselineDailyPax, getCompetitivenessScore, conditionDemandMod, getAirportCapacity, airportSaturationMod } from './demandModel';
import { runRandomEventsTick } from './randomEvents';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { formatCurrency } from '@/utils/format';
import { canAirportHandleAircraft } from '@/utils/runway';

const AIRCRAFT_TYPE_BY_ID = Object.fromEntries(
  AIRCRAFT_TYPES.map(type => [type.id, type]),
);

function repPricePremium(reputationScore: number): number {
  return 1 + (reputationScore - 50) * REP_PRICE_FACTOR;
}

function routePairKey(origin: string, dest: string): string {
  return origin < dest ? `${origin}:${dest}` : `${dest}:${origin}`;
}

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
  const airlineById = new Map(allAirlines.map(airline => [airline.id, airline]));
  const activeRoutesByPair = new Map<string, Route[]>();

  allRoutes.forEach(route => {
    if (!route.isActive) return;
    const key = routePairKey(route.originIata, route.destinationIata);
    const pairRoutes = activeRoutesByPair.get(key);
    if (pairRoutes) pairRoutes.push(route);
    else activeRoutesByPair.set(key, [route]);
  });

  const getMarketShare = (
    routeOrigin: string,
    routeDest: string,
    price: number,
    referencePrice?: number,
    airlineId = 'player',
    cabin: 'economy' | 'business' = 'economy',
  ): number => {
    const getPrice = (route: Route) => cabin === 'business' ? route.priceBusiness : route.priceEconomy;
    const pairRoutes = activeRoutesByPair.get(routePairKey(routeOrigin, routeDest)) ?? [];
    const routesOnPair = cabin === 'economy' ? pairRoutes : pairRoutes.filter(route => getPrice(route) > 0);
    const airline = airlineById.get(airlineId);
    const premium = airline ? repPricePremium(airline.reputationScore) : 1;
    const effectivePrice = price / premium;

    if (routesOnPair.length === 0) {
      if (referencePrice && referencePrice > 0) {
        if (effectivePrice <= 0) return 5;
        return Math.min(5, Math.pow(effectivePrice / referencePrice, PRICE_ELASTICITY));
      }
      return 1;
    }

    const avgPrice = routesOnPair.reduce((sum, route) => sum + getPrice(route), 0) / routesOnPair.length;
    const ownScore = getCompetitivenessScore(effectivePrice, avgPrice);
    const totalScore = routesOnPair.reduce((sum, route) => {
      const competitor = airlineById.get(route.airlineId);
      const competitorPremium = competitor ? repPricePremium(competitor.reputationScore) : 1;
      return sum + getCompetitivenessScore(getPrice(route) / competitorPremium, avgPrice);
    }, 0);

    return totalScore > 0 ? ownScore / totalScore : 1;
  };

  // Build airport pax totals from last tick's dailyPassengers (used for saturation this tick)
  const prevAirportPax = state.airportDailyPax;
  const currentYear = 1960 + Math.floor(gameDay / 365);
  const pendingAirportPax: Record<string, number> = {};
  const accumPax = (iata: string, pax: number) => {
    pendingAirportPax[iata] = (pendingAirportPax[iata] ?? 0) + pax;
  };
  allRoutes.forEach(r => {
    if (!r.isActive || !r.dailyPassengers) return;
    accumPax(r.originIata, r.dailyPassengers);
    accumPax(r.destinationIata, r.dailyPassengers);
  });

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
      // Auto-maintenance trigger — cooldown: don't re-trigger until after the last maintenance duration
      const autoTier = ac.autoMaintenanceTier ?? 'standard';
      const maintCooldownElapsed = gameDay > ac.lastMaintenanceGameDay + MAINTENANCE_TIERS[autoTier].durationDays;
      const belowThreshold = ac.condition <= ac.autoMaintenanceThreshold;
      const groundedNeedsFix = ac.isGrounded && ac.status !== 'maintenance';
      if (
        ac.airlineId === 'player' &&
        ac.status !== 'maintenance' && ac.status !== 'crashed' &&
        ac.autoMaintenanceEnabled &&
        (belowThreshold || groundedNeedsFix) &&
        maintCooldownElapsed
      ) {
        store.startMaintenance(ac.id, gameDay, ac.autoMaintenanceTier ?? 'standard');
        const reason = groundedNeedsFix
          ? `grounded (${ac.groundedReason ?? 'incident'})`
          : `condition ${ac.condition.toFixed(0)}%`;
        store.pushNewsItem(`Auto-maintenance triggered for ${ac.name} (${reason}).`);
      }
    });

    let totalRevenue = 0;
    let totalFuelCost = 0;
    let totalMaintenanceCost = 0;
    let totalAirportFees = 0;
    let totalCrewCost = 0;
    let totalPassengers = 0;

    const playerRouteUpdates: Record<string, Partial<typeof routes[string]>> = {};
    const playerAcUpdates: Record<string, { conditionDelta: number; hoursOwed: number }> = {};

    const playerRouteIds = playerAirline.routeIds;
    playerRouteIds.forEach(routeId => {
      const route = routes[routeId];
      if (!route || !route.isActive || !route.aircraftId) return;
      const ac = aircraft[route.aircraftId];
      if (!ac || ac.isGrounded || ac.status === 'maintenance') return;

      const origin = airports[route.originIata];
      const dest = airports[route.destinationIata];
      if (!origin || !dest) return;

      // Skip if either airport is closed today
      if (
        (origin.closedUntilGameDay !== undefined && origin.closedUntilGameDay >= gameDay) ||
        (dest.closedUntilGameDay !== undefined && dest.closedUntilGameDay >= gameDay)
      ) return;

      const aircraftType: AircraftType | undefined = AIRCRAFT_TYPE_BY_ID[ac.typeId];
      if (!aircraftType) return;
      if (!canAirportHandleAircraft(origin, aircraftType) || !canAirportHandleAircraft(dest, aircraftType)) return;

      const flightCosts = computeFlightCost(route, ac, aircraftType, origin, dest, globalFuelPrice);
      const flightsPerDay = route.flightsPerWeek / 7;

      // Reference prices: cost-per-seat basis; business at 4× economy
      const totalSeats = aircraftType.seatsEconomy + aircraftType.seatsBusiness;
      const ecoReferencePrice = totalSeats > 0 ? Math.round(flightCosts.totalCost / totalSeats * 1.3) : 200;
      const bizReferencePrice = ecoReferencePrice * 4;

      const originUtil = (prevAirportPax[route.originIata] ?? 0) / getAirportCapacity(origin.size, currentYear);
      const destUtil   = (prevAirportPax[route.destinationIata] ?? 0) / getAirportCapacity(dest.size, currentYear);
      const satMod     = airportSaturationMod(originUtil) * airportSaturationMod(destUtil);
      const baselinePax = getBaselineDailyPax(origin, dest) * (origin.isHub || dest.isHub ? HUB_DEMAND_BONUS : 1) * satMod;
      const repMod = 1 + (playerAirline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR;
      const crashPenalty = playerAirline.crashPenaltyDaysLeft > 0 ? (1 - CRASH_DEMAND_PENALTY_PCT) : 1;
      const condMod = conditionDemandMod(ac.condition);

      // Economy class — independent demand
      const ecoMarketShare = getMarketShare(route.originIata, route.destinationIata, route.priceEconomy, ecoReferencePrice);
      const ecoCapacity = aircraftType.seatsEconomy * flightsPerDay;
      const ecoPax = Math.min(ecoCapacity, Math.floor(baselinePax * 0.90 * ecoMarketShare * repMod * crashPenalty * condMod));

      // Business class — independent demand (10% of route baseline, competes on biz price)
      const bizCapacity = aircraftType.seatsBusiness * flightsPerDay;
      const bizMarketShare = aircraftType.seatsBusiness > 0
        ? getMarketShare(route.originIata, route.destinationIata, route.priceBusiness, bizReferencePrice, 'player', 'business')
        : 0;
      const bizPax = Math.min(bizCapacity, Math.floor(baselinePax * 0.10 * bizMarketShare * repMod * crashPenalty * condMod));

      const dailyRevenue = ecoPax * route.priceEconomy + bizPax * route.priceBusiness;
      const dailyCost = flightCosts.totalCost * flightsPerDay;
      const dailyProfit = dailyRevenue - dailyCost;

      const lfe = ecoCapacity > 0 ? ecoPax / ecoCapacity : 0;
      const lfb = bizCapacity > 0 ? bizPax / bizCapacity : 0;

      playerRouteUpdates[routeId] = {
        dailyRevenue, dailyCost, dailyProfit,
        loadFactorEconomy: lfe, loadFactorBusiness: lfb,
        dailyPassengers: ecoPax + bizPax,
        flightDurationHours: flightCosts.flightDurationHours,
      };

      totalRevenue += dailyRevenue;
      totalFuelCost += flightCosts.fuelCost * flightsPerDay;
      totalMaintenanceCost += flightCosts.maintenanceCost * flightsPerDay;
      totalAirportFees += flightCosts.airportFees * flightsPerDay;
      totalCrewCost += flightCosts.crewCost * flightsPerDay;
      totalPassengers += ecoPax + bizPax;

      // Condition degradation — accumulate, apply in one batch set()
      const conditionLoss = flightsPerDay * flightCosts.flightDurationHours * 0.08;
      playerAcUpdates[ac.id] = { conditionDelta: -conditionLoss, hoursOwed: flightsPerDay * flightCosts.flightDurationHours };

      // Crash check — knownFaultRiskMod drastically raises risk when flying with ignored fault
      const riskMod = ac.knownFaultRiskMod ?? 1;
      if (ac.crashRisk > 0.001 && Math.random() < ac.crashRisk * riskMod * flightsPerDay * 0.0008) {
        store.triggerCrash(ac.id);
        const crashRoute = `${route.originIata}–${route.destinationIata}`;
        store.pushNewsItem(`BREAKING: ${playerAirline.name} ${aircraftType.model} crashes on ${route.originIata}->${route.destinationIata} route!`);
        store.pushNewspaper({
          id: `crash_${store.gameDay}_${ac.id}`,
          headline: `${playerAirline.name} ${aircraftType.model} lost`,
          subheadline: `Aviation authorities launch emergency investigation into accident on the ${crashRoute} corridor`,
          paragraphs: [
            `An aircraft operated by ${playerAirline.name} has been lost while operating on the ${crashRoute} route. The ${aircraftType.model}, registered as ${ac.name}, suffered a catastrophic failure under circumstances that remain under investigation by aviation authorities. The airline has confirmed the loss of the aircraft.`,
            `${playerAirline.name} has immediately suspended all services on the ${crashRoute} route and convened an emergency board session. The national air accident investigation branch has dispatched a team to the scene. Regulatory authorities have opened a formal inquiry and the airline's entire fleet faces a precautionary safety review.`,
            `"We are devastated by this tragic loss and our thoughts are with everyone affected," said a spokesperson for ${playerAirline.name}. The airline has been issued an immediate financial penalty and faces severe reputational damage. Passenger load factors across the network are expected to fall sharply in the coming weeks as confidence in the carrier wavers.`,
          ],
          severity: 'crash',
          gameDay: store.gameDay,
        });
      }

      // Reputation drain for flying poorly maintained aircraft (condition < 40)
      if (ac.condition < 40) {
        const drain = ((40 - ac.condition) / 40) * 0.15;
        store.applyReputationHit('player', -drain);
      }
    });

    store.batchUpdatePlayerRoutes(playerRouteUpdates);
    store.batchUpdatePlayerAircraft(playerAcUpdates);

    const hubFees = (playerAirline.hubIatas.length * HUB_ANNUAL_FEE_USD) / 365;
    const totalCost = totalFuelCost + totalMaintenanceCost + totalAirportFees + totalCrewCost + hubFees;
    const netProfit = totalRevenue - totalCost;

    store.applyDailyPnL('player', netProfit, totalPassengers, { revenue: totalRevenue, costs: totalCost });
    store.recoverReputation('player');
  }

  // AI economics (same model as player, capped by seat capacity)
  const aiNetProfits: Record<string, number> = {};
  const aiRouteUpdates: Record<string, Partial<typeof aiRoutes[string]>> = {};
  const aiAcUpdates: Record<string, { conditionDelta: number; hoursOwed: number }> = {};

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

      const aircraftType: AircraftType | undefined = AIRCRAFT_TYPE_BY_ID[ac.typeId];
      if (!aircraftType) return;
      if (!canAirportHandleAircraft(origin, aircraftType) || !canAirportHandleAircraft(dest, aircraftType)) return;

      const flightCosts = computeFlightCost(route, ac, aircraftType, origin, dest, globalFuelPrice);
      const flightsPerDay = route.flightsPerWeek / 7;

      // Reference prices: cost-per-seat basis; business at 4x economy.
      const totalSeats = aircraftType.seatsEconomy + aircraftType.seatsBusiness;
      const ecoReferencePrice = totalSeats > 0 ? Math.round(flightCosts.totalCost / totalSeats * 1.3) : 200;
      const bizReferencePrice = ecoReferencePrice * 4;

      const aiOriginUtil = (prevAirportPax[route.originIata] ?? 0) / getAirportCapacity(origin.size, currentYear);
      const aiDestUtil   = (prevAirportPax[route.destinationIata] ?? 0) / getAirportCapacity(dest.size, currentYear);
      const aiSatMod     = airportSaturationMod(aiOriginUtil) * airportSaturationMod(aiDestUtil);
      const baselinePax = getBaselineDailyPax(origin, dest) * (origin.isHub || dest.isHub ? HUB_DEMAND_BONUS : 1) * aiSatMod;
      const aiRepMod = 1 + (aiAirline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR;
      const aiCondMod = conditionDemandMod(ac.condition);

      // Economy and business cabins use independent demand, matching player route economics.
      const ecoMarketShare = getMarketShare(route.originIata, route.destinationIata, route.priceEconomy, ecoReferencePrice, aiAirline.id);
      const ecoCapacity = Math.floor(aircraftType.seatsEconomy * flightsPerDay);
      const ecoPax = Math.min(ecoCapacity, Math.floor(baselinePax * 0.90 * ecoMarketShare * aiRepMod * aiCondMod));

      const bizCapacity = Math.floor(aircraftType.seatsBusiness * flightsPerDay);
      const bizMarketShare = aircraftType.seatsBusiness > 0
        ? getMarketShare(route.originIata, route.destinationIata, route.priceBusiness, bizReferencePrice, aiAirline.id, 'business')
        : 0;
      const bizPax = Math.min(bizCapacity, Math.floor(baselinePax * 0.10 * bizMarketShare * aiRepMod * aiCondMod));

      const dailyRevenue = ecoPax * route.priceEconomy + bizPax * route.priceBusiness;
      const dailyCost = flightCosts.totalCost * flightsPerDay;
      const dailyProfit = dailyRevenue - dailyCost;
      const dailyPax = ecoPax + bizPax;
      const loadFactorEconomy = ecoCapacity > 0 ? ecoPax / ecoCapacity : 0;
      const loadFactorBusiness = bizCapacity > 0 ? bizPax / bizCapacity : 0;

      aiRevenue += dailyRevenue;
      aiCost += dailyCost;
      aiPax += dailyPax;

      aiRouteUpdates[routeId] = {
        dailyRevenue, dailyCost, dailyProfit,
        loadFactorEconomy,
        loadFactorBusiness,
        dailyPassengers: dailyPax,
      };

      aiAcUpdates[ac.id] = {
        conditionDelta: -(flightsPerDay * flightCosts.flightDurationHours * 0.08),
        hoursOwed: flightsPerDay * flightCosts.flightDurationHours,
      };

      // AI crash check — higher risk when flying with a known ignored fault
      const aiRiskMod = ac.knownFaultRiskMod ?? 1;
      if (ac.crashRisk > 0.001 && Math.random() < ac.crashRisk * aiRiskMod * flightsPerDay * 0.0008) {
        const crashRoute = route ? `${route.originIata}–${route.destinationIata}` : 'unknown route';
        const acModel = AIRCRAFT_TYPE_BY_ID[ac.typeId]?.model ?? 'aircraft';
        store.triggerAICrash(ac.id);
        store.pushNewsItem(`CRASH: ${aiAirline.name} ${acModel} lost on ${crashRoute}.`);
        store.pushNewspaper({
          id: `ai_crash_${store.gameDay}_${ac.id}`,
          headline: `${aiAirline.name} ${acModel} lost`,
          subheadline: `Investigators launch inquiry after ${aiAirline.name} aircraft is lost on the ${crashRoute} corridor`,
          paragraphs: [
            `An aircraft operated by ${aiAirline.name} has been lost while operating on the ${crashRoute} route. The ${acModel} suffered a catastrophic in-flight failure under circumstances that remain under investigation by aviation authorities.`,
            `${aiAirline.name} has suspended services on the affected route and its board is convening an emergency session. Investigators have been dispatched to the scene and the carrier's entire fleet faces a precautionary safety audit in the coming days.`,
            `"We are deeply shocked by this tragic event," said a spokesperson for ${aiAirline.name}. The airline faces significant financial penalties and a severe reputational crisis. Market observers expect load factors across ${aiAirline.name}'s network to suffer as passenger confidence falls.`,
          ],
          severity: 'crash',
          gameDay: store.gameDay,
        });
      }
    });

    const netProfit = aiRevenue - aiCost;
    aiNetProfits[aiAirline.id] = netProfit;
    const willBeInsolvent = (aiAirline.cashUSD + netProfit) < -50_000_000;
    const wasInsolvent = aiAirline.isInsolvent;

    store.updateAIAirlineStats(aiAirline.id, netProfit, aiPax, aiRevenue, aiCost, gameDay, !aiAirline.isInsolvent);

    // First tick crossing into insolvency: ground the airline
    if (!wasInsolvent && willBeInsolvent) {
      store.pushNewsItem(`BANKRUPTCY: ${aiAirline.name} has declared bankruptcy and ceased operations.`);
      aiAirline.routeIds.forEach(rid => store.updateAIRoute(rid, { isActive: false }));
    }
  });

  store.batchUpdateAIRoutes(aiRouteUpdates);
  store.batchUpdateAIAircraft(aiAcUpdates);

  // Distribute dividends: deduct from payer, credit shareholder atomically
  let playerDividendTotal = 0;
  Object.entries(aiNetProfits).forEach(([id, profit]) => {
    if (profit <= 0) return;
    const shareholders = aiAirlines[id]?.shareholders;
    if (!shareholders) return;
    Object.entries(shareholders).forEach(([ownerId, pct]) => {
      const div = (pct / 100) * profit;
      store.payDividend(id, ownerId, div);
      if (ownerId === 'player') playerDividendTotal += div;
    });
  });
  if (playerDividendTotal > 500_000) {
    store.pushNewsItem(`Dividends: ${formatCurrency(playerDividendTotal)} received from shareholdings today.`);
  }

  void gameDay;
  void allRoutes;
  void _ac;
  void _r;

  store.setAirportDailyPax(pendingAirportPax);

  // Random incidents and scandals
  runRandomEventsTick(store);
}

export function msToGameDate(gameTimeMs: number): Date {
  const epoch = new Date(1960, 0, 1).getTime();
  return new Date(epoch + gameTimeMs);
}

export function gameDayFromMs(gameTimeMs: number): number {
  return Math.floor(gameTimeMs / DAY_MS);
}
