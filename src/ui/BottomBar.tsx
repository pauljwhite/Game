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

  const totalPax = allAirlines.reduce((s, a) => s + a.totalPassengersAllTime, 0);

  const sorted = [...allAirlines].sort((a, b) => b.totalPassengersAllTime - a.totalPassengersAllTime);

  const latestNews = newsTicker[0] ?? 'Welcome to Airline Empire!';

  return (
    <footer className="h-10 bg-gray-950 border-t border-gray-800 flex items-center px-4 gap-4 shrink-0 z-40 overflow-hidden">
      {/* Market share bars */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-gray-500 text-xs">Share:</span>
        <div className="flex items-center gap-1 h-4">
          {sorted.slice(0, 6).map(a => {
            const share = totalPax > 0 ? (a.totalPassengersAllTime / totalPax) * 100 : 0;
            return (
              <div key={a.id} className="flex items-center gap-0.5">
                <div
                  className="h-4 rounded-sm min-w-[2px] transition-all"
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

      <div className="text-gray-700">|</div>

      {/* News ticker */}
      <div className="flex-1 overflow-hidden">
        <div className="text-gray-300 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="text-yellow-400 mr-2">NEWS</span>
          {latestNews}
        </div>
      </div>
    </footer>
  );
};
