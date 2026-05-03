import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';

export const RoutesPanel: React.FC = () => {
  const routes = useGameStore(s => s.routes);
  const airlines = useGameStore(s => s.airlines);
  const openModalById = useGameStore(s => s.openModalById);
  const selectRoute = useGameStore(s => s.selectRoute);
  const deleteRoute = useGameStore(s => s.deleteRoute);

  const playerRoutes = Object.values(routes).filter(r => r.airlineId === 'player');

  void airlines;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-white font-bold">Routes ({playerRoutes.length})</h2>
        <button
          onClick={() => openModalById('newRoute')}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
        >
          + New Route
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
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
              className="p-3 border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
              onClick={() => { selectRoute(route.id); openModalById('routeDetail', route.id); }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${route.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="text-white font-mono text-sm">
                    {route.originIata} {'->'} {route.destinationIata}
                  </span>
                </div>
                <span className={`text-sm font-medium ${profitColor}`}>
                  {formatCurrency(route.dailyProfit)}/day
                </span>
              </div>

              <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-gray-400">
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
