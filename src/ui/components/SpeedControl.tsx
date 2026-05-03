import React from 'react';
import { useGameStore } from '@/store';
import type { GameSpeed } from '@/types';

const SPEEDS: { value: GameSpeed; label: string; shortLabel: string; title: string }[] = [
  { value: 60,    label: '1m/s',  shortLabel: '1m',  title: '1 game minute per second' },
  { value: 300,   label: '5m/s',  shortLabel: '5m',  title: '5 game minutes per second' },
  { value: 1200,  label: '20m/s', shortLabel: '20m', title: '20 game minutes per second' },
  { value: 3600,  label: '1h/s',  shortLabel: '1h',  title: '1 game hour per second' },
  { value: 14400, label: '4h/s',  shortLabel: '4h',  title: '4 game hours per second' },
];

export const SpeedControl: React.FC = () => {
  const speed = useGameStore(s => s.speed);
  const isPaused = useGameStore(s => s.isPaused);
  const setSpeed = useGameStore(s => s.setSpeed);
  const togglePause = useGameStore(s => s.togglePause);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={togglePause}
        className={`px-2 py-1 rounded text-sm font-mono font-bold transition-colors ${
          isPaused ? 'bg-yellow-500 text-black' : 'bg-gray-600 text-white hover:bg-gray-500'
        }`}
        title={isPaused ? 'Resume' : 'Pause'}
      >
        {isPaused ? '▶' : '⏸'}
      </button>
      {SPEEDS.map(option => (
        <button
          key={option.value}
          onClick={() => setSpeed(option.value)}
          title={option.title}
          className={`px-1.5 py-1 rounded text-xs font-mono transition-colors ${
            speed === option.value && !isPaused
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <span className="hidden sm:inline">{option.label}</span>
          <span className="sm:hidden">{option.shortLabel}</span>
        </button>
      ))}
    </div>
  );
};
