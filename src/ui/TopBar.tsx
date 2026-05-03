import React, { useRef, useState, useEffect } from 'react';
import { useGameStore } from '@/store';
import { SpeedControl } from './components/SpeedControl';
import { formatCurrency, formatGameClock, formatGameDate, formatNumber } from '@/utils/format';
import { clearSave } from '@/utils/persistence';
import type { PanelId } from '@/store/uiSlice';

const NAV_ITEMS: { id: PanelId; label: string }[] = [
  { id: 'fleet', label: 'Fleet' },
  { id: 'routes', label: 'Routes' },
  { id: 'finance', label: 'Finance' },
  { id: 'hubs', label: 'Hubs' },
  { id: 'airlines', label: 'Competitors' },
];

function reputationColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

const AirlineMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const airlines = useGameStore(s => s.airlines);
  const aircraft = useGameStore(s => s.aircraft);
  const routes = useGameStore(s => s.routes);
  const gameTimeMs = useGameStore(s => s.gameTimeMs);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const player = airlines['player'];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!player) return null;

  const fleetCount = player.fleetIds.length;
  const activeRoutes = player.routeIds.filter(id => routes[id]?.isActive).length;
  const totalRoutes = player.routeIds.length;
  const hubCount = player.hubIatas.length;
  const idleCount = player.fleetIds.filter(id => aircraft[id]?.status === 'idle').length;
  const maintenanceCount = player.fleetIds.filter(id => aircraft[id]?.status === 'maintenance').length;

  const todayStats = player.dailyStats[player.dailyStats.length - 1];

  const foundedDate = formatGameDate(0);
  const currentDate = formatGameDate(gameTimeMs);
  void foundedDate; void currentDate;

  function handleStartAgain() {
    if (!confirming) { setConfirming(true); return; }
    clearSave();
    window.location.reload();
  }

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[9999] overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800" style={{ borderLeftColor: player.color, borderLeftWidth: 3 }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{player.logoEmoji}</span>
          <div>
            <div className="text-white font-bold text-sm">{player.name}</div>
            <div className="text-gray-500 text-xs">Founded {formatGameDate(0)} · IATA: {player.iataPrefix}</div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-b border-gray-800">
        <div>
          <div className="text-gray-500">Fleet</div>
          <div className="text-white font-semibold">{fleetCount} aircraft</div>
          {(idleCount > 0 || maintenanceCount > 0) && (
            <div className="text-gray-500 text-[10px]">
              {idleCount > 0 && `${idleCount} idle`}
              {idleCount > 0 && maintenanceCount > 0 && ' · '}
              {maintenanceCount > 0 && `${maintenanceCount} in maint.`}
            </div>
          )}
        </div>
        <div>
          <div className="text-gray-500">Routes</div>
          <div className="text-white font-semibold">{totalRoutes} routes</div>
          <div className="text-gray-500 text-[10px]">{activeRoutes} active</div>
        </div>
        <div>
          <div className="text-gray-500">Hubs</div>
          <div className="text-white font-semibold">
            {hubCount > 0 ? player.hubIatas.join(', ') : 'None'}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Reputation</div>
          <div className={`font-semibold ${reputationColor(player.reputationScore)}`}>
            {player.reputationScore.toFixed(0)} / 100
          </div>
        </div>
        <div>
          <div className="text-gray-500">Market Share</div>
          <div className="text-white font-semibold">{player.marketSharePercent.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-gray-500">Pax All-Time</div>
          <div className="text-white font-semibold">{formatNumber(player.totalPassengersAllTime)}</div>
        </div>
        <div>
          <div className="text-gray-500">Cash</div>
          <div className={`font-semibold ${player.cashUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(player.cashUSD)}
          </div>
        </div>
        {player.totalDebt > 0 && (
          <div>
            <div className="text-gray-500">Debt</div>
            <div className="text-red-400 font-semibold">{formatCurrency(player.totalDebt)}</div>
          </div>
        )}
        {todayStats && (
          <div className="col-span-2">
            <div className="text-gray-500">Today's P&L</div>
            <div className={`font-semibold ${todayStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(todayStats.profit)} · {formatNumber(todayStats.passengers)} pax
            </div>
          </div>
        )}
      </div>

      {/* Start Again */}
      <div className="px-4 py-3">
        <button
          onClick={handleStartAgain}
          onMouseLeave={() => setConfirming(false)}
          className={`w-full py-2 rounded text-xs font-semibold transition-colors ${
            confirming
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
          }`}
        >
          {confirming ? 'Click again to confirm — all progress lost' : 'Start Again'}
        </button>
      </div>
    </div>
  );
};

export const TopBar: React.FC = () => {
  const airlines = useGameStore(s => s.airlines);
  const gameTimeMs = useGameStore(s => s.gameTimeMs);
  const openPanel = useGameStore(s => s.openPanel);
  const openPanelById = useGameStore(s => s.openPanelById);
  const closePanel = useGameStore(s => s.closePanel);
  const [menuOpen, setMenuOpen] = useState(false);

  const playerAirline = airlines['player'];
  const gameDate = formatGameDate(gameTimeMs);
  const gameClock = formatGameClock(gameTimeMs);

  const togglePanel = (id: PanelId) => {
    openPanel === id ? closePanel() : openPanelById(id);
  };

  return (
    <header className="h-14 bg-gray-950 border-b border-gray-800 flex items-center px-4 gap-4 relative z-40 shrink-0">
      {/* Airline branding — clickable */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2 min-w-0 hover:bg-gray-800 rounded px-2 py-1 transition-colors"
        >
          <span className="text-xl">{playerAirline?.logoEmoji ?? '✈'}</span>
          <div className="leading-none min-w-0 text-left">
            <div className="text-white font-bold text-sm truncate max-w-[160px]">
              {playerAirline?.name ?? 'Airline Empire'}
            </div>
            <div className={`text-xs font-mono ${(playerAirline?.cashUSD ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {playerAirline ? formatCurrency(playerAirline.cashUSD) : '-'}
            </div>
          </div>
          <span className="text-gray-600 text-xs ml-1">▾</span>
        </button>
        {menuOpen && <AirlineMenu onClose={() => setMenuOpen(false)} />}
      </div>

      <div className="text-gray-500">|</div>

      {/* Game date */}
      <div className="text-gray-300 text-sm font-mono shrink-0">
        <span>{gameDate}</span>
        <span className="text-gray-500 mx-2">|</span>
        <span className="text-blue-300">{gameClock}</span>
      </div>

      <div className="text-gray-500">|</div>

      {/* Speed control */}
      <SpeedControl />

      <div className="flex-1" />

      {/* Navigation */}
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => togglePanel(item.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              openPanel === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
