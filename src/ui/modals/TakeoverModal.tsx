import React, { useState } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import { calculateBuyoutPrice, rawCompanyValue } from '@/engine/valuation';

const typeMap = Object.fromEntries(AIRCRAFT_TYPES.map(t => [t.id, t]));

export const TakeoverModal: React.FC = () => {
  const modalPayload    = useGameStore(s => s.modalPayload);
  const airlines        = useGameStore(s => s.airlines);
  const aiAirlines      = useGameStore(s => s.aiAirlines);
  const aiAircraft      = useGameStore(s => s.aiAircraft);
  const aiRoutes        = useGameStore(s => s.aiRoutes);
  const airports        = useGameStore(s => s.airports);
  const closeModal      = useGameStore(s => s.closeModal);
  const takeoverAirline = useGameStore(s => s.takeoverAirline);
  const removeAIAirline = useGameStore(s => s.removeAIAirline);
  const pushNewsItem    = useGameStore(s => s.pushNewsItem);
  const playerAirlineId = useGameStore(s => s.playerAirlineId);

  const [confirmed, setConfirmed] = useState(false);

  const targetId     = modalPayload as string | null;
  const target       = targetId ? aiAirlines[targetId] : null;
  const playerAirline = airlines[playerAirlineId];

  if (!target || !playerAirline) return null;

  const playerStake = (target.shareholders ?? {})['player'] ?? 0;
  const hasMajority = playerStake >= 50;
  const canProceed  = target.isInsolvent || hasMajority;

  const val        = calculateBuyoutPrice(target, aiAircraft, aiRoutes);
  const rawVal     = rawCompanyValue(target, aiAircraft, aiRoutes);
  const ownedValue = rawVal * (playerStake / 100);
  const adjustedPrice = Math.max(0, val.totalPrice - ownedValue);
  const canAfford  = playerAirline.cashUSD >= adjustedPrice;

  const fleetSummary: Record<string, { count: number; model: string }> = {};
  target.fleetIds.forEach(id => {
    const ac = aiAircraft[id];
    if (!ac) return;
    const t = typeMap[ac.typeId];
    const label = t ? `${t.manufacturer} ${t.model}` : ac.typeId;
    if (!fleetSummary[ac.typeId]) fleetSummary[ac.typeId] = { count: 0, model: label };
    fleetSummary[ac.typeId].count++;
  });

  const routeCount = target.routeIds.length;

  function handleConfirm() {
    if (!targetId || !canAfford || !canProceed) return;
    if (!confirmed) { setConfirmed(true); return; }
    takeoverAirline(targetId, aiAirlines, aiRoutes, aiAircraft);
    removeAIAirline(targetId);
    pushNewsItem(`${playerAirline.name} has acquired ${target!.name} for ${formatCurrency(adjustedPrice)}.`);
    closeModal();
  }

  const routeDetails = target.routeIds.slice(0, 5).map(id => {
    const r = aiRoutes[id];
    if (!r) return null;
    const orig = airports[r.originIata]?.city ?? r.originIata;
    const dest = airports[r.destinationIata]?.city ?? r.destinationIata;
    return { label: `${orig} → ${dest}`, profit: r.dailyProfit };
  }).filter(Boolean) as { label: string; profit: number }[];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl px-4 sm:px-6 py-4 w-full max-w-lg relative max-h-[92svh] overflow-y-auto">
        <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl leading-none">×</button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{target.logoEmoji}</span>
          <div>
            <h2 className="text-xl font-bold text-white">Acquire {target.name}</h2>
            <p className="text-gray-400 text-sm">
              {target.isInsolvent ? 'Distressed acquisition' : `${target.personality} airline · Hub: ${target.hubIatas.join(', ')}`}
            </p>
          </div>
        </div>

        {/* Majority gate warning */}
        {!canProceed && (
          <div className="mb-4 px-4 py-3 bg-amber-900/40 border border-amber-500/40 rounded-lg text-sm">
            <div className="text-amber-300 font-semibold mb-0.5">Majority stake required</div>
            <div className="text-amber-200/80 text-xs">
              You need &gt;50% ownership to acquire this airline. You own {playerStake.toFixed(0)}%.
              Use "Buy Shares" to build your stake.
            </div>
          </div>
        )}

        {/* Valuation breakdown */}
        <div className="glass-card p-4 mb-4 space-y-2 text-sm">
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Valuation</div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fleet ({target.fleetIds.length} aircraft)</span>
            <span className="text-white">{formatCurrency(val.fleetValue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Route network ({routeCount} routes)</span>
            <span className="text-white">{formatCurrency(val.routeValue)}</span>
          </div>
          {val.cashValue > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Cash on hand</span>
              <span className="text-green-400">{formatCurrency(val.cashValue)}</span>
            </div>
          )}
          {val.debtValue > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Debt assumed</span>
              <span className="text-red-400">−{formatCurrency(val.debtValue)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Control premium (20%)</span>
            <span className="text-white">{formatCurrency(val.controlPremium)}</span>
          </div>
          {playerStake > 0 && (
            <div className="flex justify-between text-teal-300">
              <span>Your {playerStake.toFixed(0)}% stake (already paid)</span>
              <span>−{formatCurrency(ownedValue)}</span>
            </div>
          )}
          <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
            <span className="text-gray-200">Acquisition price</span>
            <span className="text-white text-base">{formatCurrency(adjustedPrice)}</span>
          </div>
        </div>

        {/* What you gain */}
        <div className="glass-card p-4 mb-4">
          <div className="text-gray-300 text-sm font-semibold mb-2">You gain</div>
          <div className="space-y-1 text-sm">
            {Object.values(fleetSummary).map(({ count, model }) => (
              <div key={model} className="flex items-center gap-2 text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {count}× {model}
              </div>
            ))}
            {Object.keys(fleetSummary).length === 0 && (
              <div className="text-gray-500 italic text-xs">No aircraft</div>
            )}
            {routeDetails.map(rd => (
              <div key={rd.label} className="flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  {rd.label}
                </span>
                <span className={rd.profit >= 0 ? 'text-green-400 text-xs' : 'text-red-400 text-xs'}>
                  {formatCurrency(rd.profit)}/d
                </span>
              </div>
            ))}
            {routeCount > routeDetails.length && (
              <div className="text-gray-500 text-xs">+{routeCount - routeDetails.length} more routes</div>
            )}
          </div>
        </div>

        {/* Affordability */}
        {canProceed && (
          <div className="glass-card px-4 py-3 mb-5 flex justify-between items-center text-sm">
            <span className="text-gray-400">Your cash after</span>
            <span className={canAfford ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
              {formatCurrency(playerAirline.cashUSD - adjustedPrice)}
            </span>
          </div>
        )}

        {canProceed && !canAfford && (
          <p className="text-red-400 text-xs mb-3 text-center">
            Insufficient funds — need {formatCurrency(adjustedPrice - playerAirline.cashUSD)} more.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={closeModal} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-lg transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canAfford || !canProceed}
            onMouseLeave={() => setConfirmed(false)}
            className={`flex-1 py-2.5 font-semibold rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              confirmed ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-700 hover:bg-green-600 text-white'
            }`}
          >
            {confirmed ? 'Confirm — no going back' : `Acquire for ${formatCurrency(adjustedPrice)}`}
          </button>
        </div>
      </div>
    </div>
  );
};
