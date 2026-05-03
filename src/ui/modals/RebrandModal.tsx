import React, { useState, useMemo } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { computeAircraftValue } from '@/engine/valuation';

function computeCompanyValue(
  cashUSD: number,
  aircraft: ReturnType<typeof useGameStore.getState>['aircraft'],
  routes: ReturnType<typeof useGameStore.getState>['routes'],
  gameDay: number,
): number {
  const fleetValue = Object.values(aircraft)
    .filter(ac => ac.airlineId === 'player' && ac.status !== 'crashed')
    .reduce((sum, ac) => {
      const type = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
      return sum + (type ? computeAircraftValue(ac, type, gameDay) : 0);
    }, 0);

  const routeValue = Object.values(routes)
    .filter(r => r.airlineId === 'player' && r.isActive && r.dailyProfit > 0)
    .reduce((sum, r) => sum + r.dailyProfit * 365 * 2, 0);

  return Math.max(5_000_000, Math.max(0, cashUSD) + fleetValue + routeValue);
}

function colorCost(companyValue: number): number {
  return Math.round(Math.max(250_000, companyValue * 0.015));
}
function nameCost(companyValue: number): number {
  return Math.round(Math.max(1_000_000, companyValue * 0.04));
}
function bothCost(companyValue: number): number {
  return Math.round(Math.max(1_200_000, companyValue * 0.05));
}

export const RebrandModal: React.FC = () => {
  const airlines       = useGameStore(s => s.airlines);
  const aircraft       = useGameStore(s => s.aircraft);
  const routes         = useGameStore(s => s.routes);
  const gameDay        = useGameStore(s => s.gameDay);
  const closeModal     = useGameStore(s => s.closeModal);
  const rebrandAirline = useGameStore(s => s.rebrandAirline);

  const player = airlines['player'];

  const [newName,  setNewName]  = useState(player?.name  ?? '');
  const [newColor, setNewColor] = useState(player?.color ?? '#3b82f6');

  const companyValue = useMemo(
    () => computeCompanyValue(player?.cashUSD ?? 0, aircraft, routes, gameDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!player) return null;

  const nameChanged  = newName.trim() !== '' && newName.trim() !== player.name;
  const colorChanged = newColor !== player.color;

  const cost = nameChanged && colorChanged
    ? bothCost(companyValue)
    : nameChanged
    ? nameCost(companyValue)
    : colorChanged
    ? colorCost(companyValue)
    : 0;

  const canAfford = player.cashUSD >= cost;
  const hasChange = nameChanged || colorChanged;

  function handleConfirm() {
    if (!hasChange || !canAfford) return;
    rebrandAirline(
      nameChanged  ? newName.trim() : null,
      colorChanged ? newColor       : null,
      cost,
    );
    closeModal();
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-xl px-4 sm:px-6 py-4 shadow-2xl w-full max-w-md relative">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl leading-none"
        >×</button>

        <h2 className="text-xl font-bold text-white mb-1">Rebrand Airline</h2>
        <p className="text-gray-500 text-xs mb-4">
          Company value: <span className="text-gray-300">{formatCurrency(companyValue)}</span>
        </p>

        {/* Preview */}
        <div
          className="flex items-center gap-3 mb-5 p-3 rounded-lg border border-white/10"
          style={{ borderLeftColor: newColor, borderLeftWidth: 4 }}
        >
          <div className="w-5 h-5 rounded-full shrink-0" style={{ background: newColor }} />
          <div>
            <div className="text-white font-bold text-sm">{newName.trim() || player.name}</div>
            <div className="text-gray-500 text-xs">{player.iataPrefix}</div>
          </div>
        </div>

        <div className="space-y-4 mb-5">
          {/* Name */}
          <div>
            <label className="text-gray-300 text-sm block mb-1">
              Airline Name
              <span className="ml-2 text-gray-500 text-xs font-normal">
                name change: {formatCurrency(nameCost(companyValue))}
              </span>
            </label>
            <input
              className="w-full rounded-md border border-white/10 bg-white/[0.07] px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-400"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              maxLength={40}
              placeholder={player.name}
            />
            {nameChanged && (
              <p className="text-xs text-blue-400 mt-1">"{player.name}" → "{newName.trim()}"</p>
            )}
          </div>

          {/* Colour */}
          <div>
            <label className="text-gray-300 text-sm block mb-1">
              Livery Colour
              <span className="ml-2 text-gray-500 text-xs font-normal">
                colour change: {formatCurrency(colorCost(companyValue))}
              </span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-9 rounded cursor-pointer bg-transparent border border-white/10"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
              />
              <span className="text-gray-400 text-sm font-mono">{newColor}</span>
              {colorChanged && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <div className="w-4 h-4 rounded-full border border-white/20" style={{ background: player.color }} />
                  <span className="text-gray-600 text-xs">→</span>
                  <div className="w-4 h-4 rounded-full border border-white/20" style={{ background: newColor }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cost summary */}
        {hasChange && (
          <div className={`mb-4 px-3 py-2 rounded-lg border text-sm ${
            canAfford
              ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}>
            {nameChanged && colorChanged
              ? `Full rebrand (name + colour)`
              : nameChanged ? 'Name change only' : 'Colour change only'}
            {' — '}
            <span className="font-bold">{formatCurrency(cost)}</span>
            {!canAfford && <span className="ml-2 text-xs">(insufficient funds)</span>}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={!hasChange || !canAfford}
            className={`flex-1 py-2.5 font-semibold rounded-lg text-sm transition-colors ${
              hasChange && canAfford
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {!hasChange ? 'No changes' : `Confirm — ${formatCurrency(cost)}`}
          </button>
          <button
            onClick={closeModal}
            className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
