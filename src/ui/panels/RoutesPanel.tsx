import React from 'react';
import { useGameStore, type GameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { getRouteOptimisationChanges } from '@/engine/routeOptimizer';
import type { Route } from '@/types';

const OPTIMISE_ALL_BASE_COST = 2_000_000;
const OPTIMISE_ALL_COST_PER_ROUTE = 2_500_000;
const AIRCRAFT_TYPE_BY_ID = Object.fromEntries(AIRCRAFT_TYPES.map(type => [type.id, type]));

function buildOptimisationKey(state: GameStore): string {
  const parts: string[] = [];
  const player = state.airlines['player'];
  if (player) parts.push(`P:${player.reputationScore.toFixed(0)}:${player.hubIatas.join(',')}`);

  player?.routeIds.forEach(routeId => {
    const route = state.routes[routeId];
    if (!route) return;
    const ac = route.aircraftId ? state.aircraft[route.aircraftId] : null;
    parts.push([
      'R',
      route.id,
      route.originIata,
      route.destinationIata,
      route.aircraftId ?? '',
      route.flightsPerWeek,
      route.priceEconomy,
      route.priceBusiness,
      route.isActive ? 1 : 0,
      ac?.typeId ?? '',
      ac ? Math.floor(ac.condition / 5) : '',
    ].join(':'));
  });

  Object.values(state.aiRoutes).forEach(route => {
    if (!route.isActive) return;
    const airline = state.aiAirlines[route.airlineId];
    parts.push([
      'A',
      route.originIata,
      route.destinationIata,
      route.priceEconomy,
      route.priceBusiness,
      airline?.reputationScore.toFixed(0) ?? '',
    ].join(':'));
  });

  parts.push(`F:${state.globalFuelPrice.toFixed(3)}`);
  parts.push(`M:${Math.floor(state.gameDay / 30)}`);
  return parts.join('|');
}

function calculateOptimisationUpdates(state: GameStore): { updates: Record<string, Partial<Route>>; eligibleCount: number } {
  const updates: Record<string, Partial<Route>> = {};
  let eligibleCount = 0;
  const playerRoutes = Object.values(state.routes).filter(route => route.airlineId === 'player');
  const competitorAirlines = { ...state.airlines, ...state.aiAirlines };
  const competitorRoutes = [...Object.values(state.routes), ...Object.values(state.aiRoutes)];

  playerRoutes.forEach(route => {
    const ac = route.aircraftId ? state.aircraft[route.aircraftId] : null;
    const type = ac ? AIRCRAFT_TYPE_BY_ID[ac.typeId] : null;
    const origin = state.airports[route.originIata];
    const destination = state.airports[route.destinationIata];
    if (!ac || !type || !origin || !destination) return;
    eligibleCount += 1;

    const changes = getRouteOptimisationChanges({
      route,
      aircraft: ac,
      aircraftType: type,
      origin,
      destination,
      globalFuelPrice: state.globalFuelPrice,
      playerAirline: state.airlines['player'],
      competitorAirlines,
      competitorRoutes,
      airportDailyPax: state.airportDailyPax,
      gameDay: state.gameDay,
    });

    if (changes) updates[route.id] = changes;
  });

  return { updates, eligibleCount };
}

export const RoutesPanel: React.FC = () => {
  const routes = useGameStore(s => s.routes);
  const aircraft = useGameStore(s => s.aircraft);
  const playerCash = useGameStore(s => s.airlines['player']?.cashUSD ?? 0);
  const optimisationKey = useGameStore(buildOptimisationKey);
  const openModalById = useGameStore(s => s.openModalById);
  const selectRoute = useGameStore(s => s.selectRoute);
  const deleteRoute = useGameStore(s => s.deleteRoute);
  const applyRouteOptimisation = useGameStore(s => s.applyRouteOptimisation);
  const closePanel  = useGameStore(s => s.closePanel);

  const playerRoutes = Object.values(routes).filter(r => r.airlineId === 'player');
  const activeRouteCount = playerRoutes.filter(route => route.isActive).length;
  const inactiveRouteCount = playerRoutes.length - activeRouteCount;
  const optimisationUpdates = React.useMemo(() => {
    void optimisationKey;
    return calculateOptimisationUpdates(useGameStore.getState());
  }, [optimisationKey]);

  const optimisableCount = Object.keys(optimisationUpdates.updates).length;
  const optimiseAllCost = optimisableCount > 0
    ? OPTIMISE_ALL_BASE_COST + optimisableCount * OPTIMISE_ALL_COST_PER_ROUTE
    : 0;
  const canOptimiseAll = optimisableCount > 0 && playerCash >= optimiseAllCost;

  function handleOptimiseAll() {
    const fresh = calculateOptimisationUpdates(useGameStore.getState());
    const freshCount = Object.keys(fresh.updates).length;
    const freshCost = freshCount > 0
      ? OPTIMISE_ALL_BASE_COST + freshCount * OPTIMISE_ALL_COST_PER_ROUTE
      : 0;
    const cash = useGameStore.getState().airlines['player']?.cashUSD ?? 0;
    if (freshCount === 0 || cash < freshCost) return;
    applyRouteOptimisation(fresh.updates, freshCost);
  }

  return (
    <div className="panel-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <div className="panel-header flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-white font-bold">Routes ({playerRoutes.length})</h2>
          {playerRoutes.length > 0 && (
            <div className={`mt-0.5 text-[11px] ${inactiveRouteCount > 0 ? 'text-yellow-300' : 'text-gray-500'}`}>
              {activeRouteCount} active{inactiveRouteCount > 0 ? ` · ${inactiveRouteCount} inactive` : ''}
            </div>
          )}
        </div>
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
          const assignedAircraft = route.aircraftId ? aircraft[route.aircraftId] : null;
          const inactiveReason = route.isActive
            ? null
            : !route.aircraftId
              ? 'No aircraft'
              : assignedAircraft?.status === 'crashed'
                ? 'Crashed'
                : assignedAircraft?.status === 'maintenance'
                  ? 'Maintenance'
                  : assignedAircraft?.isGrounded
                    ? 'Grounded'
                    : 'Inactive';

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
                  {inactiveReason && (
                    <span className="rounded border border-yellow-400/20 bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-200">
                      {inactiveReason}
                    </span>
                  )}
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
