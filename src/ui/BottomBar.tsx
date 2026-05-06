import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/store';
import type { NewsTickerItem } from '@/store/uiSlice';

const FALLBACK_NEWS: NewsTickerItem = {
  id: 'fallback',
  text: 'Welcome to Mighty Airline Empire!',
};

export const BottomBar: React.FC = () => {
  const newsTicker = useGameStore(s => s.newsTicker);
  const newspaperQueue = useGameStore(s => s.newspaperQueue);
  const openModalById = useGameStore(s => s.openModalById);
  const speed = useGameStore(s => s.speed);
  const tickerItems = useMemo(
    () => newsTicker.length > 0 ? newsTicker.slice(0, 8) : [FALLBACK_NEWS],
    [newsTicker],
  );
  const tickerDuration = speed >= 14400 ? 5 : speed >= 3600 ? 7 : speed >= 1200 ? 10 : speed >= 300 ? 15 : 22;
  const [latestNews, setLatestNews] = useState<NewsTickerItem>(tickerItems[0]);
  const isFleetAlert = latestNews.severity === 'fleet' || latestNews.severity === 'breaking';
  const isPlayerAlert = !!latestNews.playerRelated || isFleetAlert;
  const linkedArticleId = latestNews.articleId && newspaperQueue.some(article => article.id === latestNews.articleId)
    ? latestNews.articleId
    : undefined;
  const tickerClass = linkedArticleId
    ? 'text-orange-100 font-bold underline decoration-orange-200/80 decoration-1 underline-offset-4'
    : isFleetAlert
      ? 'text-orange-200 font-semibold'
      : 'text-gray-300';
  const tickerPrefix = isPlayerAlert ? '‼️ ' : '';
  const tickerText = linkedArticleId
    ? `${tickerPrefix}${latestNews.text} Read the article`
    : `${tickerPrefix}${latestNews.text}`;

  function handleClick() {
    if (linkedArticleId) openModalById('newspaper', { articleId: linkedArticleId, readOnly: true });
  }

  function advanceTicker() {
    setLatestNews(current => {
      const currentIndex = tickerItems.findIndex(item => item.id === current.id);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tickerItems.length;
      return tickerItems[nextIndex];
    });
  }

  return (
    <footer className="h-10 glass-nav border-t flex items-center px-2 sm:px-4 shrink-0 z-40 overflow-hidden">
      <span className={`soft-tag mr-2 shrink-0 ${isPlayerAlert ? 'text-orange-100 border-orange-300/30 bg-orange-500/20' : 'text-yellow-200'}`}>
        {isPlayerAlert ? 'FLEET ALERT' : 'NEWS'}
      </span>
      <button
        type="button"
        onClick={handleClick}
        disabled={!linkedArticleId}
        className={`flex-1 overflow-hidden text-left ${linkedArticleId ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
        title={linkedArticleId ? 'Open Aviation Herald article' : undefined}
      >
        <div
          key={latestNews.id}
          className={`news-ticker-track text-xs whitespace-nowrap ${tickerClass}`}
          style={{ animationDuration: `${tickerDuration}s` }}
          onAnimationIteration={advanceTicker}
        >
          <span className="news-ticker-item">{tickerText}</span>
          <span className="news-ticker-item" aria-hidden="true">{tickerText}</span>
        </div>
      </button>
    </footer>
  );
};
