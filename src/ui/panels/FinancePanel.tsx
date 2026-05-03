import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { PnLChart } from '@/ui/components/PnLChart';

export const FinancePanel: React.FC = () => {
  const airlines = useGameStore(s => s.airlines);
  const routes = useGameStore(s => s.routes);

  const closePanel = useGameStore(s => s.closePanel);
  const playerAirline = airlines['player'];
  if (!playerAirline) return null;

  const playerRoutes = Object.values(routes).filter(r => r.airlineId === 'player');
  const totalDailyRevenue = playerRoutes.reduce((s, r) => s + r.dailyRevenue, 0);
  const totalDailyCost = playerRoutes.reduce((s, r) => s + r.dailyCost, 0);
  const totalDailyProfit = totalDailyRevenue - totalDailyCost;

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <h2 className="text-white font-bold">Finance</h2>
        <button onClick={closePanel} aria-label="Close" className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">

      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Cash</div>
          <div className={`text-lg font-bold ${playerAirline.cashUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(playerAirline.cashUSD)}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Daily P&L</div>
          <div className={`text-lg font-bold ${totalDailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(totalDailyProfit)}
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
        </div>
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-1">30-Day Profit Trend</div>
        <PnLChart snapshots={playerAirline.dailyStats.slice(-30)} width={352} height={80} />
      </div>

      <div className="glass-card p-2">
        <div className="text-gray-400 text-xs mb-2">Daily Cost Breakdown</div>
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
          <div className="border-t border-gray-700 pt-1 flex justify-between font-bold">
            <span className="text-gray-300">Net Profit</span>
            <span className={totalDailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
              {formatCurrency(totalDailyProfit)}
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
