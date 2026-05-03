import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';

export const RouteDetailModal: React.FC = () => {
  const routes = useGameStore(s => s.routes);
  const aircraft = useGameStore(s => s.aircraft);
  const airports = useGameStore(s => s.airports);
  const modalPayload = useGameStore(s => s.modalPayload);
  const selectedRouteId = useGameStore(s => s.selectedRouteId);
  const closeModal = useGameStore(s => s.closeModal);
  const selectRoute = useGameStore(s => s.selectRoute);
  const updateRoute = useGameStore(s => s.updateRoute);

  const routeId = (modalPayload as string | null) ?? selectedRouteId;
  const route = routeId ? routes[routeId] : null;

  const [priceEconomy, setPriceEconomy] = useState(route?.priceEconomy ?? 0);
  const [priceBusiness, setPriceBusiness] = useState(route?.priceBusiness ?? 0);
  const [flightsPerWeek, setFlightsPerWeek] = useState(route?.flightsPerWeek ?? 7);

  useEffect(() => {
    if (route) {
      setPriceEconomy(route.priceEconomy);
      setPriceBusiness(route.priceBusiness);
      setFlightsPerWeek(route.flightsPerWeek);
    }
  }, [routeId]);

  if (!route) return null;

  const assignedAircraft = route.aircraftId ? aircraft[route.aircraftId] : null;
  const origin = airports[route.originIata];
  const destination = airports[route.destinationIata];

  const conditionColor =
    (assignedAircraft?.condition ?? 100) >= 70
      ? 'bg-green-500'
      : (assignedAircraft?.condition ?? 100) >= 40
      ? 'bg-yellow-500'
      : 'bg-red-500';

  function handleSave() {
    if (!routeId) return;
    updateRoute(routeId, { priceEconomy, priceBusiness, flightsPerWeek });
  }

  function handleToggleActive() {
    if (!routeId) return;
    updateRoute(routeId, { isActive: !route!.isActive });
  }

  function handleClose() {
    closeModal();
    selectRoute(null);
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-2xl w-full max-w-lg relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="text-xl font-bold text-white mb-1">Route Detail</h2>

        {/* Origin → Destination */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-blue-400 font-mono font-bold text-lg">{route.originIata}</span>
          <span className="text-gray-400">→</span>
          <span className="text-blue-400 font-mono font-bold text-lg">{route.destinationIata}</span>
          {origin && destination && (
            <span className="text-gray-500 text-sm ml-1">
              {origin.name} → {destination.name}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Distance</div>
            <div className="text-white font-semibold">{Math.round(route.distanceKm).toLocaleString()} km</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Aircraft</div>
            <div className="text-white font-semibold text-sm truncate">
              {assignedAircraft ? assignedAircraft.name : <span className="text-gray-500">None assigned</span>}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Daily Revenue</div>
            <div className="text-green-400 font-semibold">{formatCurrency(route.dailyRevenue)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Daily Cost</div>
            <div className="text-red-400 font-semibold">{formatCurrency(route.dailyCost)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 col-span-2">
            <div className="text-gray-400 text-xs mb-1">Daily Profit</div>
            <div className={`font-bold text-lg ${route.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(route.dailyProfit)}
            </div>
          </div>
        </div>

        {/* Load factors */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4 space-y-2">
          <div className="text-gray-400 text-xs mb-2">Load Factors</div>
          <LoadFactorBar value={route.loadFactorEconomy} label="Eco" />
          <LoadFactorBar value={route.loadFactorBusiness} label="Biz" />
        </div>

        {/* Aircraft condition */}
        {assignedAircraft && (
          <div className="bg-gray-800 rounded-lg p-3 mb-4">
            <div className="text-gray-400 text-xs mb-2">Aircraft Condition</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
                <div
                  className={`h-full ${conditionColor} transition-all`}
                  style={{ width: `${Math.max(0, Math.min(100, assignedAircraft.condition))}%` }}
                />
              </div>
              <span className="text-xs text-gray-300 w-10 text-right">
                {Math.round(assignedAircraft.condition)}%
              </span>
            </div>
            {assignedAircraft.isGrounded && (
              <div className="text-yellow-400 text-xs mt-1">Grounded for maintenance</div>
            )}
          </div>
        )}

        {/* Editable fields */}
        <div className="space-y-4 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 text-sm block mb-1">Economy Price ($)</label>
              <input
                type="number"
                min={1}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={priceEconomy}
                onChange={e => setPriceEconomy(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Business Price ($)</label>
              <input
                type="number"
                min={1}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={priceBusiness}
                onChange={e => setPriceBusiness(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-1">
              Flights per Week: <span className="text-white font-semibold">{flightsPerWeek}</span>
            </label>
            <input
              type="range"
              min={1}
              max={21}
              step={1}
              className="w-full accent-blue-500"
              value={flightsPerWeek}
              onChange={e => setFlightsPerWeek(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
              <span>1</span>
              <span>21</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
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
            {route.isActive ? 'Suspend Route' : 'Activate Route'}
          </button>
        </div>
      </div>
    </div>
  );
};
