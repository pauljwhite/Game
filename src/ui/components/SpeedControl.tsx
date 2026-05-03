import React from 'react';
import { useGameStore } from '@/store';
import type { GameSpeed } from '@/types';

const SPEEDS: GameSpeed[] = [0, 1, 5, 10, 50, 100];

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
      {SPEEDS.filter(s => s > 0).map(s => (
        <button
          key={s}
          onClick={() => setSpeed(s)}
          className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
            speed === s && !isPaused
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {s}x
        </button>
      ))}
    </div>
  );
};
