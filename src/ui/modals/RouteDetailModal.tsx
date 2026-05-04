import React, { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { PriceInput } from '@/ui/components/PriceInput';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { computeFlightCost } from '@/engine/economicsEngine';
import { getPlayerMarketShare, getBaselineDailyPax, conditionDemandMod } from '@/engine/demandModel';
import { HUB_DEMAND_BONUS, REPUTATION_DEMAND_FACTOR } from '@/utils/constants';
import { canAirportHandleAircraft, formatRunwayLength } from '@/utils/runway';

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

  const routeId = (modalPayload as string | null) ?? selectedRouteId;
  const route   = routeId ? routes[routeId] : null;

  const [priceEconomy,   setPriceEconomy]   = useState(route?.priceEconomy   ?? 0);
  const [priceBusiness,  setPriceBusiness]  = useState(route?.priceBusiness  ?? 0);
  const [flightsPerWeek, setFlightsPerWeek] = useState(route?.flightsPerWeek ?? 7);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  useEffect(() => {
    if (route) {
      setPriceEconomy(route.priceEconomy);
      setPriceBusiness(route.priceBusiness);
      setFlightsPerWeek(route.flightsPerWeek);
    }
  }, [routeId]);

  if (!route) return null;

  const airlines    = useGameStore(s => s.airlines);
  const aiAirlines  = useGameStore(s => s.aiAirlines);
  const aiRoutes    = useGameStore(s => s.aiRoutes);
  const globalFuelPrice = useGameStore(s => s.globalFuelPrice);

  const assignedAircraft = route.aircraftId ? aircraft[route.aircraftId] : null;
  const origin      = airports[route.originIata];
  const destination = airports[route.destinationIata];

  // Reference price: cost-per-seat × 1.4, or distance-based fallback
  const assignedType = assignedAircraft ? AIRCRAFT_TYPES.find(t => t.id === assignedAircraft.typeId) : null;
  const referencePrice = (() => {
    if (assignedAircraft && assignedType && origin && destination) {
      const costs = computeFlightCost(route, assignedAircraft, assignedType, origin, destination, globalFuelPrice);
      const totalSeats = assignedType.seatsEconomy + assignedType.seatsBusiness;
      return totalSeats > 0 ? Math.round(costs.totalCost / totalSeats * 1.4) : Math.round(route.distanceKm * 0.12);
    }
    return Math.round(route.distanceKm * 0.12);
  })();
  const maxEco = referencePrice * 6;
  const maxBiz = referencePrice * 24;

  const preview = useMemo(() => {
    if (!assignedAircraft || !assignedType || !origin || !destination) return null;
    const allAirlines = [...Object.values(airlines), ...Object.values(aiAirlines)];
    const allRoutes   = [...Object.values(routes),   ...Object.values(aiRoutes)];
    const flightCosts = computeFlightCost(route, assignedAircraft, assignedType, origin, destination, globalFuelPrice);
    const flightsPerDay = flightsPerWeek / 7;
    const totalSeats  = assignedType.seatsEconomy + assignedType.seatsBusiness;
    const ecoRef      = totalSeats > 0 ? Math.round(flightCosts.totalCost / totalSeats * 1.3) : 200;
    const bizRef      = ecoRef * 4;
    const playerAirline = airlines['player'];
    const repMod = playerAirline ? 1 + (playerAirline.reputationScore - 50) * REPUTATION_DEMAND_FACTOR : 1;
    const condMod = conditionDemandMod(assignedAircraft.condition);
    const baselinePax = getBaselineDailyPax(origin, destination) * (origin.isHub || destination.isHub ? HUB_DEMAND_BONUS : 1);
    const ecoShare    = getPlayerMarketShare(route.originIata, route.destinationIata, priceEconomy, allAirlines, allRoutes, ecoRef);
    const ecoCapacity = assignedType.seatsEconomy * flightsPerDay;
    const ecoPax      = Math.min(ecoCapacity, Math.floor(baselinePax * 0.90 * ecoShare * repMod * condMod));
    const lfe         = ecoCapacity > 0 ? ecoPax / ecoCapacity : 0;
    const bizShare    = assignedType.seatsBusiness > 0
      ? getPlayerMarketShare(route.originIata, route.destinationIata, priceBusiness, allAirlines, allRoutes, bizRef, 'player', 'business')
      : 0;
    const bizCapacity = assignedType.seatsBusiness * flightsPerDay;
    const bizPax      = Math.min(bizCapacity, Math.floor(baselinePax * 0.10 * bizShare * repMod * condMod));
    const lfb         = bizCapacity > 0 ? bizPax / bizCapacity : 0;
    const dailyRevenue = ecoPax * priceEconomy + bizPax * priceBusiness;
    const dailyCost    = flightCosts.totalCost * flightsPerDay;
    return { lfe, lfb, dailyRevenue, dailyCost, dailyProfit: dailyRevenue - dailyCost };
  }, [priceEconomy, priceBusiness, flightsPerWeek, assignedAircraft, assignedType, origin, destination,
      routes, aiRoutes, airlines, aiAirlines, globalFuelPrice]);

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

  const conditionColor =
    (assignedAircraft?.condition ?? 100) >= 70 ? 'bg-green-500'
    : (assignedAircraft?.condition ?? 100) >= 40 ? 'bg-yellow-500'
    : 'bg-red-500';

  function handleSave() {
    if (!routeId) return;
    updateRoute(routeId, { priceEconomy, priceBusiness, flightsPerWeek });
    closeModal();
    selectRoute(null);
  }

  function handleToggleActive() {
    if (!routeId) return;
    if (!route.isActive && assignedRunwayLimited) return;
    updateRoute(routeId, { isActive: !route!.isActive });
  }

  function handleAssign(aircraftId: string) {
    if (!routeId) return;
    assignAircraftToRoute(aircraftId, routeId);
  }

  function handleUnassign() {
    if (!route?.aircraftId || !routeId) return;
    assignAircraftToRoute(route.aircraftId, null);
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
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-xl leading-none"
        >
          ×
        </button>

        <h2 className="text-xl font-bold text-white mb-1 pr-8">Route Detail</h2>

        <div className="flex items-center gap-2 pr-8">
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
          <div className="text-gray-400 text-xs mb-2">Assigned Aircraft</div>
          {assignedAircraft ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-medium">{assignedAircraft.name}</span>
                <button
                  onClick={handleUnassign}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Unassign
                </button>
              </div>
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
        </div>

        {/* Editable fields */}
        <div className="space-y-4 mb-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Pricing</span>
              <button
                type="button"
                onClick={() => { setPriceEconomy(referencePrice); setPriceBusiness(referencePrice * 4); }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                ↺ Reset to suggested ({formatCurrency(referencePrice)} / {formatCurrency(referencePrice * 4)})
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Economy (max {formatCurrency(maxEco)})</label>
                <PriceInput
                  value={priceEconomy} min={1} max={maxEco}
                  onChange={v => setPriceEconomy(v)}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Business (max {formatCurrency(maxBiz)})</label>
                <PriceInput
                  value={priceBusiness} min={1} max={maxBiz}
                  onChange={v => setPriceBusiness(v)}
                />
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
