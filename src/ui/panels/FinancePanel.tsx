import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { PnLChart } from '@/ui/components/PnLChart';

export const FinancePanel: React.FC = () => {
  const airlines   = useGameStore(s => s.airlines);
  const routes     = useGameStore(s => s.routes);
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const isDark     = useGameStore(s => s.themeMode) !== 'light';

  const closePanel = useGameStore(s => s.closePanel);
  const playerAirline = airlines['player'];
  if (!playerAirline) return null;

  const playerRoutes = Object.values(routes).filter(r => r.airlineId === 'player');
  const totalDailyRevenue = playerRoutes.reduce((s, r) => s + r.dailyRevenue, 0);
  const totalDailyCost = playerRoutes.reduce((s, r) => s + r.dailyCost, 0);
  const totalDailyProfit = totalDailyRevenue - totalDailyCost;

  const aiHoldings = Object.values(aiAirlines)
    .map(ai => ({ ai, stake: (ai.shareholders ?? {})['player'] ?? 0 }))
    .filter(({ stake }) => stake > 0);

  const dailyDividends = aiHoldings.reduce((sum, { ai, stake }) =>
    sum + (stake / 100) * Math.max(0, ai.lastDailyProfit ?? 0), 0);

  const dividendSources = aiHoldings
    .map(({ ai, stake }) => ({
      name: ai.name,
      stake,
      dividend: (stake / 100) * Math.max(0, ai.lastDailyProfit ?? 0),
      profit: ai.lastDailyProfit ?? 0,
    }))
    .sort((a, b) => b.dividend - a.dividend);

  return (
    <div className="panel-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <div className="panel-header flex shrink-0 items-center justify-between">
        <h2 className="text-white font-bold">Finance</h2>
        <button onClick={closePanel} aria-label="Close" className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
      </div>
      <div className="flex flex-none flex-col gap-4 p-3">

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Cash</div>
          <div className={`text-lg font-bold ${playerAirline.cashUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(playerAirline.cashUSD)}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Daily P&L</div>
          <div className={`text-lg font-bold ${(totalDailyProfit + dailyDividends) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(totalDailyProfit + dailyDividends)}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Total Passengers</div>
          <div className="text-white text-lg font-bold">
            {playerAirline.totalPassengersAllTime.toLocaleString()}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Reputation</div>
          <div className={`text-lg font-bold ${playerAirline.reputationScore >= 60 ? 'text-green-400' : playerAirline.reputationScore >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
            {playerAirline.reputationScore.toFixed(0)}/100
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {playerAirline.reputationScore >= 50
              ? `+${(((playerAirline.reputationScore - 50) * 0.004) * 100).toFixed(0)}% price premium`
              : `-${(((50 - playerAirline.reputationScore) * 0.004) * 100).toFixed(0)}% price penalty`}
          </div>
        </div>
        {aiHoldings.length > 0 && (
          <div className="col-span-2 glass-card p-2 border border-teal-500/20">
            <div className="text-teal-400 text-xs">Daily Dividend Income</div>
            <div className={`text-lg font-bold ${dailyDividends > 0 ? 'text-teal-300' : 'text-gray-500'}`}>
              {dailyDividends > 0 ? `+${formatCurrency(dailyDividends)}` : '—'}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-1">30-Day Profit Trend</div>
        <div className="overflow-hidden">
          <PnLChart snapshots={playerAirline.dailyStats.slice(-30)} width={300} height={80} isDark={isDark} />
        </div>
      </div>

      <div className="glass-card p-2">
        <div className="text-gray-400 text-xs mb-2">Daily Breakdown</div>
        <div className="space-y-1 text-xs">
          {[
            { label: 'Revenue', value: totalDailyRevenue, color: 'text-green-400' },
            { label: 'Fuel', value: -playerRoutes.reduce((s, r) => s + r.dailyCost * 0.35, 0), color: 'text-red-400' },
            { label: 'Maintenance', value: -playerRoutes.reduce((s, r) => s + r.dailyCost * 0.25, 0), color: 'text-orange-400' },
            { label: 'Crew', value: -playerRoutes.reduce((s, r) => s + r.dailyCost * 0.25, 0), color: 'text-yellow-400' },
            { label: 'Airport Fees', value: -playerRoutes.reduce((s, r) => s + r.dailyCost * 0.15, 0), color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-400">{label}</span>
              <span className={color}>{formatCurrency(value)}</span>
            </div>
          ))}
          {aiHoldings.length > 0 && (
            <div className="flex justify-between">
              <span className="text-teal-400">Dividends</span>
              <span className={dailyDividends > 0 ? 'text-teal-300' : 'text-gray-500'}>
                {dailyDividends > 0 ? `+${formatCurrency(dailyDividends)}` : '—'}
              </span>
            </div>
          )}
          <div className="border-t border-gray-700 pt-1 flex justify-between font-bold">
            <span className="text-gray-300">Net</span>
            <span className={(totalDailyProfit + dailyDividends) >= 0 ? 'text-green-400' : 'text-red-400'}>
              {formatCurrency(totalDailyProfit + dailyDividends)}
            </span>
          </div>
        </div>
      </div>

      {dividendSources.length > 0 && (
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs mb-2">Investment Holdings</div>
          <div className="space-y-1 text-xs">
            {dividendSources.map(s => (
              <div key={s.name} className="flex justify-between items-center">
                <span className="text-gray-300 truncate">
                  {s.name} <span className="text-gray-500">({s.stake.toFixed(0)}%)</span>
                </span>
                <span className={`shrink-0 ml-2 ${s.dividend > 0 ? 'text-teal-300' : s.profit < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {s.dividend > 0 ? `+${formatCurrency(s.dividend)}/d` : s.profit < 0 ? 'losing' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
