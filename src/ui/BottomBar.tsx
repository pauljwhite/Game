import React from 'react';
import { useGameStore } from '@/store';

export const BottomBar: React.FC = () => {
  const newsTicker = useGameStore(s => s.newsTicker);
  const newspaperQueue = useGameStore(s => s.newspaperQueue);
  const openModalById = useGameStore(s => s.openModalById);
  const latestNews = newsTicker[0] ?? { id: 'fallback', text: 'Welcome to Mighty Airline Empire!' };
  const isFleetAlert = latestNews.severity === 'fleet' || latestNews.severity === 'breaking';
  const linkedArticleId = latestNews.articleId && newspaperQueue.some(article => article.id === latestNews.articleId)
    ? latestNews.articleId
    : undefined;
  const tickerClass = linkedArticleId
    ? 'text-orange-100 font-bold underline decoration-orange-200/80 decoration-1 underline-offset-4'
    : isFleetAlert
      ? 'text-orange-200 font-semibold'
      : 'text-gray-300';
  const tickerText = linkedArticleId ? `${latestNews.text} Read the article` : latestNews.text;

  function handleClick() {
    if (linkedArticleId) openModalById('newspaper', { articleId: linkedArticleId, readOnly: true });
  }

  return (
    <footer className="h-10 glass-nav border-t flex items-center px-2 sm:px-4 shrink-0 z-40 overflow-hidden">
      <span className={`soft-tag mr-2 shrink-0 ${isFleetAlert ? 'text-orange-100 border-orange-300/30 bg-orange-500/20' : 'text-yellow-200'}`}>
        {isFleetAlert ? 'FLEET ALERT' : 'NEWS'}
      </span>
      <button
        type="button"
        onClick={handleClick}
        disabled={!linkedArticleId}
        className={`flex-1 overflow-hidden text-left ${linkedArticleId ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
        title={linkedArticleId ? 'Open Aviation Herald article' : undefined}
      >
        <div className={`news-ticker-track text-xs whitespace-nowrap ${tickerClass}`}>
          <span className="news-ticker-item">{tickerText}</span>
          <span className="news-ticker-item" aria-hidden="true">{tickerText}</span>
        </div>
      </button>
    </footer>
  );
};
