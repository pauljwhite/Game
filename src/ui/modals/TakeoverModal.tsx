import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';

export const TakeoverModal: React.FC = () => {
  const modalPayload = useGameStore(s => s.modalPayload);
  const airlines = useGameStore(s => s.airlines);
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const aiAircraft = useGameStore(s => s.aiAircraft);
  const aiRoutes = useGameStore(s => s.aiRoutes);
  const closeModal = useGameStore(s => s.closeModal);
  const takeoverAirline = useGameStore(s => s.takeoverAirline);
  const removeAIAirline = useGameStore(s => s.removeAIAirline);
  const playerAirlineId = useGameStore(s => s.playerAirlineId);

  const targetId = modalPayload as string | null;
  const target = targetId ? aiAirlines[targetId] : null;
  const playerAirline = airlines[playerAirlineId];

  if (!target || !playerAirline) return null;

  const debt = Math.min(0, target.cashUSD);
  const fleetCount = target.fleetIds.length;
  const acquisitionCost = Math.max(1, fleetCount * 10_000_000 - Math.abs(debt));
  const canAfford = playerAirline.cashUSD >= acquisitionCost;

  // Deduplicate type ids for a concise list
  const fleetTypeMap: Record<string, number> = {};
  target.fleetIds.forEach(id => {
    const ac = aiAircraft[id];
    if (ac) {
      fleetTypeMap[ac.typeId] = (fleetTypeMap[ac.typeId] ?? 0) + 1;
    }
  });

  const routeCount = target.routeIds.length;

  function handleConfirm() {
    if (!targetId || !canAfford) return;
    takeoverAirline(targetId, aiAirlines, aiRoutes, aiAircraft);
    removeAIAirline(targetId);
    closeModal();
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-xl px-4 sm:px-6 py-4 shadow-2xl w-full max-w-md relative max-h-[92svh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-xl leading-none"
          aria-label="Close"
        >
          x
        </button>

        <h2 className="text-xl font-bold text-white mb-1">Acquisition Opportunity</h2>
        <p className="text-gray-400 text-sm mb-5">
          {target.name} is in financial distress and available for acquisition.
        </p>

        {/* Target airline info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{target.logoEmoji}</span>
            <div>
              <div className="text-white font-bold">{target.name}</div>
              <div className="text-gray-400 text-xs">Hub: {target.hubIatas[0] ?? '-'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-400">Fleet size</span>
            <span className="text-white font-medium">{fleetCount} aircraft</span>

            <span className="text-gray-400">Routes</span>
            <span className="text-white font-medium">{routeCount}</span>

            <span className="text-gray-400">Cash / Debt</span>
            <span className={target.cashUSD < 0 ? 'text-red-400 font-medium' : 'text-green-400 font-medium'}>
              {formatCurrency(target.cashUSD)}
            </span>

            <span className="text-gray-400">Reputation</span>
            <span className="text-white font-medium">{Math.round(target.reputationScore)}/100</span>
          </div>
        </div>

        {/* What you gain */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="text-gray-300 text-sm font-semibold mb-2">You will gain:</div>
          <ul className="space-y-1 text-sm">
            {Object.entries(fleetTypeMap).length > 0 ? (
              Object.entries(fleetTypeMap).map(([typeId, count]) => (
                <li key={typeId} className="flex items-center gap-2 text-gray-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {count}x {typeId.toUpperCase()}
                </li>
              ))
            ) : (
              <li className="text-gray-500 italic">No aircraft</li>
            )}
            {routeCount > 0 && (
              <li className="flex items-center gap-2 text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                {routeCount} active route{routeCount !== 1 ? 's' : ''}
              </li>
            )}
          </ul>
        </div>

        {/* Acquisition cost */}
        <div className="bg-gray-800 rounded-lg p-4 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Acquisition Cost</span>
            <span className="text-white font-bold text-lg">{formatCurrency(acquisitionCost)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-400 text-sm">Your Cash</span>
            <span className={`font-medium text-sm ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(playerAirline.cashUSD)}
            </span>
          </div>
          {!canAfford && (
            <div className="text-red-400 text-xs mt-2">Insufficient funds for this acquisition.</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canAfford}
            className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Acquire {target.name}
          </button>
        </div>
      </div>
    </div>
  );
};
