import React, { useState } from 'react';
import { useGameStore } from '@/store';
import { gameDayFromMs } from '@/engine/economicsEngine';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { AircraftProfile } from '@/assets/profiles/AircraftProfile';
import { formatCurrency, formatDuration } from '@/utils/format';
import { computeMaintenanceCost, MAINTENANCE_TIERS } from '@/utils/constants';
import { computeAircraftValue } from '@/engine/valuation';
import type { MaintenanceTier } from '@/types/aircraft';
import type { Aircraft } from '@/types';

const TIER_ORDER: MaintenanceTier[] = ['light', 'standard', 'full'];

function AircraftCard({ ac, gameDay }: { ac: Aircraft; gameDay: number }) {
  const startMaintenance   = useGameStore(s => s.startMaintenance);
  const setAutoMaintenance = useGameStore(s => s.setAutoMaintenance);
  const sellAircraft       = useGameStore(s => s.sellAircraft);
  const airlines           = useGameStore(s => s.airlines);
  const routes             = useGameStore(s => s.routes);

  const [expanded, setExpanded] = useState(false);
  const [openSection, setOpenSection] = useState<'oneoff' | 'auto' | null>(null);
  const [sellConfirm, setSellConfirm] = useState(false);

  const toggleSection = (s: 'oneoff' | 'auto') =>
    setOpenSection(prev => (prev === s ? null : s));

  const type          = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
  const playerAirline = airlines['player'];
  const assignedRoute = ac.assignedRouteId ? routes[ac.assignedRouteId] : null;

  if (!type) return null;

  const conditionPct   = ac.condition;
  const condBg         = conditionPct >= 60 ? 'bg-green-500' : conditionPct >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  const condText       = conditionPct >= 60 ? 'text-green-400' : conditionPct >= 30 ? 'text-yellow-400' : 'text-red-400';
  const needsMaint     = ac.condition < 30;
  const inMaint        = ac.status === 'maintenance';
  const canStartMaint  = !inMaint && ac.status !== 'crashed';

  const routeLabel = assignedRoute
    ? `${assignedRoute.originIata} → ${assignedRoute.destinationIata}`
    : inMaint ? 'In maintenance' : ac.isGrounded ? 'Grounded' : 'Unassigned';

  return (
    <div className={`border-b border-white/10 ${ac.isGrounded && !inMaint ? 'opacity-60' : ''}`}>
      {/* Compact single-line row */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.055] transition-colors text-left"
        onClick={() => { setExpanded(v => !v); setSellConfirm(false); }}
      >
        {/* Condition dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${condBg}`} />

        {/* Model */}
        <span className="text-white text-sm font-medium w-24 shrink-0 truncate">{type.model}</span>

        {/* Badges */}
        <span className="flex gap-1 shrink-0">
          {needsMaint && <span className="soft-tag border-red-300/20 bg-red-500/15 text-red-200">MAINT</span>}
          {inMaint    && <span className="soft-tag border-yellow-300/20 bg-yellow-500/15 text-yellow-200">IN MAINT</span>}
          {ac.autoMaintenanceEnabled && !inMaint && <span className="soft-tag border-sky-300/20 bg-sky-500/15 text-sky-200">AUTO</span>}
        </span>

        {/* Route — flexible */}
        <span className="flex-1 text-gray-400 text-xs truncate min-w-0">{routeLabel}</span>

        {/* Flight hours */}
        <span className="text-[10px] text-gray-500 shrink-0 w-12 text-right">
          {Math.round(ac.totalFlightHours).toLocaleString()}h
        </span>

        {/* Condition bar */}
        <div className="w-16 shrink-0 flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full ${condBg}`} style={{ width: `${conditionPct}%` }} />
          </div>
          <span className={`text-[10px] w-7 text-right ${condText}`}>{conditionPct.toFixed(0)}%</span>
        </div>

        {/* Chevron */}
        <span className="text-gray-600 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 bg-white/[0.03] border-t border-white/10">
          {/* SVG + stats row */}
          <div className="flex items-center gap-3 pt-2 pb-2">
            <div className="w-32 h-14 shrink-0 flex items-center justify-center">
              <AircraftProfile type={type} color={playerAirline?.color ?? '#60a5fa'} className="w-full h-full" />
            </div>
            <div className="flex-1 text-xs text-gray-400 space-y-0.5">
              <div>{type.manufacturer} {type.model} · {type.seatsEconomy}Y/{type.seatsBusiness}J seats</div>
              <div>{formatDuration(ac.totalFlightHours)} total hrs · Crash risk: {(ac.crashRisk * 100).toFixed(2)}%</div>
              <div className="text-gray-500">{type.rangeKm.toLocaleString()} km range · {type.cruiseSpeedKmh} km/h</div>
            </div>
          </div>

          {inMaint && (
            <div className="mb-2 text-xs text-yellow-300 text-center">
              {MAINTENANCE_TIERS[ac.activeMaintTier ?? 'standard'].label} — {Math.max(0, MAINTENANCE_TIERS[ac.activeMaintTier ?? 'standard'].durationDays - (gameDay - ac.lastMaintenanceGameDay))} day(s) remaining
            </div>
          )}

          {/* Value + Sell */}
          <div className="flex items-center justify-between py-1.5 px-1 mb-1">
            <div className="text-xs text-gray-400">
              Est. value:{' '}
              <span className="text-white font-semibold">
                {formatCurrency(computeAircraftValue(ac, type, gameDay))}
              </span>
            </div>
            {!inMaint && (
              sellConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">Confirm sale?</span>
                  <button
                    onClick={() => sellAircraft(ac.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-semibold transition-colors"
                  >
                    Sell
                  </button>
                  <button
                    onClick={() => setSellConfirm(false)}
                    className="apple-button"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSellConfirm(true)}
                  className="apple-button"
                >
                  Sell Aircraft
                </button>
              )
            )}
          </div>

          {/* Maintenance accordion */}
          {canStartMaint && (
            <div className="glass-card overflow-hidden text-xs">
              <button
                onClick={() => toggleSection('oneoff')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.045] hover:bg-white/[0.08] transition-colors"
              >
                <span className="font-medium text-gray-200">One-off maintenance</span>
                <span className="text-gray-500">{openSection === 'oneoff' ? '▴' : '▾'}</span>
              </button>

              {openSection === 'oneoff' && (
                <div className="p-2 grid grid-cols-3 gap-1 bg-slate-950/35">
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
                        className="apple-button px-1.5 py-1.5 text-center"
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
              )}

              <div className="border-t border-white/10" />

              <button
                onClick={() => toggleSection('auto')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.045] hover:bg-white/[0.08] transition-colors"
              >
                <span className="font-medium text-gray-200">
                  Auto-maintenance
                  {ac.autoMaintenanceEnabled && (
                    <span className="ml-2 text-blue-400 font-normal">
                      ON · {MAINTENANCE_TIERS[ac.autoMaintenanceTier ?? 'standard'].label} @ {ac.autoMaintenanceThreshold ?? 40}%
                    </span>
                  )}
                </span>
                <span className="text-gray-500">{openSection === 'auto' ? '▴' : '▾'}</span>
              </button>

              {openSection === 'auto' && (
                <div className="p-2 space-y-2 bg-slate-950/35">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Enable auto-maintenance</span>
                    <button
                      onClick={() => setAutoMaintenance(ac.id, !ac.autoMaintenanceEnabled, ac.autoMaintenanceThreshold ?? 40, ac.autoMaintenanceTier ?? 'standard')}
                      className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                        ac.autoMaintenanceEnabled
                          ? 'bg-sky-500 text-white'
                          : 'bg-white/10 hover:bg-white/15 text-gray-300'
                      }`}
                    >
                      {ac.autoMaintenanceEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {ac.autoMaintenanceEnabled && (
                    <>
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                          <span>Trigger at condition</span>
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
                        <div className="text-[10px] text-gray-400 mb-1">Maintenance tier</div>
                        <div className="grid grid-cols-3 gap-1">
                          {TIER_ORDER.map(tier => (
                            <button
                              key={tier}
                              onClick={() => setAutoMaintenance(ac.id, true, ac.autoMaintenanceThreshold ?? 40, tier)}
                              className={`py-1 rounded text-[10px] font-medium transition-colors ${
                                (ac.autoMaintenanceTier ?? 'standard') === tier
                                  ? 'bg-sky-500 text-white'
                                  : 'bg-white/10 text-gray-400 hover:bg-white/15'
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
        </div>
      )}
    </div>
  );
}

export const FleetPanel: React.FC = () => {
  const aircraft    = useGameStore(s => s.aircraft);
  const gameTimeMs  = useGameStore(s => s.gameTimeMs);
  const openModalById = useGameStore(s => s.openModalById);
  const closePanel    = useGameStore(s => s.closePanel);
  const gameDay     = gameDayFromMs(gameTimeMs);
  const fleetList   = Object.values(aircraft).filter(ac => ac.airlineId === 'player');

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <h2 className="text-white font-bold">Fleet ({fleetList.length})</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => openModalById('buyAircraft')}
            className="apple-button-primary"
          >
            + Buy Aircraft
          </button>
          <button onClick={closePanel} aria-label="Close" className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
        </div>
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
