import React, { useState } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';

const typeMap = Object.fromEntries(AIRCRAFT_TYPES.map(t => [t.id, t]));

function conditionColor(c: number): string {
  if (c >= 70) return 'bg-green-500';
  if (c >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

export const AirlinesPanel: React.FC = () => {
  const aiAirlines  = useGameStore(s => s.aiAirlines);
  const aiAircraft  = useGameStore(s => s.aiAircraft);
  const aiRoutes    = useGameStore(s => s.aiRoutes);
  const airports    = useGameStore(s => s.airports);
  const airlines    = useGameStore(s => s.airlines);
  const openModalById = useGameStore(s => s.openModalById);
  const closePanel    = useGameStore(s => s.closePanel);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const playerAirline = airlines['player'];
  const totalPax = (playerAirline?.totalPassengersAllTime ?? 0) +
    Object.values(aiAirlines).reduce((s, a) => s + a.totalPassengersAllTime, 0);

  const allAirlines = [
    ...(playerAirline ? [{ ...playerAirline, isPlayer: true }] : []),
    ...Object.values(aiAirlines).map(a => ({ ...a, isPlayer: false })),
  ].sort((a, b) => b.totalPassengersAllTime - a.totalPassengersAllTime);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-white font-bold">Airlines</h2>
        <button onClick={closePanel} aria-label="Close" className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {allAirlines.map(airline => {
          const share = totalPax > 0 ? (airline.totalPassengersAllTime / totalPax) * 100 : 0;

          const isExpanded = expandedId === airline.id;
          const isAI = !airline.isPlayer;

          // Gather aircraft and routes for this competitor
          const fleetEntries = isAI
            ? airline.fleetIds.map(id => aiAircraft[id]).filter(Boolean)
            : [];
          const routeEntries = isAI
            ? airline.routeIds.map(id => aiRoutes[id]).filter(Boolean)
            : [];

          return (
            <div key={airline.id} className={`border-b border-gray-800 ${airline.isInsolvent ? 'opacity-50' : ''}`}>
              {/* Main row */}
              <div
                className={`p-3 ${isAI ? 'cursor-pointer hover:bg-gray-800/50 transition-colors' : ''}`}
                onClick={() => isAI && setExpandedId(isExpanded ? null : airline.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: airline.color }} />
                    <span className="text-white text-sm font-medium truncate">
                      {airline.name}
                      {airline.isPlayer && <span className="ml-1 text-xs text-blue-400">(You)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-300 text-sm">{share.toFixed(1)}%</span>
                    {isAI && (
                      <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    )}
                  </div>
                </div>

                <div className="mt-1 h-1.5 bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{ width: `${share}%`, backgroundColor: airline.color }}
                  />
                </div>

                <div className="mt-1.5 grid grid-cols-3 gap-x-2 text-xs text-gray-400">
                  <span>Cash: <span className={airline.cashUSD >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(airline.cashUSD)}</span></span>
                  <span>Fleet: <span className="text-white">{airline.fleetIds.length}</span></span>
                  <span>Routes: <span className="text-white">{airline.routeIds.length}</span></span>
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  Hub: {airline.hubIatas.join(', ')} · Rep: {airline.reputationScore.toFixed(0)}/100
                  {airline.personality && <span className="ml-1 capitalize text-gray-600">· {airline.personality}</span>}
                </div>

                {isAI && !airline.isInsolvent && (
                  <button
                    onClick={e => { e.stopPropagation(); openModalById('takeover', airline.id); }}
                    className="mt-2 w-full py-1 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 text-xs rounded transition-colors"
                  >
                    Buy Out
                  </button>
                )}
                {airline.isInsolvent && (
                  <div className="mt-1 text-xs text-red-500">INSOLVENT</div>
                )}
              </div>

              {/* Expanded fleet + routes inspector */}
              {isExpanded && isAI && (
                <div className="bg-gray-900/80 border-t border-gray-700/50 px-3 pb-3">

                  {/* Fleet */}
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Fleet ({fleetEntries.length})
                    </div>
                    {fleetEntries.length === 0 ? (
                      <div className="text-xs text-gray-600 italic">No aircraft yet</div>
                    ) : (
                      <div className="space-y-1.5">
                        {fleetEntries.map(ac => {
                          const acType = typeMap[ac.typeId];
                          const route = ac.assignedRouteId ? aiRoutes[ac.assignedRouteId] : null;
                          const routeLabel = route
                            ? `${route.originIata} → ${route.destinationIata}`
                            : ac.isGrounded ? 'Grounded' : 'Unassigned';
                          return (
                            <div key={ac.id} className="bg-gray-800 rounded px-2 py-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-white font-medium">
                                  {acType ? `${acType.manufacturer} ${acType.model}` : ac.typeId}
                                </span>
                                <span className="text-gray-400">{routeLabel}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <div className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
                                  <div
                                    className={`h-full rounded ${conditionColor(ac.condition)}`}
                                    style={{ width: `${ac.condition}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-10 text-right">{ac.condition.toFixed(0)}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Routes */}
                  <div className="pt-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Routes ({routeEntries.length})
                    </div>
                    {routeEntries.length === 0 ? (
                      <div className="text-xs text-gray-600 italic">No routes yet</div>
                    ) : (
                      <div className="space-y-1">
                        {routeEntries.map(route => {
                          const orig = airports[route.originIata];
                          const dest = airports[route.destinationIata];
                          const label = orig && dest
                            ? `${orig.city} → ${dest.city}`
                            : `${route.originIata} → ${route.destinationIata}`;
                          const profitColor = route.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400';
                          return (
                            <div key={route.id} className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1">
                              <div className="min-w-0">
                                <div className="text-white truncate">{label}</div>
                                <div className="text-gray-500">
                                  {route.distanceKm.toFixed(0)} km · ${route.priceEconomy} eco
                                  {route.loadFactorEconomy > 0 && ` · ${(route.loadFactorEconomy * 100).toFixed(0)}% LF`}
                                </div>
                              </div>
                              <div className={`shrink-0 ml-2 font-medium ${profitColor}`}>
                                {route.dailyProfit !== 0 ? formatCurrency(route.dailyProfit) + '/d' : '—'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
