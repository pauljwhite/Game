import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';

export const AirlinesPanel: React.FC = () => {
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const airlines = useGameStore(s => s.airlines);
  const openModalById = useGameStore(s => s.openModalById);

  const playerAirline = airlines['player'];
  const totalPax = (playerAirline?.totalPassengersAllTime ?? 0) +
    Object.values(aiAirlines).reduce((s, a) => s + a.totalPassengersAllTime, 0);

  const allAirlines = [
    ...(playerAirline ? [{ ...playerAirline, isPlayer: true }] : []),
    ...Object.values(aiAirlines).map(a => ({ ...a, isPlayer: false })),
  ].sort((a, b) => b.totalPassengersAllTime - a.totalPassengersAllTime);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-white font-bold">Airlines</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {allAirlines.map(airline => {
          const share = totalPax > 0 ? (airline.totalPassengersAllTime / totalPax) * 100 : 0;
          const canTakeover = !airline.isPlayer && airline.canBeTakenOver;

          return (
            <div key={airline.id} className={`p-3 border-b border-gray-800 ${airline.isInsolvent ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: airline.color }} />
                  <span className="text-white text-sm font-medium">
                    {airline.name}
                    {airline.isPlayer && <span className="ml-1 text-xs text-blue-400">(You)</span>}
                  </span>
                </div>
                <span className="text-gray-300 text-sm">{share.toFixed(1)}%</span>
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
              </div>

              {canTakeover && !airline.isPlayer && (
                <button
                  onClick={() => openModalById('takeover', airline.id)}
                  className="mt-2 w-full py-1 bg-red-900 hover:bg-red-800 text-red-200 text-xs rounded"
                >
                  Acquire Airline
                </button>
              )}
              {airline.isInsolvent && !airline.isPlayer && (
                <div className="mt-1 text-xs text-red-500">INSOLVENT</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
