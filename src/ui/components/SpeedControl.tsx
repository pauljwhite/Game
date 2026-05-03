import React from 'react';
import { useGameStore } from '@/store';
import type { GameSpeed } from '@/types';

const SPEEDS: { value: GameSpeed; label: string; title: string }[] = [
  { value: 60,    label: '1×', title: '1× speed' },
  { value: 300,   label: '2×', title: '2× speed' },
  { value: 1200,  label: '3×', title: '3× speed' },
  { value: 3600,  label: '4×', title: '4× speed' },
  { value: 14400, label: '5×', title: '5× speed' },
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
          {option.label}
        </button>
      ))}
    </div>
  );
};
