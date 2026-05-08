import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';

export const CompetitorRouteModal: React.FC = () => {
  const aiRoutes    = useGameStore(s => s.aiRoutes);
  const aiAircraft  = useGameStore(s => s.aiAircraft);
  const aiAirlines  = useGameStore(s => s.aiAirlines);
  const airports    = useGameStore(s => s.airports);
  const modalPayload = useGameStore(s => s.modalPayload);
  const closeModal  = useGameStore(s => s.closeModal);

  const routeId = modalPayload as string | null;
  const route   = routeId ? aiRoutes[routeId] : null;

  if (!route) return null;

  const airline  = aiAirlines[route.airlineId];
  const ac       = route.aircraftId ? aiAircraft[route.aircraftId] : null;
  const acType   = ac ? AIRCRAFT_TYPES.find(t => t.id === ac.typeId) : null;
  const origin   = airports[route.originIata];
  const dest     = airports[route.destinationIata];

  const conditionColor =
    (ac?.condition ?? 100) >= 70 ? 'bg-green-500'
    : (ac?.condition ?? 100) >= 40 ? 'bg-yellow-500'
    : 'bg-red-500';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl px-4 sm:px-6 py-4 w-full max-w-lg relative max-h-[92svh] overflow-y-auto overscroll-contain">
        <button
          onClick={closeModal}
          aria-label="Close"
          className="absolute top-3 right-3 w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none"
        >
          ×
        </button>

        {/* Airline header */}
        {airline && (
          <div className="flex items-center gap-2 mb-3 pr-12">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: airline.color }} />
            <span className="text-gray-300 text-sm font-medium">{airline.name}</span>
            {airline.personality && (
              <span className="text-gray-600 text-xs capitalize">· {airline.personality}</span>
            )}
          </div>
        )}

        <h2 className="text-xl font-bold text-white mb-1">Competitor Route</h2>

        <div className="flex items-center gap-2 mb-4 pr-8">
          <span className="text-blue-400 font-mono font-bold text-lg">{route.originIata}</span>
          <span className="text-gray-400">→</span>
          <span className="text-blue-400 font-mono font-bold text-lg">{route.destinationIata}</span>
          {origin && dest && (
            <span className="text-gray-500 text-sm ml-1">{origin.city} → {dest.city}</span>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
          <div className="glass-card p-3">
            <div className="text-gray-400 text-xs mb-1">Distance</div>
            <div className="text-white font-semibold">{Math.round(route.distanceKm).toLocaleString()} km</div>
          </div>
          <div className="glass-card p-3">
            <div className="text-gray-400 text-xs mb-1">Economy Fare</div>
            <div className="text-white font-semibold">{formatCurrency(route.priceEconomy)}</div>
          </div>
          <div className="glass-card p-3">
            <div className="text-gray-400 text-xs mb-1">Daily Revenue</div>
            <div className="text-green-400 font-semibold">{formatCurrency(route.dailyRevenue)}</div>
          </div>
          <div className="glass-card p-3">
            <div className="text-gray-400 text-xs mb-1">Daily Profit</div>
            <div className={`font-bold ${route.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {route.dailyProfit !== 0 ? formatCurrency(route.dailyProfit) : '—'}
            </div>
          </div>
        </div>

        {/* Load factor */}
        <div className="glass-card p-3 mb-4">
          <div className="text-gray-400 text-xs mb-2">Load Factor</div>
          <LoadFactorBar value={route.loadFactorEconomy} label="Eco" />
        </div>

        {/* Aircraft */}
        <div className="glass-card p-3">
          <div className="text-gray-400 text-xs mb-2">Aircraft</div>
          {ac && acType ? (
            <div className="space-y-2">
              <div className="text-white text-sm font-medium">
                {acType.manufacturer} {acType.model}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-700 rounded overflow-hidden">
                  <div
                    className={`h-full ${conditionColor}`}
                    style={{ width: `${Math.max(0, Math.min(100, ac.condition))}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-20 text-right">
                  Condition {Math.round(ac.condition)}%
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {acType.seatsEconomy} eco · {acType.seatsBusiness} biz · {route.flightsPerWeek}×/wk
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-xs italic">No aircraft assigned</div>
          )}
        </div>
      </div>
    </div>
  );
};
