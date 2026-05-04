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
  const [insolventOpen, setInsolventOpen] = useState(false);

  const playerAirline = airlines['player'];
  const getDailyPax = (a: { dailyStats: { passengers: number }[] }) => a.dailyStats.at(-1)?.passengers ?? 0;
  const totalPax = getDailyPax(playerAirline ?? { dailyStats: [] }) +
    Object.values(aiAirlines).reduce((s, a) => s + getDailyPax(a), 0);

  const allAI = Object.values(aiAirlines).map(a => ({ ...a, isPlayer: false }));
  const activeAI   = allAI.filter(a => !a.isInsolvent).sort((a, b) => getDailyPax(b) - getDailyPax(a));
  const insolventAI = allAI.filter(a => a.isInsolvent);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="panel-header flex shrink-0 items-center justify-between">
        <h2 className="text-white font-bold">Airlines</h2>
        <button onClick={closePanel} aria-label="Close" className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
      </div>

      {/* Player row — pinned above the scroll area */}
      {playerAirline && (() => {
        const share = totalPax > 0 ? (getDailyPax(playerAirline) / totalPax) * 100 : 0;
        return (
          <div className="border-b border-sky-300/20 bg-sky-400/[0.055] shrink-0">
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: playerAirline.color }} />
                  <span className="text-white text-sm font-medium truncate">
                    {playerAirline.name}
                    <span className="ml-1 text-xs text-blue-400">(You)</span>
                  </span>
                </div>
                <span className="text-gray-300 text-sm shrink-0">{share.toFixed(1)}%</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-700 rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${share}%`, backgroundColor: playerAirline.color }} />
              </div>
              <div className="mt-1.5 grid grid-cols-1 min-[380px]:grid-cols-3 gap-x-2 gap-y-0.5 text-xs text-gray-400">
                <span>Cash: <span className={playerAirline.cashUSD >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(playerAirline.cashUSD)}</span></span>
                <span>Fleet: <span className="text-white">{playerAirline.fleetIds.length}</span></span>
                <span>Routes: <span className="text-white">{playerAirline.routeIds.length}</span></span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Hub: {playerAirline.hubIatas.join(', ')} · Rep: {playerAirline.reputationScore.toFixed(0)}/100
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI airlines — scrollable */}
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {activeAI.map(airline => {
          const share = totalPax > 0 ? (getDailyPax(airline) / totalPax) * 100 : 0;
          const playerStake = (airline.shareholders ?? {})['player'] ?? 0;
          const hasMajority = playerStake >= 50;
          const isExpanded = expandedId === airline.id;

          const fleetEntries = airline.fleetIds.map(id => aiAircraft[id]).filter(Boolean);
          const routeEntries = airline.routeIds.map(id => aiRoutes[id]).filter(Boolean);
          const otherShareholders = Object.entries(airline.shareholders ?? {})
            .filter(([id, pct]) => id !== 'player' && pct > 0)
            .map(([id, pct]) => ({ name: aiAirlines[id]?.name ?? id, pct }));

          return (
            <div key={airline.id} className={`border-b border-gray-800 ${airline.isInsolvent ? 'opacity-50' : ''}`}>
              {/* Main row */}
              <div
                className="p-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : airline.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: airline.color }} />
                    <span className="text-white text-sm font-medium truncate">{airline.name}</span>
                    {playerStake > 0 && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        You: {playerStake.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-300 text-sm">{share.toFixed(1)}%</span>
                    <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                <div className="mt-1 h-1.5 bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{ width: `${share}%`, backgroundColor: airline.color }}
                  />
                </div>

                <div className="mt-1.5 grid grid-cols-1 min-[380px]:grid-cols-3 gap-x-2 gap-y-0.5 text-xs text-gray-400">
                  <span>Cash: <span className={airline.cashUSD >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(airline.cashUSD)}</span></span>
                  <span>Fleet: <span className="text-white">{airline.fleetIds.length}</span></span>
                  <span>Routes: <span className="text-white">{airline.routeIds.length}</span></span>
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  Hub: {airline.hubIatas.join(', ')} · Rep: {airline.reputationScore.toFixed(0)}/100
                  {airline.personality && <span className="ml-1 capitalize text-gray-600">· {airline.personality}</span>}
                </div>

                {/* Action buttons */}
                <div className="mt-2 flex flex-col min-[380px]:flex-row gap-1.5">
                  {!airline.isInsolvent && (
                    <button
                      onClick={e => { e.stopPropagation(); openModalById('sharesPurchase', airline.id); }}
                      className="flex-1 py-1 bg-teal-900/60 hover:bg-teal-800/80 text-teal-200 text-xs rounded transition-colors"
                    >
                      Shares{playerStake > 0 ? ` (${playerStake.toFixed(0)}%)` : ''}
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); openModalById('takeover', airline.id); }}
                    disabled={!hasMajority && !airline.isInsolvent}
                    title={hasMajority || airline.isInsolvent ? 'Acquire airline' : `Need 50% stake (you own ${playerStake.toFixed(0)}%)`}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      hasMajority || airline.isInsolvent
                        ? 'bg-indigo-700 hover:bg-indigo-600 text-indigo-100'
                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {airline.isInsolvent ? 'Buy Out' : hasMajority ? 'Take Over' : `Take Over (${playerStake.toFixed(0)}/50%)`}
                  </button>
                </div>
              </div>

              {/* Expanded fleet + routes inspector */}
              {isExpanded && (
                <div className="bg-gray-900/80 border-t border-gray-700/50 px-3 pb-3">

                  {/* Shareholders */}
                  {(playerStake > 0 || otherShareholders.length > 0) && (
                    <div className="pt-2 pb-2 border-b border-gray-700/50 mb-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Shareholders</div>
                      <div className="flex flex-wrap gap-1.5">
                        {playerStake > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25">
                            You {playerStake.toFixed(0)}%
                          </span>
                        )}
                        {otherShareholders.map(s => (
                          <span key={s.name} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                            {s.name} {s.pct.toFixed(0)}%
                          </span>
                        ))}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10">
                          Float {Math.max(0, 100 - playerStake - otherShareholders.reduce((s, x) => s + x.pct, 0)).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

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
        {/* Insolvent airlines accordion */}
        {insolventAI.length > 0 && (
          <div className="border-t border-gray-700">
          <button
            onClick={() => setInsolventOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors"
          >
            <span className="font-semibold uppercase tracking-wider">Bankrupt ({insolventAI.length})</span>
            <span>{insolventOpen ? '▲' : '▼'}</span>
          </button>
          {insolventOpen && (
            <div>
              {insolventAI.map(airline => (
                <div key={airline.id} className="px-3 py-2 border-b border-gray-800 opacity-50">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: airline.color }} />
                      <span className="text-gray-400 truncate">{airline.name}</span>
                    </div>
                    <span className="text-red-400 shrink-0 ml-2">{formatCurrency(airline.cashUSD)}</span>
                  </div>
                  <div className="text-gray-600 text-[10px] mt-0.5">
                    {airline.fleetIds.length} aircraft · {airline.routeIds.length} routes · Hub: {airline.hubIatas[0]}
                  </div>
                  <button
                    onClick={() => openModalById('takeover', airline.id)}
                    className="mt-1.5 w-full py-0.5 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-300 text-xs rounded transition-colors opacity-100"
                  >
                    Buy Out (distressed)
                  </button>
                </div>
              ))}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
};
