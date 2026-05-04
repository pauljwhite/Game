import React from 'react';
import { useGameStore } from '@/store';
import { formatCurrency, formatGameDate } from '@/utils/format';
import { GAME_EPOCH_YEAR } from '@/utils/constants';
import { startGameLoop } from '@/engine/gameLoop';

export const GameOverModal: React.FC = () => {
  const modalPayload = useGameStore(s => s.modalPayload);
  const airlines   = useGameStore(s => s.airlines);
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const routes     = useGameStore(s => s.routes);
  const gameTimeMs = useGameStore(s => s.gameTimeMs);
  const openModalById = useGameStore(s => s.openModalById);
  const playerAirlineId = useGameStore(s => s.playerAirlineId);

  const closeModal = useGameStore(s => s.closeModal);
  const result = modalPayload as 'win' | 'lose' | null;
  const playerAirline = airlines[playerAirlineId];

  if (!result || !playerAirline) return null;

  const isWin = result === 'win';

  const playerRouteCount = Object.values(routes).filter(r => r.airlineId === playerAirlineId).length;

  // Years of operation: difference between current game time and epoch
  const epochMs = new Date(GAME_EPOCH_YEAR, 0, 1).getTime();
  const currentYear = new Date(epochMs + gameTimeMs).getFullYear();
  const yearsOfOperation = currentYear - GAME_EPOCH_YEAR;

  const currentDate = formatGameDate(gameTimeMs);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]">
      <div className="glass-panel rounded-t-2xl sm:rounded-xl px-4 sm:px-6 py-4 w-full max-w-md relative max-h-[92svh] overflow-y-auto overscroll-contain">
        {/* Result header */}
        <div className={`text-center mb-6 ${isWin ? 'text-yellow-400' : 'text-red-400'}`}>
          <div className="text-5xl mb-3">{isWin ? '🏆' : '💸'}</div>
          <div className={`text-3xl font-black tracking-wide ${isWin ? 'text-yellow-400' : 'text-red-400'}`}>
            {isWin ? 'VICTORY' : 'GAME OVER'}
          </div>
          <div className="text-gray-400 text-sm mt-1">{currentDate}</div>
        </div>

        {/* Condition explanation */}
        <div className={`rounded-lg p-3 mb-5 text-center text-sm ${isWin ? 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-300' : 'bg-red-900/30 border border-red-700/50 text-red-300'}`}>
          {isWin
            ? 'Every rival airline has collapsed. You are the last carrier standing — a true monopoly!'
            : 'Your airline accumulated over $100M in debt and became insolvent.'}
        </div>

        {/* Stats */}
        <div className="glass-card p-4 mb-6 space-y-3">
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Final Stats</div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Airline</span>
            <span className="text-white font-semibold">
              {playerAirline.logoEmoji} {playerAirline.name}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Final Cash</span>
            <span className={`font-semibold ${playerAirline.cashUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(playerAirline.cashUSD)}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Total Passengers</span>
            <span className="text-white font-semibold">
              {playerAirline.totalPassengersAllTime.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Total Routes</span>
            <span className="text-white font-semibold">{playerRouteCount}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Fleet Size</span>
            <span className="text-white font-semibold">{playerAirline.fleetIds.length} aircraft</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Years of Operation</span>
            <span className="text-white font-semibold">{yearsOfOperation} yr{yearsOfOperation !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Market Share</span>
            <span className="text-white font-semibold">
              {(() => {
                const totalPax = playerAirline.totalPassengersAllTime +
                  Object.values(aiAirlines).reduce((s, a) => s + a.totalPassengersAllTime, 0);
                return totalPax > 0
                  ? ((playerAirline.totalPassengersAllTime / totalPax) * 100).toFixed(1)
                  : '0.0';
              })()}%
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Reputation</span>
            <span className="text-white font-semibold">{Math.round(playerAirline.reputationScore)}/100</span>
          </div>
        </div>

        {/* Actions */}
        <div className={`flex gap-2 ${isWin ? 'flex-col sm:flex-row' : ''}`}>
          {isWin && (
            <button
              onClick={() => { closeModal(); startGameLoop(); }}
              className="flex-1 py-3 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold rounded-lg transition-colors text-sm"
            >
              Continue Playing
            </button>
          )}
          <button
            onClick={() => openModalById('newGame')}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};
