import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { getRouteOptimisationChanges } from '@/engine/routeOptimizer';
import type { Route } from '@/types';

const OPTIMISE_ALL_BASE_COST = 2_000_000;
const OPTIMISE_ALL_COST_PER_ROUTE = 2_500_000;

export const RoutesPanel: React.FC = () => {
  const routes = useGameStore(s => s.routes);
  const airlines = useGameStore(s => s.airlines);
  const aircraft = useGameStore(s => s.aircraft);
  const airports = useGameStore(s => s.airports);
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const aiRoutes = useGameStore(s => s.aiRoutes);
  const globalFuelPrice = useGameStore(s => s.globalFuelPrice);
  const airportDailyPax = useGameStore(s => s.airportDailyPax);
  const gameDay = useGameStore(s => s.gameDay);
  const openModalById = useGameStore(s => s.openModalById);
  const selectRoute = useGameStore(s => s.selectRoute);
  const deleteRoute = useGameStore(s => s.deleteRoute);
  const applyRouteOptimisation = useGameStore(s => s.applyRouteOptimisation);
  const closePanel  = useGameStore(s => s.closePanel);

  const playerRoutes = Object.values(routes).filter(r => r.airlineId === 'player');
  const optimisationUpdates = React.useMemo(() => {
    const updates: Record<string, Partial<Route>> = {};
    let eligibleCount = 0;

    playerRoutes.forEach(route => {
      const ac = route.aircraftId ? aircraft[route.aircraftId] : null;
      const type = ac ? AIRCRAFT_TYPES.find(candidate => candidate.id === ac.typeId) : null;
      const origin = airports[route.originIata];
      const destination = airports[route.destinationIata];
      if (!ac || !type || !origin || !destination) return;
      eligibleCount += 1;

      const changes = getRouteOptimisationChanges({
        route,
        aircraft: ac,
        aircraftType: type,
        origin,
        destination,
        globalFuelPrice,
        playerAirline: airlines['player'],
        competitorAirlines: { ...airlines, ...aiAirlines },
        competitorRoutes: [...Object.values(routes), ...Object.values(aiRoutes)],
        airportDailyPax,
        gameDay,
      });

      if (changes) updates[route.id] = changes;
    });

    return { updates, eligibleCount };
  }, [playerRoutes, aircraft, airports, globalFuelPrice, airlines, aiAirlines, routes, aiRoutes, airportDailyPax, gameDay]);

  const optimisableCount = Object.keys(optimisationUpdates.updates).length;
  const optimiseAllCost = optimisableCount > 0
    ? OPTIMISE_ALL_BASE_COST + optimisableCount * OPTIMISE_ALL_COST_PER_ROUTE
    : 0;
  const playerCash = airlines['player']?.cashUSD ?? 0;
  const canOptimiseAll = optimisableCount > 0 && playerCash >= optimiseAllCost;

  function handleOptimiseAll() {
    if (!canOptimiseAll) return;
    applyRouteOptimisation(optimisationUpdates.updates, optimiseAllCost);
  }

  return (
    <div className="panel-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <div className="panel-header flex shrink-0 items-center justify-between">
        <h2 className="text-white font-bold">Routes ({playerRoutes.length})</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => openModalById('newRoute')}
            className="apple-button-primary"
          >
            + New Route
          </button>
          <button onClick={closePanel} aria-label="Close" className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
        </div>
      </div>

      <div className="flex-none overflow-visible">
        {playerRoutes.length > 0 && (
          <div className="p-3 border-b border-white/10 bg-white/[0.025]">
            <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-2">
              <div>
                <div className="text-gray-300 text-sm font-semibold">Network optimiser</div>
                <div className="text-xs text-gray-500">
                  {optimisableCount} routes can improve · {formatCurrency(optimiseAllCost)} consulting fee
                </div>
              </div>
              <button
                type="button"
                onClick={handleOptimiseAll}
                disabled={!canOptimiseAll}
                className="apple-button-primary px-3 py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Optimise all
              </button>
            </div>
            {optimisationUpdates.eligibleCount === 0 && (
              <div className="mt-1 text-[10px] text-gray-500">Assign aircraft to routes before optimising.</div>
            )}
            {optimisationUpdates.eligibleCount > 0 && optimisableCount === 0 && (
              <div className="mt-1 text-[10px] text-gray-500">All eligible routes are already optimised.</div>
            )}
            {optimisableCount > 0 && playerCash < optimiseAllCost && (
              <div className="mt-1 text-[10px] text-red-400">
                Need {formatCurrency(optimiseAllCost - playerCash)} more cash.
              </div>
            )}
          </div>
        )}
        {playerRoutes.length === 0 && (
          <div className="p-4 text-gray-400 text-sm text-center">
            No routes yet. Create your first route!
          </div>
        )}
        {playerRoutes.map(route => {
          const profitColor = route.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400';

          return (
            <div
              key={route.id}
              className="p-3 border-b border-white/10 hover:bg-white/[0.055] cursor-pointer transition-colors"
              onClick={() => { selectRoute(route.id); openModalById('routeDetail', route.id); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${route.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="text-white font-mono text-sm">
                    {route.originIata} {'->'} {route.destinationIata}
                  </span>
                </div>
                <span className={`text-sm font-medium text-right shrink-0 ${profitColor}`}>
                  {formatCurrency(route.dailyProfit)}/day
                </span>
              </div>

              <div className="mt-1 grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-3 text-xs text-gray-400">
                <span>Eco: {formatCurrency(route.priceEconomy)}</span>
                <span>Biz: {formatCurrency(route.priceBusiness)}</span>
                <span>Rev: {formatCurrency(route.dailyRevenue)}</span>
                <span>Cost: {formatCurrency(route.dailyCost)}</span>
              </div>

              <div className="mt-1.5 space-y-0.5">
                <LoadFactorBar value={route.loadFactorEconomy} label="Eco" />
                <LoadFactorBar value={route.loadFactorBusiness} label="Biz" />
              </div>

              <button
                onClick={e => { e.stopPropagation(); deleteRoute(route.id); }}
                className="mt-1 text-xs text-gray-600 hover:text-red-400"
              >
                Delete route
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
