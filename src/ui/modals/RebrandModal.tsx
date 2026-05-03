import React, { useState } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';

const typeMap = Object.fromEntries(AIRCRAFT_TYPES.map(t => [t.id, t]));

function computePlayerValue(
  cashUSD: number,
  fleetIds: string[],
  routeIds: string[],
  aircraft: Record<string, { typeId: string }>,
  routes: Record<string, { dailyProfit: number }>,
): number {
  const fleetResale = fleetIds.reduce((sum, id) => {
    const ac = aircraft[id];
    const t = ac ? typeMap[ac.typeId] : null;
    return sum + (t ? t.purchasePrice * 0.5 : 0);
  }, 0);
  const annualRouteProfit = routeIds.reduce((sum, id) => {
    const r = routes[id];
    return sum + (r ? Math.max(0, r.dailyProfit) * 365 : 0);
  }, 0);
  return Math.max(5_000_000, Math.max(0, cashUSD) + fleetResale + 2 * annualRouteProfit);
}

function rebrandCost(changeName: boolean, changeColor: boolean, companyValue: number): number {
  if (changeName && changeColor) return Math.max(1_200_000, companyValue * 0.05);
  if (changeName) return Math.max(1_000_000, companyValue * 0.04);
  if (changeColor) return Math.max(250_000, companyValue * 0.015);
  return 0;
}

export const RebrandModal: React.FC = () => {
  const closeModal     = useGameStore(s => s.closeModal);
  const rebrandAirline = useGameStore(s => s.rebrandAirline);
  const airlines       = useGameStore(s => s.airlines);
  const aircraft       = useGameStore(s => s.aircraft);
  const routes         = useGameStore(s => s.routes);

  const player = airlines['player'];
  if (!player) return null;

  const [newName, setNewName]   = useState(player.name);
  const [newColor, setNewColor] = useState(player.color);

  const nameChanged  = newName.trim() !== player.name && newName.trim().length > 0;
  const colorChanged = newColor !== player.color;
  const anyChange    = nameChanged || colorChanged;

  const companyValue = computePlayerValue(player.cashUSD, player.fleetIds, player.routeIds, aircraft, routes);
  const cost = rebrandCost(nameChanged, colorChanged, companyValue);
  const canAfford = player.cashUSD >= cost;

  function handleConfirm() {
    if (!anyChange || !canAfford) return;
    rebrandAirline(nameChanged ? newName.trim() : null, colorChanged ? newColor : null, cost);
    closeModal();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl px-4 sm:px-6 py-4 w-full max-w-md relative">
        <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl leading-none">×</button>

        <h2 className="text-xl font-bold text-white mb-1">Rebrand Airline</h2>
        <p className="text-gray-400 text-sm mb-4">Change your airline's name or livery colour.</p>

        {/* Live preview */}
        <div className="glass-card p-3 mb-4 flex items-center gap-3">
          <div className="w-5 h-5 rounded-full shrink-0 border-2 border-white/20" style={{ backgroundColor: newColor }} />
          <span className="text-white font-semibold text-sm truncate">
            {newName.trim() || player.name}
          </span>
          {(nameChanged || colorChanged) && (
            <span className="ml-auto text-[10px] text-teal-300 bg-teal-900/40 border border-teal-500/30 px-1.5 py-0.5 rounded shrink-0">
              Preview
            </span>
          )}
        </div>

        <div className="space-y-4 mb-4">
          <div>
            <label className="text-gray-300 text-sm block mb-1">Airline Name</label>
            <input
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              maxLength={30}
            />
            {nameChanged && (
              <p className="text-xs text-amber-400 mt-1">
                Name change: {formatCurrency(Math.max(1_000_000, companyValue * 0.04))} base cost
              </p>
            )}
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-1">Livery Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-8 rounded cursor-pointer bg-gray-800 border border-gray-600"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
              />
              <span className="text-gray-400 text-sm font-mono">{newColor}</span>
            </div>
            {colorChanged && (
              <p className="text-xs text-amber-400 mt-1">
                Colour change: {formatCurrency(Math.max(250_000, companyValue * 0.015))} base cost
              </p>
            )}
          </div>
        </div>

        {anyChange && (
          <div className="glass-card p-3 mb-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Rebrand cost</span>
              <span className="text-white font-semibold">{formatCurrency(cost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cash after</span>
              <span className={canAfford ? 'text-white' : 'text-red-400'}>
                {formatCurrency(player.cashUSD - cost)}
              </span>
            </div>
          </div>
        )}

        {!canAfford && anyChange && (
          <p className="text-red-400 text-xs mb-3 text-center">
            Insufficient funds — need {formatCurrency(cost - player.cashUSD)} more.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={closeModal} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-lg transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!anyChange || !canAfford}
            className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {anyChange ? `Rebrand — ${formatCurrency(cost)}` : 'No changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
