import React, { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/store';
import { haversineKm } from '@/utils/geo';
import { computeFlightCost, gameDayFromMs, msToGameDate } from '@/engine/economicsEngine';
import { getSuggestedEconomyPrice, getBaselineDailyPax, conditionDemandMod, getCompetitivenessScore } from '@/engine/demandModel';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import type { Aircraft, AircraftType, Airline, Airport, Route } from '@/types';
import { HUB_DEMAND_BONUS, PRICE_ELASTICITY, REPUTATION_DEMAND_FACTOR, REP_PRICE_FACTOR } from '@/utils/constants';
import { AirportSearchInput } from '@/ui/components/AirportSearchInput';
import { findAirportByQuery } from '@/utils/airportSearch';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { PriceInput } from '@/ui/components/PriceInput';
import { formatCurrency } from '@/utils/format';
import { manufacturerFlag } from '@/utils/manufacturerFlags';
import { canAirportHandleAircraft, formatRunwayLength } from '@/utils/runway';

function formatUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
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

interface RouteEstimateInput {
  aircraft: Aircraft;
  aircraftType: AircraftType;
  origin: Airport;
  destination: Airport;
  distanceKm: number;
  flightsPerWeek: number;
  priceEconomy: number;
  priceBusiness: number;
  gameDay: number;
  globalFuelPrice: number;
  playerAirline: Airline | undefined;
  competitorAirlines: Record<string, Airline>;
  competitorRoutes: Route[];
}

interface RouteEstimate {
  dailyRevenue: number;
  dailyCost: number;
  dailyProfit: number;
  loadFactorEco: number;
  loadFactorBiz: number;
  referencePrice: number;
  flightDurationHours: number;
  condMod: number;
}

function estimateRouteProfit(input: RouteEstimateInput): RouteEstimate {
  const {
    aircraft, aircraftType, origin, destination, distanceKm,
    flightsPerWeek, priceEconomy, priceBusiness, gameDay,
    globalFuelPrice, playerAirline, competitorAirlines, competitorRoutes,
  } = input;

  const mockRoute: Route = {
    id: 'preview', airlineId: 'player',
    originIata: origin.iata, destinationIata: destination.iata,
    aircraftId: aircraft.id, flightsPerWeek, priceEconomy, priceBusiness,
    isActive: true, createdGameDay: gameDay, distanceKm, flightDurationHours: 0,
    dailyPassengers: 0, dailyRevenue: 0, dailyCost: 0, dailyProfit: 0,
    loadFactorEconomy: 0, loadFactorBusiness: 0,
  };

  const costs = computeFlightCost(mockRoute, aircraft, aircraftType, origin, destination, globalFuelPrice);
  const flightsPerDay = flightsPerWeek / 7;
  const dailyCost = costs.totalCost * flightsPerDay;

  const totalSeats = aircraftType.seatsEconomy + aircraftType.seatsBusiness;
  const referencePrice = totalSeats > 0 ? Math.round(costs.totalCost / totalSeats * 1.3) : 200;
  const referencePriceBiz = referencePrice * 4;
  const pair = routePairKey(origin.iata, destination.iata);
  const pairCompetitors = competitorRoutes.filter(route => route.isActive && routePairKey(route.originIata, route.destinationIata) === pair);

  const getMarketShare = (price: number, referencePriceForCabin: number, cabin: 'economy' | 'business'): number => {
    const getPrice = (route: Route) => cabin === 'business' ? route.priceBusiness : route.priceEconomy;
    const cabinCompetitors = cabin === 'economy'
      ? pairCompetitors
      : pairCompetitors.filter(route => getPrice(route) > 0);
    const playerPremium = playerAirline ? repPricePremium(playerAirline.reputationScore) : 1;
    const ownEffectivePrice = price / playerPremium;

    if (cabinCompetitors.length === 0) {
      if (ownEffectivePrice <= 0) return 5;
      return Math.min(5, Math.pow(ownEffectivePrice / referencePriceForCabin, PRICE_ELASTICITY));
    }

    const competitorEffectivePrices = cabinCompetitors.map(route => {
      const airline = competitorAirlines[route.airlineId];
      const premium = airline ? repPricePremium(airline.reputationScore) : 1;
      return getPrice(route) / premium;
    });
    const avgPrice = (ownEffectivePrice + competitorEffectivePrices.reduce((sum, p) => sum + p, 0)) / (competitorEffectivePrices.length + 1);
    const ownScore = getCompetitivenessScore(ownEffectivePrice, avgPrice);
    const competitorScore = competitorEffectivePrices.reduce((sum, p) => sum + getCompetitivenessScore(p, avgPrice), 0);
    return ownScore / Math.max(ownScore + competitorScore, 0.0001);
  };

  const baselinePax = getBaselineDailyPax(origin, destination) * (origin.isHub || destination.isHub ? HUB_DEMAND_BONUS : 1);
  const repMod = playerAirline ? 1 + (playerAirline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR : 1;
  const condMod = conditionDemandMod(aircraft.condition);

  const ecoCapacity = aircraftType.seatsEconomy * flightsPerDay;
  const ecoShare = getMarketShare(priceEconomy, referencePrice, 'economy');
  const ecoPax = Math.min(ecoCapacity, Math.floor(baselinePax * 0.90 * ecoShare * repMod * condMod));
  const loadFactorEco = ecoCapacity > 0 ? ecoPax / ecoCapacity : 0;

  const bizCapacity = aircraftType.seatsBusiness * flightsPerDay;
  const bizShare = aircraftType.seatsBusiness > 0
    ? getMarketShare(priceBusiness, referencePriceBiz, 'business')
    : 0;
  const bizPax = Math.min(bizCapacity, Math.floor(baselinePax * 0.10 * bizShare * repMod * condMod));
  const loadFactorBiz = bizCapacity > 0 ? bizPax / bizCapacity : 0;

  const dailyRevenue = ecoPax * priceEconomy + bizPax * priceBusiness;
  const dailyProfit = dailyRevenue - dailyCost;

  return {
    dailyRevenue, dailyCost, dailyProfit,
    loadFactorEco, loadFactorBiz,
    referencePrice, flightDurationHours: costs.flightDurationHours,
    condMod,
  };
}

export const NewRouteModal: React.FC = () => {
  const airports    = useGameStore(s => s.airports);
  const aircraft    = useGameStore(s => s.aircraft);
  const airlines    = useGameStore(s => s.airlines);
  const aiAirlines  = useGameStore(s => s.aiAirlines);
  const aiRoutes    = useGameStore(s => s.aiRoutes);
  const globalFuelPrice = useGameStore(s => s.globalFuelPrice);
  const modalPayload = useGameStore(s => s.modalPayload);
  const closeModal  = useGameStore(s => s.closeModal);
  const createRoute = useGameStore(s => s.createRoute);
  const buyAircraft = useGameStore(s => s.buyAircraft);
  const gameTimeMs  = useGameStore(s => s.gameTimeMs);

  const gameDay = gameDayFromMs(gameTimeMs);
  const currentYear = msToGameDate(gameTimeMs).getFullYear();

  const prefilledOrigin = typeof modalPayload === 'string' ? modalPayload.toUpperCase() : '';

  const [originIata, setOriginIata] = useState(prefilledOrigin);
  const [destIata, setDestIata] = useState('');
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [flightsPerWeek, setFlightsPerWeek] = useState(7);
  const [priceEconomy, setPriceEconomy] = useState(200);
  const [priceBusiness, setPriceBusiness] = useState(800);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  // Pending purchase: aircraft type chosen in shop but not yet bought (committed on route create)
  const [pendingPurchaseTypeId, setPendingPurchaseTypeId] = useState<string | null>(null);

  // Resolve airports
  const originAirport = findAirportByQuery(originIata, airports);
  const destAirport = findAirportByQuery(destIata, airports);

  const distanceKm = useMemo(() => {
    if (!originAirport || !destAirport) return null;
    return Math.round(haversineKm(originAirport.lat, originAirport.lon, destAirport.lat, destAirport.lon));
  }, [originAirport, destAirport]);

  // Unassigned player aircraft
  const availableAircraft = useMemo(
    () => Object.values(aircraft).filter(
      ac => ac.airlineId === 'player' && ac.assignedRouteId === null && ac.status !== 'maintenance',
    ),
    [aircraft],
  );

  const selectedAc = selectedAircraftId ? aircraft[selectedAircraftId] ?? null : null;
  const selectedType = selectedAc ? AIRCRAFT_TYPES.find(t => t.id === selectedAc.typeId) ?? null : null;

  // Pending aircraft type (chosen in shop, bought only when route is confirmed)
  const pendingType = pendingPurchaseTypeId ? AIRCRAFT_TYPES.find(t => t.id === pendingPurchaseTypeId) ?? null : null;

  // Mock Aircraft instance used purely for P&L preview of a pending purchase
  const pendingMockAc = useMemo((): Aircraft | null => {
    if (!pendingType) return null;
    return {
      id: 'pending', typeId: pendingType.id, name: pendingType.model,
      airlineId: 'player', purchasedGameDay: gameDay, totalFlightHours: 0,
      condition: 100, maintenanceHoursOwed: 0, isGrounded: false,
      lastMaintenanceGameDay: gameDay, crashRisk: 0, knownFaultRiskMod: 1,
      assignedRouteId: null, status: 'idle', currentLat: 0, currentLon: 0,
      flightProgress: 0, activeMaintTier: null, autoMaintenanceEnabled: false,
      autoMaintenanceThreshold: 40, autoMaintenanceTier: 'standard', excludedFromPolicy: false,
    };
  }, [pendingType, gameDay]);

  const effectiveAc   = selectedAc ?? pendingMockAc;
  const effectiveType = selectedType ?? pendingType;
  const effectiveHasBusinessSeats = (effectiveType?.seatsBusiness ?? 0) > 0;

  // Suggested price from flight cost
  useEffect(() => {
    if (!effectiveType || !distanceKm) return;
    const flightDurationHours = distanceKm / effectiveType.cruiseSpeedKmh;
    const totalCostPerFlight =
      (distanceKm / 100) * effectiveType.fuelBurnLPer100Km * 0.82 +
      effectiveType.maintenanceCostPerHourUSD * flightDurationHours +
      flightDurationHours * 85 +
      2000;
    const suggested = getSuggestedEconomyPrice(totalCostPerFlight, effectiveType.seatsEconomy + effectiveType.seatsBusiness);
    setPriceEconomy(suggested);
    setPriceBusiness(effectiveType.seatsBusiness > 0 ? suggested * 4 : 0);
  }, [effectiveType, distanceKm]);

  // Validation
  const validOrigin = !!originAirport;
  const validDest = !!destAirport;
  const sameAirport = !!originAirport && !!destAirport && originAirport.iata === destAirport.iata;
  const outOfRange = distanceKm !== null && effectiveType !== null && distanceKm > effectiveType.rangeKm;
  const originRunwayShort = !!originAirport && !!effectiveType && !canAirportHandleAircraft(originAirport, effectiveType);
  const destRunwayShort = !!destAirport && !!effectiveType && !canAirportHandleAircraft(destAirport, effectiveType);
  const runwayLimited = originRunwayShort || destRunwayShort;

  const canSubmit =
    validOrigin &&
    validDest &&
    !sameAirport &&
    distanceKm !== null &&
    !outOfRange &&
    !runwayLimited;

  // P&L preview — uses real demand model with price elasticity
  const pnlPreview = useMemo(() => {
    if (!effectiveAc || !effectiveType || !originAirport || !destAirport || !distanceKm) return null;

    return estimateRouteProfit({
      aircraft: effectiveAc,
      aircraftType: effectiveType,
      origin: originAirport,
      destination: destAirport,
      distanceKm,
      flightsPerWeek,
      priceEconomy,
      priceBusiness,
      gameDay,
      globalFuelPrice,
      playerAirline: airlines['player'],
      competitorAirlines: aiAirlines,
      competitorRoutes: Object.values(aiRoutes),
    });
  }, [
    effectiveAc, effectiveType, originAirport, destAirport, distanceKm,
    flightsPerWeek, priceEconomy, priceBusiness, gameDay, globalFuelPrice,
    airlines, aiAirlines, aiRoutes,
  ]);

  const optimisable = !!effectiveAc && !!effectiveType && !!originAirport && !!destAirport && !!distanceKm && !sameAirport && !outOfRange && !runwayLimited;

  function handleOptimiseRoute() {
    if (!effectiveAc || !effectiveType || !originAirport || !destAirport || !distanceKm) return;

    const baseEstimate = estimateRouteProfit({
      aircraft: effectiveAc,
      aircraftType: effectiveType,
      origin: originAirport,
      destination: destAirport,
      distanceKm,
      flightsPerWeek,
      priceEconomy,
      priceBusiness,
      gameDay,
      globalFuelPrice,
      playerAirline: airlines['player'],
      competitorAirlines: aiAirlines,
      competitorRoutes: Object.values(aiRoutes),
    });

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
      priceEconomy,
      ecoReference,
      ...multipliers.map(multiplier => normalisePrice(ecoReference * multiplier)),
    ])).filter(price => price >= 1 && price <= maxEco);
    const bizPrices = effectiveType.seatsBusiness > 0
      ? Array.from(new Set([
          priceBusiness,
          bizReference,
          ...multipliers.map(multiplier => normalisePrice(bizReference * multiplier)),
        ])).filter(price => price >= 1 && price <= maxBiz)
      : [0];

    let best = {
      flightsPerWeek,
      priceEconomy,
      priceBusiness,
      estimate: baseEstimate,
    };

    for (let candidateFlights = 1; candidateFlights <= 21; candidateFlights++) {
      for (const candidateEco of ecoPrices) {
        for (const candidateBiz of bizPrices) {
          const estimate = estimateRouteProfit({
            aircraft: effectiveAc,
            aircraftType: effectiveType,
            origin: originAirport,
            destination: destAirport,
            distanceKm,
            flightsPerWeek: candidateFlights,
            priceEconomy: candidateEco,
            priceBusiness: candidateBiz,
            gameDay,
            globalFuelPrice,
            playerAirline: airlines['player'],
            competitorAirlines: aiAirlines,
            competitorRoutes: Object.values(aiRoutes),
          });
          if (estimate.dailyProfit > best.estimate.dailyProfit) {
            best = {
              flightsPerWeek: candidateFlights,
              priceEconomy: candidateEco,
              priceBusiness: candidateBiz,
              estimate,
            };
          }
        }
      }
    }

    setFlightsPerWeek(best.flightsPerWeek);
    setPriceEconomy(best.priceEconomy);
    setPriceBusiness(best.priceBusiness);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitError(null);

    // If user picked a new aircraft from the shop, buy it now as part of route creation
    let aircraftId: string | null = selectedAircraftId;
    if (pendingPurchaseTypeId && !selectedAircraftId) {
      const type = AIRCRAFT_TYPES.find(t => t.id === pendingPurchaseTypeId)!;
      if (playerCash < type.purchasePrice) {
        setSubmitError('Insufficient funds to purchase the selected aircraft.');
        return;
      }
      const newId = buyAircraft(pendingPurchaseTypeId, type, gameDay);
      if (!newId) {
        setSubmitError('Aircraft purchase failed.');
        return;
      }
      aircraftId = newId;
    }

    const result = createRoute(
      { originIata: originAirport!.iata, destinationIata: destAirport!.iata, aircraftId, flightsPerWeek, priceEconomy, priceBusiness: effectiveHasBusinessSeats ? priceBusiness : 0 },
      airports, gameDay,
    );
    if (result !== null) {
      closeModal();
    } else {
      setSubmitError('Failed to create route. Check airport codes.');
    }
  }

  // Stage an aircraft type for purchase — committed only when the route is created
  function handleSelectForPurchase(typeId: string) {
    setPendingPurchaseTypeId(typeId);
    setSelectedAircraftId(null);
    setShowBuyPanel(false);
  }

  const playerCash = airlines['player']?.cashUSD ?? 0;
  const unlockedTypes = AIRCRAFT_TYPES.filter(t => t.yearIntroduced <= currentYear);
  const buyableTypes = unlockedTypes.sort((a, b) => {
    const aFits = distanceKm === null || a.rangeKm >= distanceKm;
    const bFits = distanceKm === null || b.rangeKm >= distanceKm;
    if (aFits !== bFits) return aFits ? -1 : 1;
    return a.purchasePrice - b.purchasePrice;
  });
  const [buyMfr, setBuyMfr] = useState<string | null>(null);
  const buyMfrs = useMemo(() => Array.from(new Set(buyableTypes.map(t => t.manufacturer))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), [buyableTypes]);
  const activeBuyMfr = buyMfr ?? buyMfrs[0] ?? '';
  const shopVisible = buyableTypes.filter(t => t.manufacturer === activeBuyMfr);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[92svh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="panel-header flex items-center justify-between px-4 sm:px-6 sm:py-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">New Route</h2>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            aria-label="Close"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-5 overscroll-contain">

          {/* Airport Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <AirportSearchInput
              label="Origin"
              value={originIata}
              airports={airports}
              placeholder="JFK, KJFK, New York"
              onChange={setOriginIata}
              onSelect={airport => setOriginIata(airport.iata)}
            />
            <AirportSearchInput
              label="Destination"
              value={destIata}
              airports={airports}
              placeholder="LAX, KLAX, Los Angeles"
              onChange={setDestIata}
              onSelect={airport => setDestIata(airport.iata)}
            />
          </div>

          {/* Distance */}
          {distanceKm !== null && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-400">Distance:</span>
              <span className="text-white font-semibold">{distanceKm.toLocaleString()} km</span>
              {sameAirport && (
                <span className="text-red-400 ml-2">Origin and destination must differ</span>
              )}
              {outOfRange && selectedType && (
                <span className="text-red-400 ml-2">
                  Exceeds {selectedType.model} range ({selectedType.rangeKm.toLocaleString()} km)
                </span>
              )}
              {runwayLimited && effectiveType && (
                <span className="text-red-400 ml-2">
                  Runway too short for {effectiveType.model} ({formatRunwayLength(effectiveType.minRunwayM)} required)
                </span>
              )}
            </div>
          )}

          {/* Aircraft Selector */}
          <div>
            <label className="text-gray-300 text-sm block mb-2">
              Aircraft <span className="text-gray-500 font-normal">(optional — route inactive without one)</span>
            </label>
            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {/* Pending purchase row */}
              {pendingType && (
                <div className="flex items-center justify-between px-3 py-2 rounded border border-amber-400/40 bg-amber-500/10 text-sm">
                  <div>
                    <span className="text-amber-200 font-medium">{manufacturerFlag(pendingType.manufacturer)} {pendingType.model}</span>
                    <span className="ml-2 text-amber-400/70 text-xs">
                      {pendingType.seatsEconomy}Y{pendingType.seatsBusiness > 0 ? `/${pendingType.seatsBusiness}J` : ''} · {pendingType.rangeKm.toLocaleString()} km
                    </span>
                    <span className="ml-2 text-xs text-amber-300/60 italic">purchased on create</span>
                  </div>
                  <button
                    onClick={() => setPendingPurchaseTypeId(null)}
                    className="text-gray-500 hover:text-red-400 text-xs ml-3"
                  >
                    ✕
                  </button>
                </div>
              )}
              {/* No aircraft option */}
              {!pendingType && (
                <button
                  onClick={() => setSelectedAircraftId(null)}
                  className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                    selectedAircraftId === null
                      ? 'border-sky-300/40 bg-sky-500/15 text-sky-200'
                      : 'border-white/10 bg-white/[0.055] text-gray-400 hover:border-white/20'
                  }`}
                >
                  No aircraft (inactive route)
                </button>
              )}
              {/* Existing fleet */}
              {availableAircraft.map(ac => {
                const acType = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
                const tooFar = distanceKm !== null && acType && distanceKm > acType.rangeKm;
                const tooShort = !!acType && (
                  (!!originAirport && !canAirportHandleAircraft(originAirport, acType)) ||
                  (!!destAirport && !canAirportHandleAircraft(destAirport, acType))
                );
                const unavailable = !!tooFar || tooShort;
                return (
                  <button
                    key={ac.id}
                    onClick={() => { if (!unavailable) { setSelectedAircraftId(ac.id); setPendingPurchaseTypeId(null); } }}
                    disabled={unavailable}
                    className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                      selectedAircraftId === ac.id && !pendingType
                        ? 'border-sky-300/40 bg-sky-500/15 text-sky-200'
                        : unavailable
                        ? 'border-white/10 bg-white/[0.025] text-gray-600 cursor-not-allowed'
                        : 'border-white/10 bg-white/[0.055] text-gray-300 hover:border-white/20'
                    }`}
                  >
                    <span className="font-mono text-xs text-gray-500 mr-2">{ac.id.slice(0, 8).toUpperCase()}</span>
                    {acType?.model ?? ac.typeId}
                    {acType && (
                      <span className="ml-2 text-gray-500 text-xs">
                        {acType.seatsEconomy}Y{acType.seatsBusiness > 0 ? `/${acType.seatsBusiness}J` : ''} · {acType.rangeKm.toLocaleString()} km
                      </span>
                    )}
                    {tooFar && <span className="ml-2 text-red-500 text-xs">out of range</span>}
                    {tooShort && <span className="ml-2 text-red-500 text-xs">runway too short</span>}
                  </button>
                );
              })}
              {availableAircraft.length === 0 && !pendingType && (
                <p className="text-xs text-gray-500 italic px-1">No unassigned aircraft — buy one below.</p>
              )}
            </div>
          </div>

          {/* Inline aircraft shop */}
          <div>
            <button
              type="button"
              onClick={() => setShowBuyPanel(v => !v)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showBuyPanel ? '▲ Hide aircraft shop' : '+ Buy new aircraft'}
            </button>

            {showBuyPanel && (
              <div className="mt-2 glass-card overflow-hidden">
                <div className="px-3 py-2 bg-white/[0.05] text-xs text-gray-400 border-b border-white/10">
                  Your cash: <span className="text-white font-semibold">{formatCurrency(playerCash)}</span>
                  {distanceKm && <span className="ml-2">· Route: {distanceKm.toLocaleString()} km</span>}
                </div>
                  <div className="flex flex-col sm:flex-row h-[22rem] sm:h-52">
                  {/* Manufacturer sidebar */}
                  <div className="w-full sm:w-36 shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-x-auto sm:overflow-y-auto py-1 bg-white/[0.025] flex sm:block scrollbar-none">
                    {buyMfrs.map(mfr => (
                      <button
                        key={mfr}
                        onClick={() => setBuyMfr(mfr)}
                        className={`shrink-0 sm:w-full text-left px-3 sm:px-2 py-2 sm:py-1.5 text-xs transition-colors ${
                          activeBuyMfr === mfr
                            ? 'bg-white/[0.12] text-white font-semibold'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.07]'
                        }`}
                      >
                        {mfr}
                      </button>
                    ))}
                  </div>
                  {/* Aircraft list */}
                  <div className="flex-1 overflow-y-auto divide-y divide-white/10 bg-slate-950/25">
                    {shopVisible.map(t => {
                      const fitsRange = distanceKm === null || t.rangeKm >= distanceKm;
                      const fitsRunway = (!originAirport || canAirportHandleAircraft(originAirport, t)) && (!destAirport || canAirportHandleAircraft(destAirport, t));
                      const fits      = fitsRange && fitsRunway;
                      const canAfford = playerCash >= t.purchasePrice;
                      const isPending = pendingPurchaseTypeId === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => fits && canAfford && handleSelectForPurchase(t.id)}
                          disabled={!fits || !canAfford}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                            isPending
                              ? 'bg-amber-500/15 border-l-2 border-amber-400'
                              : !fits
                              ? 'opacity-40 cursor-not-allowed'
                              : !canAfford
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-white/[0.07] cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-medium">{t.model}</span>
                              {!fitsRange && <span className="text-[10px] text-red-400 bg-red-900/40 px-1 rounded">out of range</span>}
                              {fitsRange && !fitsRunway && <span className="text-[10px] text-red-400 bg-red-900/40 px-1 rounded">runway too short</span>}
                              {fits && <span className="text-[10px] text-green-400 bg-green-900/40 px-1 rounded">✓ in range</span>}
                              {isPending && <span className="text-[10px] text-amber-300 bg-amber-900/40 px-1 rounded">selected</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t.seatsEconomy}Y{t.seatsBusiness > 0 ? `/${t.seatsBusiness}J` : ''} · {t.rangeKm.toLocaleString()} km
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className={canAfford ? 'text-green-400 font-semibold text-xs' : 'text-red-400 font-semibold text-xs'}>
                              {formatCurrency(t.purchasePrice)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Optimiser */}
          <div className="glass-card p-3 flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3">
            <div>
              <p className="text-gray-300 text-sm font-semibold">Route optimiser</p>
              <p className="text-xs text-gray-500">
                Finds the best frequency and fares for estimated daily profit.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOptimiseRoute}
              disabled={!optimisable}
              className="apple-button-primary px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Optimise route
            </button>
          </div>

          {/* Flights per week */}
          <div>
            <label className="text-gray-300 text-sm block mb-2">
              Flights per week: <span className="text-white font-semibold">{flightsPerWeek}</span>
              <span className="text-gray-500 ml-2 font-normal text-xs">({(flightsPerWeek / 7).toFixed(2)}/day)</span>
            </label>
            <input
              type="range"
              min={1}
              max={21}
              step={1}
              value={flightsPerWeek}
              onChange={e => setFlightsPerWeek(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>7</span>
              <span>14</span>
              <span>21</span>
            </div>
          </div>

          {/* Pricing */}
          {(() => {
            const refPrice = pnlPreview?.referencePrice ?? null;
            const maxEco = refPrice ? refPrice * 6 : 9999;
            const maxBiz = refPrice ? refPrice * 24 : 39999;
            const hasBusinessSeats = effectiveHasBusinessSeats;
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Pricing</span>
                  {refPrice && (
                    <button
                      type="button"
                      onClick={() => { setPriceEconomy(refPrice); setPriceBusiness(hasBusinessSeats ? refPrice * 4 : 0); }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      ↺ Reset to suggested ({formatUSD(refPrice)}{hasBusinessSeats ? ` / ${formatUSD(refPrice * 4)}` : ''})
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Economy (max {formatUSD(maxEco)})</label>
                    <PriceInput
                      value={priceEconomy} min={0} max={maxEco}
                      onChange={v => setPriceEconomy(v)}
                    />
                    <input
                      type="range"
                      min={0}
                      max={maxEco}
                      step={1}
                      value={Math.min(maxEco, priceEconomy)}
                      onChange={e => setPriceEconomy(Math.min(maxEco, normalisePrice(Number(e.target.value))))}
                      className="mt-2 w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>$0</span>
                      {refPrice && <span>Suggested {formatUSD(refPrice)}</span>}
                      <span>{formatUSD(maxEco)}</span>
                    </div>
                  </div>
                  <div className={!hasBusinessSeats ? 'opacity-60' : ''}>
                    <label className="text-gray-400 text-xs block mb-1">
                      Business {hasBusinessSeats ? `(max ${formatUSD(maxBiz)})` : '(no business seats)'}
                    </label>
                    <PriceInput
                      value={hasBusinessSeats ? priceBusiness : 0} min={0} max={maxBiz}
                      disabled={!hasBusinessSeats}
                      onChange={v => setPriceBusiness(v)}
                    />
                    <input
                      type="range"
                      disabled={!hasBusinessSeats}
                      min={0}
                      max={maxBiz}
                      step={1}
                      value={hasBusinessSeats ? Math.min(maxBiz, priceBusiness) : 0}
                      onChange={e => setPriceBusiness(Math.min(maxBiz, normalisePrice(Number(e.target.value))))}
                      className="mt-2 w-full accent-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>$0</span>
                      {hasBusinessSeats && refPrice && <span>Suggested {formatUSD(refPrice * 4)}</span>}
                      <span>{formatUSD(maxBiz)}</span>
                    </div>
                    {!hasBusinessSeats && (
                      <p className="text-[10px] text-gray-500 mt-1">Selected aircraft has no business cabin.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* P&L Preview */}
          {pnlPreview && (
            <div className="glass-card px-4 py-3 space-y-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Estimated Daily P&L</p>

              {/* Load factors */}
              <div className="space-y-1.5">
                <LoadFactorBar value={pnlPreview.loadFactorEco} label="Eco LF" />
                <LoadFactorBar value={pnlPreview.loadFactorBiz} label="Biz LF" />
              </div>

              <p className="text-[10px] text-gray-500">
                Suggested price: <span className="text-gray-400">{formatUSD(pnlPreview.referencePrice)}</span>
                {' · '}higher price = lower load factor · lower price = fuller plane
              </p>
              {pnlPreview.condMod < 0.95 && (
                <p className="text-[10px] text-yellow-500">
                  ⚠ Aircraft condition {selectedAc!.condition.toFixed(0)}% is reducing demand by {((1 - pnlPreview.condMod) * 100).toFixed(0)}%
                </p>
              )}

              {/* Revenue / cost / profit */}
              <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 sm:gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Revenue</p>
                  <p className="text-green-400 font-semibold">{formatUSD(pnlPreview.dailyRevenue)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Cost</p>
                  <p className="text-red-400 font-semibold">{formatUSD(pnlPreview.dailyCost)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Profit</p>
                  <p className={`font-semibold ${pnlPreview.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatUSD(pnlPreview.dailyProfit)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                {pnlPreview.flightDurationHours.toFixed(1)}h flight · {flightsPerWeek} flights/week
              </p>
            </div>
          )}

          {submitError && (
            <div className="px-3 py-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-white/[0.025] flex-shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
          <button
            onClick={closeModal}
            className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-400 text-sm transition-colors min-h-11"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="apple-button-primary px-5 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pendingType
              ? `Create Route + Buy ${pendingType.model} (${formatCurrency(pendingType.purchasePrice)})`
              : 'Create Route'}
          </button>
        </div>
      </div>
    </div>
  );
};
