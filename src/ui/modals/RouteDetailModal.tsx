import React, { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { PriceInput } from '@/ui/components/PriceInput';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { computeFlightCost } from '@/engine/economicsEngine';
import { getRouteOptimisationChanges } from '@/engine/routeOptimizer';
import { MAX_REASONABLE_FARE_MULTIPLIER, getPlayerMarketShare, getBaselineDailyPax, conditionDemandMod } from '@/engine/demandModel';
import { HUB_DEMAND_BONUS, REPUTATION_DEMAND_FACTOR } from '@/utils/constants';
import { canAirportHandleAircraft, formatRunwayLength } from '@/utils/runway';
import { computeAircraftValue } from '@/engine/valuation';
import { manufacturerFlag } from '@/utils/manufacturerFlags';

const ALL_MANUFACTURERS = 'All';

function LoadFactorPreviewRow({ label, current, predicted }: { label: string; current: number; predicted: number }) {
  const pct  = Math.round(Math.min(1, Math.max(0, predicted)) * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const delta = Math.round((predicted - current) * 100);
  const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500';
  const deltaStr   = delta > 0 ? `+${delta}` : `${delta}`;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-8">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{pct}%</span>
      {delta !== 0 && (
        <span className={`text-[10px] w-8 text-right tabular-nums ${deltaColor}`}>{deltaStr}pp</span>
      )}
    </div>
  );
}

function normalisePrice(value: number): number {
  if (value <= 0) return 0;
  const step = value < 200 ? 5 : value < 1000 ? 10 : value < 5000 ? 50 : 100;
  return Math.max(0, Math.round(value / step) * step);
}

export const RouteDetailModal: React.FC = () => {
  const routes               = useGameStore(s => s.routes);
  const aircraft             = useGameStore(s => s.aircraft);
  const airports             = useGameStore(s => s.airports);
  const modalPayload         = useGameStore(s => s.modalPayload);
  const selectedRouteId      = useGameStore(s => s.selectedRouteId);
  const closeModal           = useGameStore(s => s.closeModal);
  const selectRoute          = useGameStore(s => s.selectRoute);
  const updateRoute          = useGameStore(s => s.updateRoute);
  const deleteRoute          = useGameStore(s => s.deleteRoute);
  const assignAircraftToRoute = useGameStore(s => s.assignAircraftToRoute);
  const buyAircraft          = useGameStore(s => s.buyAircraft);
  const sellAircraft         = useGameStore(s => s.sellAircraft);
  const airlines    = useGameStore(s => s.airlines);
  const aiAirlines  = useGameStore(s => s.aiAirlines);
  const aiRoutes    = useGameStore(s => s.aiRoutes);
  const globalFuelPrice = useGameStore(s => s.globalFuelPrice);
  const airportDailyPax = useGameStore(s => s.airportDailyPax);
  const gameDay = useGameStore(s => s.gameDay);

  const routeId = (modalPayload as string | null) ?? selectedRouteId;
  const route   = routeId ? routes[routeId] : null;

  const [priceEconomy,   setPriceEconomy]   = useState(route?.priceEconomy   ?? 0);
  const [priceBusiness,  setPriceBusiness]  = useState(route?.priceBusiness  ?? 0);
  const [flightsPerWeek, setFlightsPerWeek] = useState(route?.flightsPerWeek ?? 7);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [buyMfr, setBuyMfr] = useState(ALL_MANUFACTURERS);
  const [aircraftActionError, setAircraftActionError] = useState<string | null>(null);
  const [confirmSellAircraft, setConfirmSellAircraft] = useState(false);

  useEffect(() => {
    if (route) {
      setPriceEconomy(route.priceEconomy);
      setPriceBusiness(route.priceBusiness);
      setFlightsPerWeek(route.flightsPerWeek);
    }
  }, [route]);

  const assignedAircraft = route?.aircraftId ? aircraft[route.aircraftId] : null;
  const origin      = route ? airports[route.originIata] : null;
  const destination = route ? airports[route.destinationIata] : null;

  // Reference price: cost-per-seat × 1.3, matching optimiser and new-route preview.
  const assignedType = assignedAircraft ? AIRCRAFT_TYPES.find(t => t.id === assignedAircraft.typeId) : null;
  const referencePrice = (() => {
    if (route && assignedAircraft && assignedType && origin && destination) {
      const costs = computeFlightCost(route, assignedAircraft, assignedType, origin, destination, globalFuelPrice, gameDay);
      const totalSeats = assignedType.seatsEconomy + assignedType.seatsBusiness;
      return totalSeats > 0 ? Math.round(costs.totalCost / totalSeats * 1.3) : Math.round(route.distanceKm * 0.12);
    }
    return route ? Math.round(route.distanceKm * 0.12) : 0;
  })();
  const maxEco = referencePrice * MAX_REASONABLE_FARE_MULTIPLIER;
  const maxBiz = referencePrice * 4 * MAX_REASONABLE_FARE_MULTIPLIER;
  const hasBusinessSeats = (assignedType?.seatsBusiness ?? 0) > 0;
  const playerAirline = airlines['player'];
  const playerCash = playerAirline?.cashUSD ?? 0;
  const currentYear = 1960 + Math.floor(gameDay / 365);

  useEffect(() => {
    setPriceEconomy(price => Math.min(maxEco, Math.max(0, price)));
    setPriceBusiness(price => hasBusinessSeats ? Math.min(maxBiz, Math.max(0, price)) : 0);
  }, [maxEco, maxBiz, hasBusinessSeats]);

  const preview = useMemo(() => {
    if (!route || !assignedAircraft || !assignedType || !origin || !destination) return null;
    const allAirlines = [...Object.values(airlines), ...Object.values(aiAirlines)];
    const allRoutes   = [...Object.values(routes),   ...Object.values(aiRoutes)];
    const flightCosts = computeFlightCost(route, assignedAircraft, assignedType, origin, destination, globalFuelPrice, gameDay);
    const flightsPerDay = flightsPerWeek / 7;
    const totalSeats  = assignedType.seatsEconomy + assignedType.seatsBusiness;
    const ecoRef      = totalSeats > 0 ? Math.round(flightCosts.totalCost / totalSeats * 1.3) : 200;
    const bizRef      = ecoRef * 4;
    const playerAirline = airlines['player'];
    const repMod = playerAirline ? 1 + (playerAirline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR : 1;
    const condMod = conditionDemandMod(assignedAircraft.condition);
    const baselinePax = getBaselineDailyPax(origin, destination) * (origin.isHub || destination.isHub ? HUB_DEMAND_BONUS : 1);
    const ecoShare    = getPlayerMarketShare(route.originIata, route.destinationIata, priceEconomy, allAirlines, allRoutes, ecoRef, 'player', 'economy', route.id);
    const ecoCapacity = assignedType.seatsEconomy * flightsPerDay;
    const ecoPax      = Math.min(ecoCapacity, Math.floor(baselinePax * 0.90 * ecoShare * repMod * condMod));
    const lfe         = ecoCapacity > 0 ? ecoPax / ecoCapacity : 0;
    const bizShare    = assignedType.seatsBusiness > 0
      ? getPlayerMarketShare(route.originIata, route.destinationIata, priceBusiness, allAirlines, allRoutes, bizRef, 'player', 'business', route.id)
      : 0;
    const bizCapacity = assignedType.seatsBusiness * flightsPerDay;
    const bizPax      = Math.min(bizCapacity, Math.floor(baselinePax * 0.10 * bizShare * repMod * condMod));
    const lfb         = bizCapacity > 0 ? bizPax / bizCapacity : 0;
    const dailyRevenue = ecoPax * priceEconomy + bizPax * priceBusiness;
    const dailyCost    = flightCosts.totalCost * flightsPerDay;
    return { lfe, lfb, dailyRevenue, dailyCost, dailyProfit: dailyRevenue - dailyCost };
  }, [priceEconomy, priceBusiness, flightsPerWeek, assignedAircraft, assignedType, origin, destination,
      routes, aiRoutes, airlines, aiAirlines, globalFuelPrice, gameDay, route]);

  const optimisationChanges = useMemo(() => {
    if (!route || !assignedAircraft || !assignedType || !origin || !destination) return null;
    return getRouteOptimisationChanges({
      route: { ...route, flightsPerWeek, priceEconomy, priceBusiness: hasBusinessSeats ? priceBusiness : 0 },
      aircraft: assignedAircraft,
      aircraftType: assignedType,
      origin,
      destination,
      globalFuelPrice,
      playerAirline: airlines['player'],
      competitorAirlines: { ...airlines, ...aiAirlines },
      competitorRoutes: [...Object.values(routes), ...Object.values(aiRoutes)],
      airportDailyPax,
      gameDay,
    });
  }, [
    route, assignedAircraft, assignedType, origin, destination, flightsPerWeek,
    priceEconomy, priceBusiness, hasBusinessSeats, globalFuelPrice, airlines,
    aiAirlines, routes, aiRoutes, airportDailyPax, gameDay,
  ]);

  if (!route || !origin || !destination) return null;

  const assignedRunwayLimited = !!assignedType && (
    !canAirportHandleAircraft(origin, assignedType) ||
    !canAirportHandleAircraft(destination, assignedType)
  );

  // Aircraft eligible for this route: not in maintenance/crashed, range and runway sufficient
  const eligibleAircraft = Object.values(aircraft).filter(ac => {
    if (ac.airlineId !== 'player') return false;
    if (ac.status === 'maintenance' || ac.status === 'crashed') return false;
    if (ac.id === route.aircraftId) return false; // already assigned
    const type = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
    return type && type.rangeKm >= route.distanceKm &&
      canAirportHandleAircraft(origin, type) &&
      canAirportHandleAircraft(destination, type);
  });

  const buyMfrs = useMemo(() => {
    const set = new Set(AIRCRAFT_TYPES.map(t => t.manufacturer));
    return [ALL_MANUFACTURERS, ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))];
  }, []);

  const shopVisible = useMemo(() => (
    AIRCRAFT_TYPES
      .filter(t => t.yearIntroduced <= currentYear)
      .filter(t => buyMfr === ALL_MANUFACTURERS || t.manufacturer === buyMfr)
  ), [buyMfr, currentYear]);

  const conditionColor =
    (assignedAircraft?.condition ?? 100) >= 70 ? 'bg-green-500'
    : (assignedAircraft?.condition ?? 100) >= 40 ? 'bg-yellow-500'
    : 'bg-red-500';

  function handleSave() {
    if (!routeId) return;
    updateRoute(routeId, { priceEconomy, priceBusiness: hasBusinessSeats ? priceBusiness : 0, flightsPerWeek });
    closeModal();
    selectRoute(null);
  }

  function handleOptimiseRoute() {
    if (!route || !assignedAircraft || !assignedType || !origin || !destination) return;

    if (!optimisationChanges) return;

    setFlightsPerWeek(optimisationChanges.flightsPerWeek);
    setPriceEconomy(optimisationChanges.priceEconomy);
    setPriceBusiness(optimisationChanges.priceBusiness);
  }

  function handleToggleActive() {
    if (!routeId || !route) return;
    if (!route.isActive && assignedRunwayLimited) return;
    updateRoute(routeId, { isActive: !route.isActive });
  }

  function handleAssign(aircraftId: string) {
    if (!routeId) return;
    setAircraftActionError(null);
    assignAircraftToRoute(aircraftId, routeId);
  }

  function handleUnassign() {
    if (!route?.aircraftId || !routeId) return;
    setAircraftActionError(null);
    assignAircraftToRoute(route.aircraftId, null);
  }

  function handleBuyAndAssign(type: typeof AIRCRAFT_TYPES[number]) {
    if (!routeId || !route || !origin || !destination) return;
    setAircraftActionError(null);
    if (playerCash < type.purchasePrice) {
      setAircraftActionError('Insufficient funds to buy this aircraft.');
      return;
    }
    if (type.rangeKm < route.distanceKm) {
      setAircraftActionError('That aircraft does not have enough range for this route.');
      return;
    }
    if (!canAirportHandleAircraft(origin, type) || !canAirportHandleAircraft(destination, type)) {
      setAircraftActionError('That aircraft needs more runway than one of these airports has.');
      return;
    }

    const newId = buyAircraft(type.id, type, gameDay);
    if (!newId) {
      setAircraftActionError('Aircraft purchase failed.');
      return;
    }

    assignAircraftToRoute(newId, routeId);
    setShowBuyPanel(false);
    setConfirmSellAircraft(false);
  }

  function handleSellAssignedAircraft() {
    if (!assignedAircraft) return;
    if (!confirmSellAircraft) {
      setConfirmSellAircraft(true);
      return;
    }
    setAircraftActionError(null);
    sellAircraft(assignedAircraft.id);
    setConfirmSellAircraft(false);
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    closeModal();
    selectRoute(null);
    if (routeId) deleteRoute(routeId);
  }

  function handleClose() {
    closeModal();
    selectRoute(null);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl w-full max-w-lg relative max-h-[92svh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-white/10 bg-slate-950/45 backdrop-blur-xl">
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none"
        >
          ×
        </button>

        <h2 className="text-xl font-bold text-white mb-1 pr-12">Route Detail</h2>

        <div className="flex items-center gap-2 pr-12">
          <span className="text-blue-400 font-mono font-bold text-lg">{route.originIata}</span>
          <span className="text-gray-400">→</span>
          <span className="text-blue-400 font-mono font-bold text-lg">{route.destinationIata}</span>
          {origin && destination && (
            <span className="text-gray-500 text-sm ml-1">{origin.city} → {destination.city}</span>
          )}
        </div>

        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 overscroll-contain">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
          <div className="glass-card p-3">
            <div className="text-gray-400 text-xs mb-1">Distance</div>
            <div className="text-white font-semibold">{Math.round(route.distanceKm).toLocaleString()} km</div>
          </div>
          <div className="glass-card p-3">
            <div className="text-gray-400 text-xs mb-1">Runway</div>
            <div className={assignedRunwayLimited ? 'text-red-400 font-semibold' : 'text-white font-semibold'}>
              {assignedType ? formatRunwayLength(assignedType.minRunwayM) : 'No aircraft'}
            </div>
          </div>
          <div className="glass-card p-3">
            <div className="text-gray-400 text-xs mb-1">Daily Revenue</div>
            <div className="text-green-400 font-semibold">{formatCurrency(route.dailyRevenue)}</div>
          </div>
          <div className="glass-card p-3">
            <div className="text-gray-400 text-xs mb-1">Daily Cost</div>
            <div className="text-red-400 font-semibold">{formatCurrency(route.dailyCost)}</div>
          </div>
          <div className="glass-card p-3">
            <div className={`text-xs mb-1 text-gray-400`}>Daily Profit</div>
            <div className={`font-bold ${route.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(route.dailyProfit)}
            </div>
          </div>
        </div>

        {/* Load factors */}
        <div className="glass-card p-3 mb-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Load Factors</span>
            {preview && <span className="text-[10px] text-blue-400">preview</span>}
          </div>
          {preview ? (
            <>
              <LoadFactorPreviewRow label="Eco" current={route.loadFactorEconomy} predicted={preview.lfe} />
              {assignedType && assignedType.seatsBusiness > 0 && (
                <LoadFactorPreviewRow label="Biz" current={route.loadFactorBusiness} predicted={preview.lfb} />
              )}
              <div className="border-t border-white/10 mt-2 pt-2 grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-gray-500 text-[10px]">Revenue</div>
                  <div className="text-green-400">{formatCurrency(preview.dailyRevenue)}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[10px]">Cost</div>
                  <div className="text-red-400">{formatCurrency(preview.dailyCost)}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[10px]">Profit</div>
                  <div className={preview.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatCurrency(preview.dailyProfit)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <LoadFactorBar value={route.loadFactorEconomy}  label="Eco" />
              <LoadFactorBar value={route.loadFactorBusiness} label="Biz" />
            </>
          )}
        </div>

        {/* Aircraft assignment */}
        <div className="glass-card p-3 mb-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-gray-400 text-xs">Assigned Aircraft</div>
            <button
              type="button"
              onClick={() => { setShowBuyPanel(v => !v); setAircraftActionError(null); }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showBuyPanel ? 'Hide shop' : '+ Buy new'}
            </button>
          </div>
          {aircraftActionError && (
            <div className="mb-2 rounded border border-red-700 bg-red-900/30 px-2 py-1.5 text-xs text-red-300">
              {aircraftActionError}
            </div>
          )}
          {assignedAircraft ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-medium">{assignedAircraft.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUnassign}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Unassign
                  </button>
                  <button
                    onClick={handleSellAssignedAircraft}
                    onMouseLeave={() => setConfirmSellAircraft(false)}
                    className={`text-xs transition-colors ${
                      confirmSellAircraft ? 'text-red-300 hover:text-red-200' : 'text-gray-500 hover:text-red-400'
                    }`}
                  >
                    {confirmSellAircraft ? 'Confirm remove' : 'Remove plane'}
                  </button>
                </div>
              </div>
              {assignedType && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
                  <span>{assignedType.model}</span>
                  <span>{assignedType.seatsEconomy}Y{assignedType.seatsBusiness > 0 ? `/${assignedType.seatsBusiness}J` : ''}</span>
                  <span>Value {formatCurrency(computeAircraftValue(assignedAircraft, assignedType, gameDay))}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-700 rounded overflow-hidden">
                  <div
                    className={`h-full ${conditionColor}`}
                    style={{ width: `${Math.max(0, Math.min(100, assignedAircraft.condition))}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-16 text-right">
                  Condition {Math.round(assignedAircraft.condition)}%
                </span>
              </div>
              {assignedAircraft.isGrounded && (
                <div className="text-yellow-400 text-xs">Grounded — route inactive until maintained</div>
              )}
              {assignedRunwayLimited && assignedType && (
                <div className="text-red-400 text-xs">
                  Runway too short for {assignedType.model}; requires {formatRunwayLength(assignedType.minRunwayM)}.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-500 text-xs">No aircraft assigned — route is inactive.</p>
              {eligibleAircraft.length === 0 ? (
                <p className="text-gray-600 text-xs italic">
                  No available aircraft with sufficient range and runway compatibility.
                </p>
              ) : (
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) handleAssign(e.target.value); }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>Assign an aircraft…</option>
                  {eligibleAircraft.map(ac => {
                    const type = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
                    const status = ac.assignedRouteId ? 'on another route' : 'idle';
                    return (
                      <option key={ac.id} value={ac.id}>
                        {ac.name}{type ? ` (${type.model})` : ''} — {status}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {showBuyPanel && (
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-slate-950/25">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-400">
                <span>Cash: <span className="font-semibold text-white">{formatCurrency(playerCash)}</span></span>
                <span>{Math.round(route.distanceKm).toLocaleString()} km route</span>
              </div>
              <div className="flex flex-col sm:flex-row h-[22rem] sm:h-56">
                <div className="w-full sm:w-36 shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 overflow-x-auto sm:overflow-y-auto py-1 bg-white/[0.025] flex sm:block scrollbar-none">
                  {buyMfrs.map(mfr => (
                    <button
                      key={mfr}
                      type="button"
                      onClick={() => setBuyMfr(mfr)}
                      className={`shrink-0 sm:w-full text-left px-3 sm:px-2 py-2 sm:py-1.5 text-xs transition-colors ${
                        buyMfr === mfr
                          ? 'bg-white/[0.12] text-white font-semibold'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.07]'
                      }`}
                    >
                      {mfr === ALL_MANUFACTURERS ? 'All' : (
                        <><span className="mr-1">{manufacturerFlag(mfr)}</span>{mfr}</>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-white/10">
                  {shopVisible.map(type => {
                    const fitsRange = type.rangeKm >= route.distanceKm;
                    const fitsRunway = canAirportHandleAircraft(origin, type) && canAirportHandleAircraft(destination, type);
                    const fits = fitsRange && fitsRunway;
                    const canAfford = playerCash >= type.purchasePrice;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        disabled={!fits || !canAfford}
                        onClick={() => handleBuyAndAssign(type)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                          !fits || !canAfford
                            ? 'cursor-not-allowed opacity-45'
                            : 'hover:bg-white/[0.07]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-white">{type.model}</span>
                            {!fitsRange && <span className="rounded bg-red-900/40 px-1 text-[10px] text-red-400">out of range</span>}
                            {fitsRange && !fitsRunway && <span className="rounded bg-red-900/40 px-1 text-[10px] text-red-400">runway too short</span>}
                            {fits && <span className="rounded bg-green-900/40 px-1 text-[10px] text-green-400">fits</span>}
                          </div>
                          <div className="text-xs text-gray-500">
                            {type.seatsEconomy}Y{type.seatsBusiness > 0 ? `/${type.seatsBusiness}J` : ''} · {type.rangeKm.toLocaleString()} km · {formatRunwayLength(type.minRunwayM)}
                          </div>
                        </div>
                        <div className={`shrink-0 text-right text-xs font-semibold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(type.purchasePrice)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Editable fields */}
        <div className="space-y-4 mb-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Pricing</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOptimiseRoute}
                  disabled={!assignedAircraft || !assignedType || assignedRunwayLimited || !optimisationChanges}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                >
                  {optimisationChanges ? 'Optimise' : 'Optimised'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPriceEconomy(referencePrice); setPriceBusiness(hasBusinessSeats ? referencePrice * 4 : 0); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ↺ Reset to suggested ({formatCurrency(referencePrice)}{hasBusinessSeats ? ` / ${formatCurrency(referencePrice * 4)}` : ''})
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Economy (max {formatCurrency(maxEco)})</label>
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
                  <span>{formatCurrency(0)}</span>
                  <span>Suggested {formatCurrency(referencePrice)}</span>
                  <span>{formatCurrency(maxEco)}</span>
                </div>
              </div>
              <div className={!hasBusinessSeats ? 'opacity-60' : ''}>
                <label className="text-gray-400 text-xs block mb-1">
                  Business {hasBusinessSeats ? `(max ${formatCurrency(maxBiz)})` : '(no business seats)'}
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
                  <span>{formatCurrency(0)}</span>
                  {hasBusinessSeats && <span>Suggested {formatCurrency(referencePrice * 4)}</span>}
                  <span>{formatCurrency(maxBiz)}</span>
                </div>
                {!hasBusinessSeats && (
                  <p className="text-[10px] text-gray-500 mt-1">Assigned aircraft has no business cabin.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-1">
              Flights per Week: <span className="text-white font-semibold">{flightsPerWeek}</span>
            </label>
            <input
              type="range" min={1} max={21} step={1}
              className="w-full accent-blue-500"
              value={flightsPerWeek}
              onChange={e => setFlightsPerWeek(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
              <span>1</span><span>21</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col min-[420px]:flex-row gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Save Changes
          </button>
          <button
            onClick={handleToggleActive}
            disabled={!route.isActive && assignedRunwayLimited}
            className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors text-sm ${
              !route.isActive && assignedRunwayLimited
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                :
              route.isActive
                ? 'bg-yellow-700 hover:bg-yellow-600 text-yellow-100'
                : 'bg-green-700 hover:bg-green-600 text-green-100'
            }`}
          >
            {route.isActive ? 'Suspend' : 'Activate'}
          </button>
          <button
            onClick={handleDelete}
            onMouseLeave={() => setConfirmDelete(false)}
            className={`px-4 py-2.5 font-semibold rounded-lg transition-colors text-sm ${
              confirmDelete
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {confirmDelete ? 'Confirm' : 'Delete'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};
