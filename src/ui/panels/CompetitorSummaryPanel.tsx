import React from 'react';
import { useGameStore } from '@/store';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { rawCompanyValue } from '@/engine/valuation';
import { AirlineLogo } from '@/ui/components/AirlineLogo';
import { formatCurrency, formatNumber } from '@/utils/format';

const typeMap = Object.fromEntries(AIRCRAFT_TYPES.map(t => [t.id, t]));

function pct(value: number): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

function conditionColor(condition: number): string {
  if (condition >= 70) return 'bg-green-500';
  if (condition >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'good' | 'bad' | 'muted';
}) {
  const toneClass =
    tone === 'good' ? 'text-green-400'
    : tone === 'bad' ? 'text-red-400'
    : tone === 'muted' ? 'text-gray-400'
    : 'text-white';

  return (
    <div className="glass-card p-3">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className={`font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

interface CompetitorSummaryPanelProps {
  airlineId: string;
  onBack: () => void;
}

export const CompetitorSummaryPanel: React.FC<CompetitorSummaryPanelProps> = ({ airlineId, onBack }) => {
  const airlines      = useGameStore(s => s.airlines);
  const aiAirlines    = useGameStore(s => s.aiAirlines);
  const aiAircraft    = useGameStore(s => s.aiAircraft);
  const aiRoutes      = useGameStore(s => s.aiRoutes);
  const airports      = useGameStore(s => s.airports);
  const openModalById = useGameStore(s => s.openModalById);
  const closePanel    = useGameStore(s => s.closePanel);

  const airline = aiAirlines[airlineId];
  const player = airlines['player'];

  if (!airline) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="panel-header flex shrink-0 items-center justify-between">
          <button onClick={onBack} className="text-gray-300 hover:text-white text-sm">← Back</button>
          <button onClick={closePanel} aria-label="Close" className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
        </div>
        <div className="p-4 text-sm text-gray-400">Airline no longer available.</div>
      </div>
    );
  }

  const getDailyPax = (a: { dailyStats: { passengers: number }[] }) => a.dailyStats.at(-1)?.passengers ?? 0;
  const totalPax = getDailyPax(player ?? { dailyStats: [] }) +
    Object.values(aiAirlines).reduce((sum, a) => sum + getDailyPax(a), 0);
  const dailyPassengers = getDailyPax(airline);
  const marketShare = totalPax > 0 ? (dailyPassengers / totalPax) * 100 : 0;

  const fleet = airline.fleetIds.map(id => aiAircraft[id]).filter(Boolean);
  const routes = airline.routeIds.map(id => aiRoutes[id]).filter(Boolean);
  const activeRoutes = routes.filter(route => route.isActive);
  const profitableRoutes = activeRoutes.filter(route => route.dailyProfit > 0).length;
  const losingRoutes = activeRoutes.filter(route => route.dailyProfit < 0).length;
  const routeProfit = routes.reduce((sum, route) => sum + route.dailyProfit, 0);
  const routeRevenue = routes.reduce((sum, route) => sum + route.dailyRevenue, 0);
  const routeCosts = Math.max(0, routeRevenue - routeProfit);
  const averageLoadFactor = activeRoutes.length > 0
    ? activeRoutes.reduce((sum, route) => sum + route.loadFactorEconomy, 0) / activeRoutes.length
    : 0;
  const averageCondition = fleet.length > 0
    ? fleet.reduce((sum, ac) => sum + ac.condition, 0) / fleet.length
    : 0;
  const groundedAircraft = fleet.filter(ac => ac.isGrounded || ac.status === 'maintenance').length;
  const snapshots = airline.dailyStats.slice(-30);
  const thirtyDayProfit = snapshots.reduce((sum, day) => sum + day.profit, 0);
  const thirtyDayRevenue = snapshots.reduce((sum, day) => sum + day.revenue, 0);
  const thirtyDayCosts = snapshots.reduce((sum, day) => sum + day.costs, 0);
  const margin = routeRevenue > 0 ? (routeProfit / routeRevenue) * 100 : 0;
  const companyValue = rawCompanyValue(airline, aiAircraft, aiRoutes);
  const pricePerPercent = companyValue / 100;
  const shareholders = airline.shareholders ?? {};
  const playerStake = shareholders['player'] ?? 0;
  const aiShareholders = Object.entries(shareholders)
    .filter(([id, share]) => id !== 'player' && share > 0)
    .map(([id, share]) => ({ id, name: aiAirlines[id]?.name ?? id, share }));
  const ownedShare = Object.values(shareholders).reduce((sum, share) => sum + share, 0);
  const marketFloat = Math.max(0, 100 - ownedShare);
  const topRoutes = [...routes]
    .sort((a, b) => b.dailyProfit - a.dailyProfit)
    .slice(0, 4);

  const profitTone = (airline.lastDailyProfit ?? routeProfit) >= 0 ? 'good' : 'bad';
  const cashTone = airline.cashUSD >= 0 ? 'good' : 'bad';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="panel-header flex shrink-0 items-center justify-between">
        <button onClick={onBack} className="text-gray-300 hover:text-white text-sm">← Back</button>
        <button onClick={closePanel} aria-label="Close" className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        <div className="flex items-center gap-3 py-3">
          <AirlineLogo logo={airline.logoEmoji} className="text-3xl" imageClassName="h-12 w-12 rounded-full object-cover border border-white/10 bg-white/10" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: airline.color }} />
              <h2 className="text-xl font-bold text-white truncate">{airline.name}</h2>
            </div>
            <p className="text-gray-400 text-sm capitalize">
              {airline.personality} airline · Hub: {airline.hubIatas.join(', ')}
              {airline.isInsolvent && <span className="ml-2 text-red-400">Bankrupt</span>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Market share" value={pct(marketShare)} />
          <StatCard label="Cash" value={formatCurrency(airline.cashUSD)} tone={cashTone} />
          <StatCard label="Debt" value={formatCurrency(airline.totalDebt)} tone={airline.totalDebt > 0 ? 'bad' : 'muted'} />
          <StatCard label="Reputation" value={`${airline.reputationScore.toFixed(0)}/100`} />
          <StatCard label="Daily profit/loss" value={formatCurrency(airline.lastDailyProfit ?? routeProfit)} tone={profitTone} />
          <StatCard label="Daily revenue" value={formatCurrency(routeRevenue)} tone="good" />
          <StatCard label="Daily costs" value={formatCurrency(routeCosts)} tone={routeCosts > routeRevenue ? 'bad' : 'muted'} />
          <StatCard label="Profit margin" value={pct(margin)} tone={margin >= 0 ? 'good' : 'bad'} />
        </div>

        <div className="glass-card p-3 mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Operations</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <div className="text-gray-500 text-xs">Fleet</div>
              <div className="text-white font-semibold">{fleet.length} aircraft</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Routes</div>
              <div className="text-white font-semibold">{activeRoutes.length} active</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Average condition</div>
              <div className={averageCondition >= 60 ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>{pct(averageCondition)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Grounded</div>
              <div className={groundedAircraft > 0 ? 'text-yellow-400 font-semibold' : 'text-gray-300 font-semibold'}>{groundedAircraft}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Load factor</div>
              <div className="text-white font-semibold">{pct(averageLoadFactor * 100)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Daily passengers</div>
              <div className="text-white font-semibold">{formatNumber(dailyPassengers)}</div>
            </div>
          </div>
        </div>

        <div className="glass-card p-3 mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Public valuation</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <div className="text-gray-500 text-xs">Company value</div>
              <div className="text-white font-semibold">{formatCurrency(companyValue)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Price per 1%</div>
              <div className="text-white font-semibold">{formatCurrency(pricePerPercent)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">30-day revenue</div>
              <div className="text-green-400 font-semibold">{formatCurrency(thirtyDayRevenue)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">30-day costs</div>
              <div className="text-gray-300 font-semibold">{formatCurrency(thirtyDayCosts)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">30-day net</div>
              <div className={thirtyDayProfit >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{formatCurrency(thirtyDayProfit)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">All-time passengers</div>
              <div className="text-white font-semibold">{formatNumber(airline.totalPassengersAllTime)}</div>
            </div>
          </div>
        </div>

        <div className="glass-card p-3 mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ownership</div>
          <div className="flex rounded overflow-hidden h-3">
            {playerStake > 0 && <div className="bg-teal-500" style={{ width: `${playerStake}%` }} title={`You: ${playerStake.toFixed(0)}%`} />}
            {aiShareholders.map(shareholder => (
              <div key={shareholder.id} className="bg-gray-500 opacity-70" style={{ width: `${shareholder.share}%` }} title={`${shareholder.name}: ${shareholder.share.toFixed(0)}%`} />
            ))}
            <div className="bg-gray-700 flex-1" title={`Float: ${marketFloat.toFixed(0)}%`} />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {playerStake > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                You {playerStake.toFixed(0)}%
              </span>
            )}
            {aiShareholders.map(shareholder => (
              <span key={shareholder.id} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                {shareholder.name} {shareholder.share.toFixed(0)}%
              </span>
            ))}
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10">
              Float {marketFloat.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="glass-card p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Route performance</div>
            <div className="text-xs text-gray-500">
              {profitableRoutes} profitable · {losingRoutes} losing
            </div>
          </div>
          {topRoutes.length === 0 ? (
            <div className="text-gray-500 text-xs italic">No active route data available</div>
          ) : (
            <div className="space-y-1.5">
              {topRoutes.map(route => {
                const origin = airports[route.originIata];
                const dest = airports[route.destinationIata];
                const routeLabel = origin && dest
                  ? `${origin.city} → ${dest.city}`
                  : `${route.originIata} → ${route.destinationIata}`;

                return (
                  <div key={route.id} className="flex items-center justify-between gap-3 rounded bg-white/5 px-2 py-1.5 text-xs">
                    <div className="min-w-0">
                      <div className="text-white truncate">{routeLabel}</div>
                      <div className="text-gray-500">
                        {route.originIata} → {route.destinationIata} · {pct(route.loadFactorEconomy * 100)} LF
                      </div>
                    </div>
                    <div className={`shrink-0 font-semibold ${route.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(route.dailyProfit)}/d
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {!airline.isInsolvent && (
            <button
              onClick={() => openModalById('sharesPurchase', airline.id)}
              className="w-full py-2 bg-teal-900/60 hover:bg-teal-800/80 text-teal-200 text-sm rounded transition-colors"
            >
              Trade Shares{playerStake > 0 ? ` (${playerStake.toFixed(0)}%)` : ''}
            </button>
          )}
          <button
            onClick={() => openModalById('takeover', airline.id)}
            disabled={playerStake < 50 && !airline.isInsolvent}
            title={playerStake >= 50 || airline.isInsolvent ? 'Acquire airline' : `Need 50% stake (you own ${playerStake.toFixed(0)}%)`}
            className={`w-full py-2 text-sm rounded transition-colors ${
              playerStake >= 50 || airline.isInsolvent
                ? 'bg-indigo-700 hover:bg-indigo-600 text-indigo-100'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            {airline.isInsolvent ? 'Buy Out' : playerStake >= 50 ? 'Take Over' : `Take Over (${playerStake.toFixed(0)}/50%)`}
          </button>
        </div>

        <details className="glass-card mt-3 overflow-hidden group">
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-300">
            <span>Fleet ({fleet.length})</span>
            <span className="text-gray-600 group-open:hidden">▼</span>
            <span className="hidden text-gray-600 group-open:inline">▲</span>
          </summary>

          <div className="border-t border-white/10 p-3 pt-2">
            {fleet.length === 0 ? (
              <div className="text-xs text-gray-600 italic">No aircraft in fleet</div>
            ) : (
              <div className="space-y-1.5">
                {fleet.map(ac => {
                  const acType = typeMap[ac.typeId];
                  const route = ac.assignedRouteId ? aiRoutes[ac.assignedRouteId] : null;
                  const routeLabel = route
                    ? `${route.originIata} → ${route.destinationIata}`
                    : ac.isGrounded ? 'Grounded' : 'Unassigned';
                  const statusLabel = ac.status === 'maintenance'
                    ? 'Maintenance'
                    : ac.isGrounded
                      ? ac.groundedReason ?? 'Grounded'
                      : ac.status.charAt(0).toUpperCase() + ac.status.slice(1);

                  return (
                    <div key={ac.id} className="rounded bg-white/5 px-2 py-1.5">
                      <div className="flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">
                            {acType ? `${acType.manufacturer} ${acType.model}` : ac.typeId}
                          </div>
                          <div className="mt-0.5 text-gray-500">
                            {routeLabel} · {statusLabel} · {Math.round(ac.totalFlightHours).toLocaleString()} hrs
                          </div>
                        </div>
                        <span className="shrink-0 text-gray-400">{ac.condition.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1.5 h-1 bg-gray-700 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${conditionColor(ac.condition)}`}
                          style={{ width: `${Math.max(0, Math.min(100, ac.condition))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
};
