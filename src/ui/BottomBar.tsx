import React from 'react';
import { useGameStore } from '@/store';

export const BottomBar: React.FC = () => {
  const newsTicker = useGameStore(s => s.newsTicker);
  const latestNews = newsTicker[0] ?? 'Welcome to Mighty Airline Empire!';

  return (
    <footer className="h-10 glass-nav border-t flex items-center px-2 sm:px-4 shrink-0 z-40 overflow-hidden">
      <span className="soft-tag mr-2 text-yellow-200 shrink-0">NEWS</span>
      <div className="flex-1 overflow-hidden">
        <div className="news-ticker-track text-gray-300 text-xs whitespace-nowrap">
          <span className="news-ticker-item">{latestNews}</span>
          <span className="news-ticker-item" aria-hidden="true">{latestNews}</span>
        </div>
      </div>
    </footer>
  );
};
