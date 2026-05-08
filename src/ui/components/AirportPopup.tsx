import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency, formatDistance, formatNumber } from '@/utils/format';
import { airportIcao } from '@/utils/airportSearch';
import { formatRunwayLength } from '@/utils/runway';
import { getAirportCapacity, airportSaturationMod, getBaselineDailyPax } from '@/engine/demandModel';
import { haversineKm } from '@/utils/geo';
import {
  MAX_FIRST_CLASS_LOUNGE_LEVEL,
  MAX_HUB_TERMINAL_LEVEL,
  getFirstClassLoungeLevel,
  getFirstClassLoungeUpgradeCost,
  getHubCapacityMultiplier,
  getHubDemandMultiplier,
  getHubTerminalLevel,
  getHubTerminalUpgradeCost,
} from '@/engine/hubUpgrades';

const AIRPORT_POPUP_ANIMATION_MS = 240;

export const AirportPopup: React.FC = () => {
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const selectedIata = useGameStore(s => s.selectedAirportIata);
  const airports = useGameStore(s => s.airports);
  const selectAirport = useGameStore(s => s.selectAirport);
  const airlines = useGameStore(s => s.airlines);
  const openModalById = useGameStore(s => s.openModalById);
  const designateHub = useGameStore(s => s.designateHub);
  const removeHub = useGameStore(s => s.removeHub);
  const upgradeHubTerminal = useGameStore(s => s.upgradeHubTerminal);
  const upgradeHubLounge = useGameStore(s => s.upgradeHubLounge);
  const gameDay = useGameStore(s => s.gameDay);
  const routes = useGameStore(s => s.routes);
  const aiRoutes = useGameStore(s => s.aiRoutes);
  const [displayedIata, setDisplayedIata] = useState(selectedIata);
  const [isVisible, setIsVisible] = useState(Boolean(selectedIata));
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (selectedIata) {
      setDisplayedIata(selectedIata);
      setDestinationsOpen(false);
      requestAnimationFrame(() => setIsVisible(true));
      return;
    }

    setIsVisible(false);
    closeTimerRef.current = setTimeout(() => {
      setDisplayedIata(null);
      closeTimerRef.current = null;
    }, AIRPORT_POPUP_ANIMATION_MS);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [selectedIata]);

  if (!displayedIata) return null;
  const airport = airports[displayedIata];
  if (!airport) return null;

  const playerAirline = airlines['player'];
  const isHub = airport.isHub;
  const playerHasHub = playerAirline?.hubIatas.includes(displayedIata);
  const isClosed = airport.closedUntilGameDay !== undefined && airport.closedUntilGameDay >= gameDay;

  const currentYear = 1960 + Math.floor(gameDay / 365);
  const dailyPax = [...Object.values(routes), ...Object.values(aiRoutes)]
    .filter(r => r.isActive && (r.originIata === displayedIata || r.destinationIata === displayedIata))
    .reduce((sum, r) => sum + (r.dailyPassengers ?? 0), 0);
  const capacity = getAirportCapacity(airport, currentYear);
  const utilization = dailyPax / capacity;
  const satMod = airportSaturationMod(utilization);
  const demandPct = Math.round(satMod * 100);
  const utilizationPct = Math.round(utilization * 100);
  const demandBarColor = satMod > 0.8 ? 'bg-green-500' : satMod > 0.55 ? 'bg-yellow-500' : 'bg-red-500';
  const utilizationBarColor = utilization <= 0.5 ? 'bg-green-500' : utilization <= 1 ? 'bg-yellow-500' : 'bg-red-500';
  const allRoutes = [...Object.values(routes), ...Object.values(aiRoutes)];
  const desiredDestinations = Object.values(airports)
    .filter(dest => dest.iata !== displayedIata)
    .map(dest => {
      const baselinePax = getBaselineDailyPax(airport, dest);
      const distanceKm = haversineKm(airport.lat, airport.lon, dest.lat, dest.lon);
      const existingRoutes = allRoutes.filter(r =>
        r.isActive &&
        ((r.originIata === displayedIata && r.destinationIata === dest.iata) ||
         (r.originIata === dest.iata && r.destinationIata === displayedIata)),
      );
      const bestRoute = existingRoutes.reduce<typeof existingRoutes[number] | null>(
        (best, route) => !best || route.dailyProfit > best.dailyProfit ? route : best,
        null,
      );
      const distanceYield = 150 + Math.sqrt(Math.max(250, distanceKm)) * 18;
      const estimatedValue = baselinePax * distanceYield;
      const score = bestRoute?.dailyProfit ?? estimatedValue;
      return { dest, baselinePax, distanceKm, bestRoute, score };
    })
    .filter(item => item.baselinePax >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
  const terminalLevel = getHubTerminalLevel(airport);
  const loungeLevel = getFirstClassLoungeLevel(airport);
  const terminalUpgradeCost = getHubTerminalUpgradeCost(airport);
  const loungeUpgradeCost = getFirstClassLoungeUpgradeCost(airport);
  const canAffordTerminal = terminalUpgradeCost !== null && (playerAirline?.cashUSD ?? 0) >= terminalUpgradeCost;
  const canAffordLounge = loungeUpgradeCost !== null && (playerAirline?.cashUSD ?? 0) >= loungeUpgradeCost;

  return (
    <div className={`absolute inset-x-2 bottom-2 max-h-[calc(100%-1rem)] sm:inset-x-auto sm:left-4 z-[800] glass-panel rounded-2xl sm:rounded-xl w-auto overflow-hidden flex flex-col transition-[width,max-height,transform,opacity] duration-300 ease-in-out will-change-transform ${
      destinationsOpen ? 'sm:top-2 sm:bottom-12 sm:w-[30rem] sm:max-h-none' : 'sm:top-auto sm:bottom-12 sm:w-64 sm:max-h-[48svh]'
    } ${
      isVisible
        ? 'pointer-events-auto translate-y-0 opacity-100 sm:translate-x-0'
        : 'pointer-events-none translate-y-6 opacity-0 sm:-translate-x-6 sm:translate-y-0'
    }`}>
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

        {playerHasHub && (
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2">
            <div className="mb-2 text-xs font-semibold text-amber-200">Hub upgrades</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div>
                  <div className="text-gray-200">Terminal {terminalLevel}/{MAX_HUB_TERMINAL_LEVEL}</div>
                  <div className="text-[10px] text-gray-500">Capacity x{getHubCapacityMultiplier(airport).toFixed(2)}</div>
                </div>
                <button
                  type="button"
                  disabled={terminalUpgradeCost === null || !canAffordTerminal}
                  onClick={() => upgradeHubTerminal(displayedIata)}
                  className="apple-button disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {terminalUpgradeCost === null ? 'Max' : formatCurrency(terminalUpgradeCost)}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div>
                  <div className="text-gray-200">First class lounges {loungeLevel}/{MAX_FIRST_CLASS_LOUNGE_LEVEL}</div>
                  <div className="text-[10px] text-gray-500">Demand x{getHubDemandMultiplier(airport).toFixed(2)}</div>
                </div>
                <button
                  type="button"
                  disabled={loungeUpgradeCost === null || !canAffordLounge}
                  onClick={() => upgradeHubLounge(displayedIata)}
                  className="apple-button disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loungeUpgradeCost === null ? 'Max' : formatCurrency(loungeUpgradeCost)}
                </button>
              </div>
            </div>
          </div>
        )}

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
          <div
            aria-hidden={!destinationsOpen}
            className={`overflow-hidden border-t border-white/10 transition-[max-height,opacity] duration-300 ease-in-out ${
              destinationsOpen ? 'max-h-[48svh] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="panel-scroll max-h-[48svh] space-y-1 overflow-y-auto overscroll-contain px-2 py-2 sm:grid sm:grid-flow-col sm:grid-rows-8 sm:auto-cols-fr sm:gap-1.5 sm:space-y-0">
              {desiredDestinations.map(item => (
                <button
                  key={item.dest.iata}
                  type="button"
                  onClick={() => openModalById('newRoute', { originIata: displayedIata, destinationIata: item.dest.iata })}
                  className="rounded bg-white/[0.04] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-sky-400/70"
                  title={`Create route to ${item.dest.city}`}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-0.5 text-xs">
                    <span className="min-w-0 truncate text-white">
                      {item.dest.iata} · {item.dest.city}
                    </span>
                    <span className={`shrink-0 text-right leading-tight ${item.bestRoute && item.bestRoute.dailyProfit > 0 ? 'text-green-400' : 'text-sky-300'}`}>
                      {formatNumber(item.baselinePax)} pax/d
                    </span>
                    <span className="min-w-0 truncate text-[10px] text-gray-500">{formatDistance(item.distanceKm)} · {item.dest.size}</span>
                    {item.bestRoute ? (
                      <span className={`shrink-0 text-right text-[10px] ${item.bestRoute.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(item.bestRoute.dailyProfit)}/d live
                      </span>
                    ) : (
                      <span className="shrink-0 text-right text-[10px] text-gray-500">{formatCurrency(item.score)}/d potential</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 p-3 pt-2 flex flex-col min-[380px]:flex-row gap-2">
        <button
          onClick={() => openModalById('newRoute', displayedIata)}
          className="apple-button-primary flex-1 py-1"
        >
          + New Route
        </button>
        {!playerHasHub ? (
          <button
            onClick={() => { designateHub(displayedIata); }}
            className="apple-button flex-1 py-1 border-yellow-300/20 bg-yellow-500/20 text-yellow-100"
          >
            Set Hub
          </button>
        ) : (
          <button
            onClick={() => { removeHub(displayedIata); }}
            className="apple-button flex-1 py-1"
          >
            Remove Hub
          </button>
        )}
      </div>
    </div>
  );
};
