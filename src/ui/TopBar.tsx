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
  const airlines      = useGameStore(s => s.airlines);
  const aiAirlines    = useGameStore(s => s.aiAirlines);
  const aircraft      = useGameStore(s => s.aircraft);
  const routes        = useGameStore(s => s.routes);
  const gameTimeMs    = useGameStore(s => s.gameTimeMs);
  const openModalById = useGameStore(s => s.openModalById);
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
      className="fixed left-2 right-2 top-[3.25rem] sm:absolute sm:top-full sm:left-0 sm:right-auto sm:mt-2 sm:w-72 max-w-[calc(100vw-1rem)] rounded-xl z-[9999] overflow-hidden border border-white/10 bg-gray-950/95 shadow-2xl backdrop-blur-xl"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-white/[0.035]" style={{ borderLeftColor: player.color, borderLeftWidth: 3 }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{player.logoEmoji}</span>
          <div>
            <div className="text-white font-bold text-sm">{player.name}</div>
            <div className="text-gray-500 text-xs">Founded {formatGameDate(0)} · IATA: {player.iataPrefix}</div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-b border-white/10">
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
          <div className="text-white font-semibold">{(() => {
            const playerPax = player.totalPassengersAllTime ?? 0;
            const aiPax = Object.values(aiAirlines).reduce((s, a) => s + (a.totalPassengersAllTime ?? 0), 0);
            const totalPax = playerPax + aiPax;
            return totalPax > 0 ? ((playerPax / totalPax) * 100).toFixed(1) : '0.0';
          })()}%</div>
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

      {/* Actions */}
      <div className="px-4 py-3 space-y-2">
        <button
          onClick={() => { onClose(); openModalById('rebrand'); }}
          className="apple-button w-full py-2 text-xs font-semibold"
        >
          ✏ Rebrand Airline
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { onClose(); openModalById('settings'); }}
            className="apple-button w-full py-2 text-xs font-semibold"
          >
            Theme
          </button>
          <button
            onClick={handleStartAgain}
            onMouseLeave={() => setConfirming(false)}
            className={`w-full py-2 rounded text-xs font-semibold transition-colors ${
              confirming
                ? 'apple-button-danger'
                : 'apple-button'
            }`}
          >
            {confirming ? 'Confirm reset' : 'Start Again'}
          </button>
        </div>
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
    <header className="glass-nav border-b relative z-10 shrink-0">
      {/* Primary row: branding | date | speed | (nav on lg+) */}
      <div className="min-h-12 flex items-center px-2 sm:px-3 gap-1.5 sm:gap-2">
        {/* Airline branding — clickable */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-1.5 min-w-0 rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 transition-all hover:bg-white/[0.09]"
          >
            <span className="text-lg">{playerAirline?.logoEmoji ?? '✈'}</span>
            <div className="leading-none min-w-0 text-left">
              <div className="text-white font-bold text-xs truncate max-w-[86px] min-[380px]:max-w-[110px] sm:max-w-[160px]">
                {playerAirline?.name ?? 'Mighty Airline Empire'}
              </div>
              <div className={`hidden min-[380px]:block text-xs font-mono ${(playerAirline?.cashUSD ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {playerAirline ? formatCurrency(playerAirline.cashUSD) : '-'}
              </div>
            </div>
            <span className="text-gray-600 text-xs">▾</span>
          </button>
          {menuOpen && <AirlineMenu onClose={() => setMenuOpen(false)} />}
        </div>

        {/* Date — hidden on xs, shown from sm */}
        <div className="hidden sm:flex items-center gap-1 text-xs font-mono shrink-0">
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">{gameDate}</span>
          <span className="text-gray-600">·</span>
          <span className="text-blue-300">{gameClock}</span>
        </div>

        <div className="flex-1" />

        {/* Speed control */}
        <SpeedControl />

        {/* Navigation — only on lg and wider */}
        <nav className="hidden lg:flex items-center gap-1 ml-2 shrink-0">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => togglePanel(item.id)}
              className={`nav-pill ${
                openPanel === item.id
                  ? 'nav-pill-active'
                  : ''
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Secondary nav row — visible below lg */}
      <div className="lg:hidden flex items-center gap-1 px-2 sm:px-3 pb-1.5 overflow-x-auto scrollbar-none">
        <div className="flex sm:hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] px-2.5 h-10 shrink-0 text-[11px] font-mono">
          <span className="text-gray-300">{gameDate}</span>
          <span className="text-gray-600">Â·</span>
          <span className="text-blue-300">{gameClock}</span>
        </div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => togglePanel(item.id)}
            className={`nav-pill whitespace-nowrap shrink-0 ${
              openPanel === item.id
                ? 'nav-pill-active'
                : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
