import React from 'react';
import { useGameStore } from '@/store';

export const BottomBar: React.FC = () => {
  const airlines = useGameStore(s => s.airlines);
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const newsTicker = useGameStore(s => s.newsTicker);

  const allAirlines = [
    ...Object.values(airlines),
    ...Object.values(aiAirlines),
  ];

  const getDailyPax = (a: (typeof allAirlines)[number]) => a.dailyStats.at(-1)?.passengers ?? 0;

  const totalPax = allAirlines.reduce((s, a) => s + getDailyPax(a), 0);

  const sorted = [...allAirlines].sort((a, b) => getDailyPax(b) - getDailyPax(a));

  const latestNews = newsTicker[0] ?? 'Welcome to Mighty Airline Empire!';

  return (
    <footer className="h-10 glass-nav border-t flex items-center px-2 sm:px-4 gap-2 sm:gap-4 shrink-0 z-40 overflow-hidden">
      {/* Market share bars */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className="soft-tag">Share</span>
        <div className="flex items-center gap-1 h-4">
          {sorted.slice(0, 6).map(a => {
            const share = totalPax > 0 ? (getDailyPax(a) / totalPax) * 100 : 0;
            return (
              <div key={a.id} className="flex items-center gap-0.5">
                <div
                  className="h-4 rounded-full min-w-[2px] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  style={{ width: `${Math.max(2, share * 1.5)}px`, backgroundColor: a.color }}
                  title={`${a.name}: ${share.toFixed(1)}%`}
                />
                <span className="text-xs hidden xl:inline" style={{ color: a.color }}>
                  {share.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden sm:block h-5 w-px bg-white/10" />

      {/* News ticker */}
      <div className="flex-1 overflow-hidden">
        <div className="text-gray-300 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="soft-tag mr-1.5 sm:mr-2 text-yellow-200">NEWS</span>
          {latestNews}
        </div>
      </div>
    </footer>
  );
};
