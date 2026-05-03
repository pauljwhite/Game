import React from 'react';
import { useGameStore } from '@/store';
import { gameDayFromMs } from '@/engine/economicsEngine';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { PROFILE_MAP } from '@/assets/profiles';
import { formatCurrency, formatDuration } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';

export const FleetPanel: React.FC = () => {
  const aircraft = useGameStore(s => s.aircraft);
  const airlines = useGameStore(s => s.airlines);
  const routes = useGameStore(s => s.routes);
  const gameTimeMs = useGameStore(s => s.gameTimeMs);
  const openModalById = useGameStore(s => s.openModalById);
  const startMaintenance = useGameStore(s => s.startMaintenance);
  const gameDay = gameDayFromMs(gameTimeMs);

  const playerAirline = airlines['player'];

  const fleetList = Object.values(aircraft).filter(ac => ac.airlineId === 'player');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-white font-bold">Fleet ({fleetList.length})</h2>
        <button
          onClick={() => openModalById('buyAircraft')}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
        >
          + Buy Aircraft
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {fleetList.length === 0 && (
          <div className="p-4 text-gray-400 text-sm text-center">
            No aircraft yet. Buy your first plane!
          </div>
        )}
        {fleetList.map(ac => {
          const type = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
          if (!type) return null;
          const ProfileSvg = PROFILE_MAP[type.profileId];
          const assignedRoute = ac.assignedRouteId ? routes[ac.assignedRouteId] : null;
          const conditionColor = ac.condition >= 60 ? 'text-green-400' : ac.condition >= 30 ? 'text-yellow-400' : 'text-red-400';
          const needsMaintenance = ac.condition < 30;

          return (
            <div key={ac.id} className={`p-3 border-b border-gray-800 hover:bg-gray-800/50 ${ac.isGrounded ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-16 h-8 flex items-center justify-center">
                  <ProfileSvg color={playerAirline?.color ?? '#60a5fa'} className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{type.model}</span>
                    {needsMaintenance && (
                      <span className="text-xs bg-red-900 text-red-300 px-1 rounded animate-pulse">MAINT REQUIRED</span>
                    )}
                    {ac.isGrounded && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-1 rounded">GROUNDED</span>
                    )}
                    {ac.status === 'maintenance' && (
                      <span className="text-xs bg-yellow-900 text-yellow-300 px-1 rounded">IN MAINTENANCE</span>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {assignedRoute
                      ? `${assignedRoute.originIata} → ${assignedRoute.destinationIata}`
                      : 'Unassigned'}
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className={conditionColor}>Cond: {ac.condition.toFixed(0)}%</span>
                    <span className="text-gray-400">
                      {formatDuration(ac.totalFlightHours)} hrs
                    </span>
                    <span className="text-gray-500">
                      Risk: {(ac.crashRisk * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className="mt-1">
                    <LoadFactorBar value={ac.condition / 100} label="Cond" />
                  </div>
                </div>
              </div>

              {ac.status !== 'maintenance' && !ac.isGrounded && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => startMaintenance(ac.id, gameDay)}
                    className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded"
                  >
                    Send for Maintenance ({formatCurrency(type.maintenanceCostPerHourUSD * ac.maintenanceHoursOwed * 1.5)})
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
