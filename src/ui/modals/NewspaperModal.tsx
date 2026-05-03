import React from 'react';
import { useGameStore } from '@/store';
import { formatGameDate } from '@/utils/format';

const SEVERITY_STYLES = {
  crash:     { bar: 'bg-red-600',    label: 'BREAKING NEWS',  labelCls: 'text-red-400', border: 'border-red-900/60' },
  grounding: { bar: 'bg-orange-500', label: 'AVIATION ALERT', labelCls: 'text-orange-400', border: 'border-orange-900/60' },
  incident:  { bar: 'bg-blue-500',   label: 'INCIDENT REPORT', labelCls: 'text-blue-400', border: 'border-blue-900/60' },
};

export const NewspaperModal: React.FC = () => {
  const article      = useGameStore(s => s.newspaperQueue[0]);
  const gameTimeMs   = useGameStore(s => s.gameTimeMs);
  const closeModal   = useGameStore(s => s.closeModal);
  const popNewspaper = useGameStore(s => s.popNewspaper);

  if (!article) return null;

  const styles  = SEVERITY_STYLES[article.severity];
  const gameDate = formatGameDate(gameTimeMs);

  function handleClose() {
    closeModal();
    popNewspaper();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-lg max-h-[90svh] overflow-y-auto rounded-lg border ${styles.border} shadow-2xl`}
        style={{ background: '#f5f0e8', color: '#1a1008' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Severity bar */}
        <div className={`h-1.5 w-full ${styles.bar} rounded-t-lg`} />

        <div className="px-5 pt-4 pb-5">
          {/* Masthead */}
          <div className="flex items-center justify-between border-b-2 border-current pb-2 mb-3" style={{ borderColor: '#1a1008' }}>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-5 h-5 opacity-70" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1l3.5 1v-1.5L13 19v-5.5z"/>
              </svg>
              <span className="font-serif font-black text-base tracking-widest uppercase" style={{ letterSpacing: '0.15em' }}>
                The Aviation Herald
              </span>
            </div>
            <div className="text-right">
              <div className={`text-[10px] font-bold uppercase tracking-wider ${styles.labelCls}`} style={{ color: styles.labelCls.includes('red') ? '#dc2626' : styles.labelCls.includes('orange') ? '#ea580c' : '#2563eb' }}>
                {styles.label}
              </div>
              <div className="text-[10px] opacity-50 font-mono">{gameDate}</div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-serif font-black text-2xl leading-tight mb-2 uppercase" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {article.headline}
          </h1>

          {/* Subheadline */}
          <p className="text-sm italic opacity-70 mb-4 leading-snug border-b border-current pb-3" style={{ borderColor: 'rgba(26,16,8,0.2)' }}>
            {article.subheadline}
          </p>

          {/* Body */}
          <div className="space-y-3">
            {article.paragraphs.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'justify' }}>
                {i === 0 && (
                  <span className="float-left font-black text-5xl leading-none mr-1 mt-1" style={{ lineHeight: '0.85' }}>
                    {para.charAt(0)}
                  </span>
                )}
                {i === 0 ? para.slice(1) : para}
              </p>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-5 pt-3 border-t border-current flex items-center justify-between" style={{ borderColor: 'rgba(26,16,8,0.2)' }}>
            <span className="text-[10px] opacity-40 italic">
              Reported by our aviation correspondent
            </span>
            <button
              onClick={handleClose}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded"
              style={{ background: '#1a1008', color: '#f5f0e8' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
