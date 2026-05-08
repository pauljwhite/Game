import React, { useState } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency, formatDistance, formatNumber } from '@/utils/format';
import { airportIcao } from '@/utils/airportSearch';
import { formatRunwayLength } from '@/utils/runway';
import { getAirportCapacity, airportSaturationMod, getBaselineDailyPax } from '@/engine/demandModel';
import { haversineKm } from '@/utils/geo';

export const AirportPopup: React.FC = () => {
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const selectedIata = useGameStore(s => s.selectedAirportIata);
  const airports = useGameStore(s => s.airports);
  const selectAirport = useGameStore(s => s.selectAirport);
  const airlines = useGameStore(s => s.airlines);
  const openModalById = useGameStore(s => s.openModalById);
  const designateHub = useGameStore(s => s.designateHub);
  const removeHub = useGameStore(s => s.removeHub);
  const gameDay = useGameStore(s => s.gameDay);
  const routes = useGameStore(s => s.routes);
  const aiRoutes = useGameStore(s => s.aiRoutes);

  if (!selectedIata) return null;
  const airport = airports[selectedIata];
  if (!airport) return null;

  const playerAirline = airlines['player'];
  const isHub = airport.isHub;
  const playerHasHub = playerAirline?.hubIatas.includes(selectedIata);
  const isClosed = airport.closedUntilGameDay !== undefined && airport.closedUntilGameDay >= gameDay;

  const currentYear = 1960 + Math.floor(gameDay / 365);
  const dailyPax = [...Object.values(routes), ...Object.values(aiRoutes)]
    .filter(r => r.isActive && (r.originIata === selectedIata || r.destinationIata === selectedIata))
    .reduce((sum, r) => sum + (r.dailyPassengers ?? 0), 0);
  const capacity = getAirportCapacity(airport.size, currentYear);
  const utilization = dailyPax / capacity;
  const satMod = airportSaturationMod(utilization);
  const demandPct = Math.round(satMod * 100);
  const utilizationPct = Math.round(utilization * 100);
  const demandBarColor = satMod > 0.8 ? 'bg-green-500' : satMod > 0.55 ? 'bg-yellow-500' : 'bg-red-500';
  const utilizationBarColor = utilization <= 0.5 ? 'bg-green-500' : utilization <= 1 ? 'bg-yellow-500' : 'bg-red-500';
  const allRoutes = [...Object.values(routes), ...Object.values(aiRoutes)];
  const desiredDestinations = Object.values(airports)
    .filter(dest => dest.iata !== selectedIata)
    .map(dest => {
      const baselinePax = getBaselineDailyPax(airport, dest);
      const distanceKm = haversineKm(airport.lat, airport.lon, dest.lat, dest.lon);
      const existingRoutes = allRoutes.filter(r =>
        r.isActive &&
        ((r.originIata === selectedIata && r.destinationIata === dest.iata) ||
         (r.originIata === dest.iata && r.destinationIata === selectedIata)),
      );
      const bestRoute = existingRoutes.reduce<typeof existingRoutes[number] | null>(
        (best, route) => !best || route.dailyProfit > best.dailyProfit ? route : best,
        null,
      );
      const estimatedValue = baselinePax * Math.max(250, distanceKm) * 0.08;
      const score = Math.max(estimatedValue, bestRoute?.dailyProfit ?? 0);
      return { dest, baselinePax, distanceKm, bestRoute, score };
    })
    .filter(item => item.baselinePax >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return (
    <div className="absolute inset-x-2 top-2 bottom-2 sm:inset-x-auto sm:top-auto sm:bottom-12 sm:left-4 z-[800] glass-panel rounded-2xl sm:rounded-xl w-auto sm:w-64 sm:max-h-[48svh] overflow-hidden flex flex-col">
      <div className="shrink-0 border-b border-white/10 p-3 pb-2">
        {isClosed && (
          <div className="mb-2 px-2 py-1.5 bg-red-900/50 border border-red-500/50 rounded-lg flex items-center gap-1.5">
            <span className="text-red-400 font-bold text-xs">CLOSED</span>
            <span className="text-red-300 text-xs">{airport.closureReason}</span>
          </div>
        )}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-white font-bold text-sm">{airport.name}</div>
            <div className="text-gray-400 text-xs">{airport.city}, {airport.country}</div>
          </div>
          <button
            onClick={() => selectAirport(null)}
            aria-label="Close"
            className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none shrink-0 ml-2"
          >
            ×
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span className="text-gray-400">IATA</span>
          <span className="text-white font-mono">{airport.iata}</span>
          <span className="text-gray-400">ICAO</span>
          <span className="text-white font-mono">{airportIcao(airport) ?? '-'}</span>
          <span className="text-gray-400">Size</span>
          <span className="text-white capitalize">{airport.size}</span>
          <span className="text-gray-400">Landing fee</span>
          <span className="text-white">{formatCurrency(airport.landingFee)}</span>
          <span className="text-gray-400">Runway</span>
          <span className="text-white">{formatRunwayLength(airport.longestRunwayM)}</span>
          <span className="text-gray-400">Region</span>
          <span className="text-white capitalize">{airport.region.replace('_', ' ')}</span>
          {isHub && (
            <>
              <span className="text-gray-400">Status</span>
              <span className="text-yellow-400">Hub</span>
            </>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-gray-400">Demand strength</span>
            <span className={demandPct > 80 ? 'text-green-400' : demandPct > 55 ? 'text-yellow-400' : 'text-red-400'}>
              {demandPct}%
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${demandBarColor}`} style={{ width: `${demandPct}%` }} />
          </div>

          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-gray-400">Airport utilisation</span>
            <span className={utilization <= 0.5 ? 'text-green-400' : utilization <= 1 ? 'text-yellow-400' : 'text-red-400'}>
              {utilizationPct}%
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${utilizationBarColor}`} style={{ width: `${Math.min(100, utilizationPct)}%` }} />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03]">
          <button
            type="button"
            onClick={() => setDestinationsOpen(open => !open)}
            aria-expanded={destinationsOpen}
            className="flex w-full items-center justify-between px-2 py-2 text-left text-xs font-semibold text-gray-200"
          >
            <span>Passenger destinations</span>
            <span className="text-gray-500">{destinationsOpen ? '▲' : '▼'}</span>
          </button>
          {destinationsOpen && (
            <div className="space-y-1 border-t border-white/10 px-2 py-2">
              {desiredDestinations.map(item => (
                <div key={item.dest.iata} className="rounded bg-white/[0.04] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-white">
                      {item.dest.iata} · {item.dest.city}
                    </span>
                    <span className={item.bestRoute && item.bestRoute.dailyProfit > 0 ? 'text-green-400' : 'text-sky-300'}>
                      {formatNumber(item.baselinePax)} pax/d
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-gray-500">
                    <span>{formatDistance(item.distanceKm)} · {item.dest.size}</span>
                    {item.bestRoute ? (
                      <span className={item.bestRoute.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency(item.bestRoute.dailyProfit)}/d live
                      </span>
                    ) : (
                      <span>{formatCurrency(item.score)}/d potential</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 p-3 pt-2 flex flex-col min-[380px]:flex-row gap-2">
        <button
          onClick={() => openModalById('newRoute', selectedIata)}
          className="apple-button-primary flex-1 py-1"
        >
          + New Route
        </button>
        {!playerHasHub ? (
          <button
            onClick={() => { designateHub(selectedIata); }}
            className="apple-button flex-1 py-1 border-yellow-300/20 bg-yellow-500/20 text-yellow-100"
          >
            Set Hub
          </button>
        ) : (
          <button
            onClick={() => { removeHub(selectedIata); }}
            className="apple-button flex-1 py-1"
          >
            Remove Hub
          </button>
        )}
      </div>
    </div>
  );
};
