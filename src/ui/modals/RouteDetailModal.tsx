import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { PriceInput } from '@/ui/components/PriceInput';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { computeFlightCost } from '@/engine/economicsEngine';
import { FUEL_PRICE_USD_PER_LITER } from '@/utils/constants';

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

  const assignedAircraft = route.aircraftId ? aircraft[route.aircraftId] : null;
  const origin      = airports[route.originIata];
  const destination = airports[route.destinationIata];

  // Reference price: cost-per-seat × 1.4, or distance-based fallback
  const assignedType = assignedAircraft ? AIRCRAFT_TYPES.find(t => t.id === assignedAircraft.typeId) : null;
  const referencePrice = (() => {
    if (assignedAircraft && assignedType && origin && destination) {
      const costs = computeFlightCost(route, assignedAircraft, assignedType, origin, destination, FUEL_PRICE_USD_PER_LITER);
      const totalSeats = assignedType.seatsEconomy + assignedType.seatsBusiness;
      return totalSeats > 0 ? Math.round(costs.totalCost / totalSeats * 1.4) : Math.round(route.distanceKm * 0.12);
    }
    return Math.round(route.distanceKm * 0.12);
  })();
  const maxEco = referencePrice * 6;
  const maxBiz = referencePrice * 24;

  // Aircraft eligible for this route: not in maintenance/crashed, range sufficient
  const eligibleAircraft = Object.values(aircraft).filter(ac => {
    if (ac.airlineId !== 'player') return false;
    if (ac.status === 'maintenance' || ac.status === 'crashed') return false;
    if (ac.id === route.aircraftId) return false; // already assigned
    const type = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
    return type && type.rangeKm >= route.distanceKm;
  });

  const conditionColor =
    (assignedAircraft?.condition ?? 100) >= 70 ? 'bg-green-500'
    : (assignedAircraft?.condition ?? 100) >= 40 ? 'bg-yellow-500'
    : 'bg-red-500';

  function handleSave() {
    if (!routeId) return;
    updateRoute(routeId, { priceEconomy, priceBusiness, flightsPerWeek });
  }

  function handleToggleActive() {
    if (!routeId) return;
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
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-xl px-4 sm:px-6 py-4 shadow-2xl w-full max-w-lg relative max-h-[92svh] sm:max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-xl leading-none"
        >
          ×
        </button>

        <h2 className="text-xl font-bold text-white mb-1">Route Detail</h2>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-blue-400 font-mono font-bold text-lg">{route.originIata}</span>
          <span className="text-gray-400">→</span>
          <span className="text-blue-400 font-mono font-bold text-lg">{route.destinationIata}</span>
          {origin && destination && (
            <span className="text-gray-500 text-sm ml-1">{origin.city} → {destination.city}</span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Distance</div>
            <div className="text-white font-semibold">{Math.round(route.distanceKm).toLocaleString()} km</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Daily Revenue</div>
            <div className="text-green-400 font-semibold">{formatCurrency(route.dailyRevenue)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Daily Cost</div>
            <div className="text-red-400 font-semibold">{formatCurrency(route.dailyCost)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className={`text-xs mb-1 text-gray-400`}>Daily Profit</div>
            <div className={`font-bold ${route.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(route.dailyProfit)}
            </div>
          </div>
        </div>

        {/* Load factors */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4 space-y-2">
          <div className="text-gray-400 text-xs mb-2">Load Factors</div>
          <LoadFactorBar value={route.loadFactorEconomy}  label="Eco" />
          <LoadFactorBar value={route.loadFactorBusiness} label="Biz" />
        </div>

        {/* Aircraft assignment */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4">
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
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-500 text-xs">No aircraft assigned — route is inactive.</p>
              {eligibleAircraft.length === 0 ? (
                <p className="text-gray-600 text-xs italic">
                  No available aircraft with sufficient range ({Math.round(route.distanceKm).toLocaleString()} km).
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
            <div className="grid grid-cols-2 gap-3">
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
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Save Changes
          </button>
          <button
            onClick={handleToggleActive}
            className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors text-sm ${
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
  );
};
