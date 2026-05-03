import React, { useState } from 'react';
import { useGameStore } from '@/store';
import { gameDayFromMs } from '@/engine/economicsEngine';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { PROFILE_MAP } from '@/assets/profiles';
import { formatCurrency, formatDuration } from '@/utils/format';
import { LoadFactorBar } from '@/ui/components/LoadFactorBar';
import { computeMaintenanceCost, MAINTENANCE_TIERS } from '@/utils/constants';
import type { MaintenanceTier } from '@/types/aircraft';
import type { Aircraft } from '@/types';

const TIER_ORDER: MaintenanceTier[] = ['light', 'standard', 'full'];

function AircraftCard({ ac, gameDay }: { ac: Aircraft; gameDay: number }) {
  const openModalById     = useGameStore(s => s.openModalById);
  const startMaintenance  = useGameStore(s => s.startMaintenance);
  const setAutoMaintenance = useGameStore(s => s.setAutoMaintenance);
  const airlines          = useGameStore(s => s.airlines);
  const routes            = useGameStore(s => s.routes);

  const [showAuto, setShowAuto] = useState(false);

  const type          = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
  const playerAirline = airlines['player'];
  const assignedRoute = ac.assignedRouteId ? routes[ac.assignedRouteId] : null;

  if (!type) return null;

  const ProfileSvg     = PROFILE_MAP[type.profileId];
  const conditionColor = ac.condition >= 60 ? 'text-green-400' : ac.condition >= 30 ? 'text-yellow-400' : 'text-red-400';
  const needsMaint     = ac.condition < 30;
  const inMaint        = ac.status === 'maintenance';
  const canStartMaint  = !inMaint && !ac.isGrounded;

  return (
    <div className={`p-3 border-b border-gray-800 ${ac.isGrounded ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-16 h-8 flex items-center justify-center">
          <ProfileSvg color={playerAirline?.color ?? '#60a5fa'} className="w-full h-full" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white text-sm font-medium">{type.model}</span>
            {needsMaint && <span className="text-[10px] bg-red-900 text-red-300 px-1 rounded animate-pulse">MAINT REQ</span>}
            {ac.isGrounded && !inMaint && <span className="text-[10px] bg-gray-700 text-gray-300 px-1 rounded">GROUNDED</span>}
            {inMaint && (
              <span className="text-[10px] bg-yellow-900 text-yellow-300 px-1 rounded">
                IN MAINT ({MAINTENANCE_TIERS[ac.activeMaintTier ?? 'standard'].label})
              </span>
            )}
            {ac.autoMaintenanceEnabled && !inMaint && (
              <span className="text-[10px] bg-blue-900 text-blue-300 px-1 rounded">AUTO</span>
            )}
          </div>
          <div className="text-gray-400 text-xs mt-0.5">
            {assignedRoute ? `${assignedRoute.originIata} → ${assignedRoute.destinationIata}` : 'Unassigned'}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs">
            <span className={conditionColor}>Cond: {ac.condition.toFixed(0)}%</span>
            <span className="text-gray-400">{formatDuration(ac.totalFlightHours)} hrs</span>
            <span className="text-gray-500">Risk: {(ac.crashRisk * 100).toFixed(2)}%</span>
          </div>
          <div className="mt-1">
            <LoadFactorBar value={ac.condition / 100} label="Cond" />
          </div>
        </div>
      </div>

      {/* Maintenance tier buttons */}
      {canStartMaint && (
        <div className="mt-2 space-y-1.5">
          <div className="grid grid-cols-3 gap-1">
            {TIER_ORDER.map(tier => {
              const cfg  = MAINTENANCE_TIERS[tier];
              const cost = computeMaintenanceCost(tier, ac.maintenanceHoursOwed, type.maintenanceCostPerHourUSD);
              const gain = cfg.conditionGain >= 999
                ? Math.min(100, 100 - ac.condition)
                : Math.min(cfg.conditionGain, 100 - ac.condition);
              const costPerPt = gain > 0 ? Math.round(cost / gain) : cost;
              return (
                <button
                  key={tier}
                  onClick={() => startMaintenance(ac.id, gameDay, tier)}
                  title={cfg.desc}
                  className="px-1.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-center transition-colors"
                >
                  <div className="text-xs font-semibold">{cfg.label}</div>
                  <div className="text-[10px] text-gray-400">{formatCurrency(cost)}</div>
                  <div className="text-[10px] text-gray-500">
                    {cfg.conditionGain >= 999 ? '→100%' : `+${cfg.conditionGain}%`}
                    {' · '}{formatCurrency(costPerPt)}/pt
                  </div>
                </button>
              );
            })}
          </div>

          {/* Auto-maintenance toggle row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAuto(v => !v)}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showAuto ? '▴' : '▾'} Auto-maintenance
              {ac.autoMaintenanceEnabled && (
                <span className="ml-1 text-blue-400">
                  ON · {MAINTENANCE_TIERS[ac.autoMaintenanceTier ?? 'standard'].label} @ {ac.autoMaintenanceThreshold ?? 40}%
                </span>
              )}
            </button>
          </div>

          {showAuto && (
            <div className="bg-gray-800 rounded p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Auto-maintenance</span>
                <button
                  onClick={() => setAutoMaintenance(ac.id, !ac.autoMaintenanceEnabled, ac.autoMaintenanceThreshold ?? 40, ac.autoMaintenanceTier ?? 'standard')}
                  className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${
                    ac.autoMaintenanceEnabled
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                  }`}
                >
                  {ac.autoMaintenanceEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {ac.autoMaintenanceEnabled && (
                <>
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Trigger threshold</span>
                      <span className="text-white">{ac.autoMaintenanceThreshold ?? 40}%</span>
                    </div>
                    <input
                      type="range" min={20} max={80} step={5}
                      value={ac.autoMaintenanceThreshold ?? 40}
                      onChange={e => setAutoMaintenance(ac.id, true, Number(e.target.value), ac.autoMaintenanceTier ?? 'standard')}
                      className="w-full accent-blue-500 h-1"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                      <span>20%</span><span>80%</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-gray-400 mb-1">Maintenance type</div>
                    <div className="grid grid-cols-3 gap-1">
                      {TIER_ORDER.map(tier => (
                        <button
                          key={tier}
                          onClick={() => setAutoMaintenance(ac.id, true, ac.autoMaintenanceThreshold, tier)}
                          className={`py-1 rounded text-[10px] font-medium transition-colors ${
                            (ac.autoMaintenanceTier ?? 'standard') === tier
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {MAINTENANCE_TIERS[tier].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {inMaint && (
        <div className="mt-2 text-xs text-yellow-300 text-center">
          {MAINTENANCE_TIERS[ac.activeMaintTier ?? 'standard'].label} — {MAINTENANCE_TIERS[ac.activeMaintTier ?? 'standard'].durationDays - Math.max(0, gameDay - ac.lastMaintenanceGameDay)} day(s) remaining
        </div>
      )}

      <button
        onClick={() => openModalById('buyAircraft')}
        className="hidden"
      />
    </div>
  );
}

export const FleetPanel: React.FC = () => {
  const aircraft    = useGameStore(s => s.aircraft);
  const gameTimeMs  = useGameStore(s => s.gameTimeMs);
  const openModalById = useGameStore(s => s.openModalById);
  const gameDay     = gameDayFromMs(gameTimeMs);
  const fleetList   = Object.values(aircraft).filter(ac => ac.airlineId === 'player');

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
        {fleetList.map(ac => (
          <AircraftCard key={ac.id} ac={ac} gameDay={gameDay} />
        ))}
      </div>
    </div>
  );
};
