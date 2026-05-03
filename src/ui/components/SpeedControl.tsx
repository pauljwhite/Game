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
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <button
        onClick={togglePause}
        className={`rounded-full px-2 py-1 text-sm font-mono font-bold transition-all active:scale-95 ${
          isPaused ? 'bg-yellow-400 text-slate-950 shadow-[0_4px_14px_rgba(250,204,21,0.22)]' : 'text-white hover:bg-white/[0.11]'
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
          className={`rounded-full px-2 py-1 text-xs font-mono transition-all active:scale-95 ${
            speed === option.value && !isPaused
              ? 'bg-sky-400/85 text-white shadow-[0_4px_14px_rgba(56,189,248,0.2)]'
              : 'text-slate-300 hover:bg-white/[0.1] hover:text-white'
          }`}
        >
          <span className="hidden sm:inline">{option.label}</span>
          <span className="sm:hidden">{option.shortLabel}</span>
        </button>
      ))}
    </div>
  );
};
