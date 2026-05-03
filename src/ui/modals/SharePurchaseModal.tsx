import React, { useState, useMemo } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { calculateSharePrice, rawCompanyValue } from '@/engine/valuation';

const QUICK_AMOUNTS = [1, 5, 10, 25, 50];

export const SharePurchaseModal: React.FC = () => {
  const modalPayload  = useGameStore(s => s.modalPayload);
  const airlines      = useGameStore(s => s.airlines);
  const aiAirlines    = useGameStore(s => s.aiAirlines);
  const aiAircraft    = useGameStore(s => s.aiAircraft);
  const aiRoutes      = useGameStore(s => s.aiRoutes);
  const closeModal    = useGameStore(s => s.closeModal);
  const buyShares     = useGameStore(s => s.buyShares);

  const [percentInput, setPercentInput] = useState(5);
  const [source, setSource] = useState<'market' | string>('market');

  const targetId = modalPayload as string | null;
  const target   = targetId ? aiAirlines[targetId] : null;
  const player   = airlines['player'];

  if (!target || !player) return null;

  const shareholders = target.shareholders ?? {};
  const playerStake = shareholders['player'] ?? 0;
  const ownedTotal  = Object.values(shareholders).reduce((s, v) => s + v, 0);
  const marketFloat = Math.max(0, 100 - ownedTotal);

  // Other AI shareholders who could sell
  const aiShareholders = Object.entries(shareholders)
    .filter(([id, pct]) => id !== 'player' && pct > 0)
    .map(([id, pct]) => ({ id, name: aiAirlines[id]?.name ?? id, pct }));

  // Validate available amount from chosen source
  const maxFromSource = source === 'market'
    ? marketFloat
    : (shareholders[source] ?? 0);

  const percent = Math.min(Math.max(1, percentInput), Math.min(50, maxFromSource));

  const cost = useMemo(() => {
    if (!target || percent <= 0) return 0;
    return calculateSharePrice(percent, playerStake, target, aiAircraft, aiRoutes, source !== 'market');
  }, [target, percent, playerStake, aiAircraft, aiRoutes, source]);

  const companyValue = useMemo(() => rawCompanyValue(target, aiAircraft, aiRoutes), [target, aiAircraft, aiRoutes]);
  const pricePerPct  = companyValue / 100;
  const stakeAfter   = playerStake + percent;
  const willHaveMajority = stakeAfter >= 50;
  const estDailyDiv  = (percent / 100) * Math.max(0, target.lastDailyProfit ?? 0);

  const canAfford = player.cashUSD >= cost;
  const hasSource = maxFromSource >= 1;

  function handleBuy() {
    if (!targetId || !canAfford || !hasSource || percent <= 0) return;
    buyShares(targetId, percent, source);
    closeModal();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl px-4 sm:px-6 py-4 w-full max-w-md relative max-h-[92svh] overflow-y-auto">
        <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl leading-none">×</button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{target.logoEmoji}</span>
          <div>
            <h2 className="text-xl font-bold text-white">Buy Shares in {target.name}</h2>
            <p className="text-gray-400 text-sm capitalize">{target.personality} · Hub: {target.hubIatas.join(', ')}</p>
          </div>
        </div>

        {/* Company overview */}
        <div className="glass-card p-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div>
            <div className="text-gray-500">Company value</div>
            <div className="text-white font-semibold">{formatCurrency(companyValue)}</div>
          </div>
          <div>
            <div className="text-gray-500">Price per 1%</div>
            <div className="text-white font-semibold">{formatCurrency(pricePerPct)}</div>
          </div>
          <div>
            <div className="text-gray-500">You currently own</div>
            <div className={`font-semibold ${playerStake > 0 ? 'text-teal-300' : 'text-white'}`}>{playerStake.toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-gray-500">Daily profit</div>
            <div className={`font-semibold ${(target.lastDailyProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(target.lastDailyProfit ?? 0)}
            </div>
          </div>
        </div>

        {/* Ownership breakdown */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ownership</div>
          <div className="flex rounded overflow-hidden h-3">
            {playerStake > 0 && (
              <div className="bg-teal-500 transition-all" style={{ width: `${playerStake}%` }} title={`You: ${playerStake.toFixed(0)}%`} />
            )}
            {aiShareholders.map(s => (
              <div key={s.id} className="bg-gray-500 opacity-70" style={{ width: `${s.pct}%` }} title={`${s.name}: ${s.pct.toFixed(0)}%`} />
            ))}
            <div className="bg-gray-700 flex-1" title={`Float: ${marketFloat.toFixed(0)}%`} />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {playerStake > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                You {playerStake.toFixed(0)}%
              </span>
            )}
            {aiShareholders.map(s => (
              <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                {s.name} {s.pct.toFixed(0)}%
              </span>
            ))}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10">
              Float {marketFloat.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Source */}
        {aiShareholders.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Buy from</div>
            <div className="space-y-1.5">
              <button
                onClick={() => setSource('market')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors border ${
                  source === 'market'
                    ? 'bg-teal-900/40 border-teal-500/50 text-teal-200'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <span className="font-medium">Market float</span>
                <span>{marketFloat.toFixed(0)}% available · {formatCurrency(pricePerPct)}/% </span>
              </button>
              {aiShareholders.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors border ${
                    source === s.id
                      ? 'bg-orange-900/40 border-orange-500/50 text-orange-200'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <span className="font-medium">{s.name}</span>
                  <span>{s.pct.toFixed(0)}% available · +15% premium</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount selector */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Amount to buy</div>
          <div className="flex gap-1.5 mb-2">
            {QUICK_AMOUNTS.map(amt => {
              const disabled = amt > maxFromSource;
              return (
                <button
                  key={amt}
                  onClick={() => !disabled && setPercentInput(amt)}
                  disabled={disabled}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
                    percentInput === amt && !disabled
                      ? 'bg-blue-600 text-white'
                      : disabled
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-white/10 text-gray-300 hover:bg-white/15'
                  }`}
                >
                  {amt}%
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={Math.min(50, maxFromSource)}
              step={1}
              value={percentInput}
              onChange={e => setPercentInput(Number(e.target.value))}
              className="flex-1 accent-blue-500 h-1"
            />
            <span className="text-white font-semibold text-sm w-12 text-right">{percent}%</span>
          </div>
          {maxFromSource < 1 && (
            <p className="text-xs text-red-400 mt-1">No shares available from this source.</p>
          )}
        </div>

        {/* Summary */}
        <div className="glass-card p-3 mb-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Cost</span>
            <span className="text-white font-semibold">{formatCurrency(cost)}</span>
          </div>
          {estDailyDiv > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Est. daily dividend</span>
              <span className="text-green-400">+{formatCurrency(estDailyDiv)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Your stake after</span>
            <span className={`font-semibold ${willHaveMajority ? 'text-teal-300' : 'text-white'}`}>
              {stakeAfter.toFixed(0)}%{willHaveMajority ? ' ✓ Majority' : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Cash after</span>
            <span className={canAfford ? 'text-white' : 'text-red-400'}>
              {formatCurrency(player.cashUSD - cost)}
            </span>
          </div>
        </div>

        {!canAfford && (
          <p className="text-red-400 text-xs mb-3 text-center">
            Insufficient funds — need {formatCurrency(cost - player.cashUSD)} more.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={closeModal} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-lg transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={handleBuy}
            disabled={!canAfford || !hasSource || percent <= 0}
            className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Buy {percent}% — {formatCurrency(cost)}
          </button>
        </div>
      </div>
    </div>
  );
};
