import React from 'react';
import { useGameStore } from '@/store';
import { SpeedControl } from './components/SpeedControl';
import { formatCurrency, formatGameClock, formatGameDate } from '@/utils/format';
import type { PanelId } from '@/store/uiSlice';

const NAV_ITEMS: { id: PanelId; label: string }[] = [
  { id: 'fleet', label: 'Fleet' },
  { id: 'routes', label: 'Routes' },
  { id: 'finance', label: 'Finance' },
  { id: 'hubs', label: 'Hubs' },
  { id: 'airlines', label: 'Competitors' },
];

export const TopBar: React.FC = () => {
  const airlines = useGameStore(s => s.airlines);
  const gameTimeMs = useGameStore(s => s.gameTimeMs);
  const openPanel = useGameStore(s => s.openPanel);
  const openPanelById = useGameStore(s => s.openPanelById);
  const closePanel = useGameStore(s => s.closePanel);

  const playerAirline = airlines['player'];
  const gameDate = formatGameDate(gameTimeMs);
  const gameClock = formatGameClock(gameTimeMs);

  const togglePanel = (id: PanelId) => {
    openPanel === id ? closePanel() : openPanelById(id);
  };

  return (
    <header className="h-14 bg-gray-950 border-b border-gray-800 flex items-center px-4 gap-4 z-40 shrink-0">
      {/* Airline branding */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xl">✈</span>
        <div className="leading-none min-w-0">
          <div className="text-white font-bold text-sm truncate max-w-[160px]">
            {playerAirline?.name ?? 'Airline Empire'}
          </div>
          <div className={`text-xs font-mono ${(playerAirline?.cashUSD ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {playerAirline ? formatCurrency(playerAirline.cashUSD) : '-'}
          </div>
        </div>
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
