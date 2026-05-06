import React from 'react';
import { useGameStore } from '@/store';
import { formatGameDate, formatCurrency } from '@/utils/format';

const SEVERITY_STYLES = {
  crash:     { bar: 'bg-red-600',    label: 'BREAKING NEWS',   labelColor: '#dc2626' },
  grounding: { bar: 'bg-orange-500', label: 'AVIATION ALERT',  labelColor: '#ea580c' },
  incident:  { bar: 'bg-blue-500',   label: 'INCIDENT REPORT', labelColor: '#2563eb' },
};

export const NewspaperModal: React.FC = () => {
  const newspaperQueue = useGameStore(s => s.newspaperQueue);
  const modalPayload   = useGameStore(s => s.modalPayload);
  const gameTimeMs     = useGameStore(s => s.gameTimeMs);
  const gameDay        = useGameStore(s => s.gameDay);
  const closeModal     = useGameStore(s => s.closeModal);
  const popNewspaper   = useGameStore(s => s.popNewspaper);
  const ignoreGrounding = useGameStore(s => s.ignoreGrounding);
  const startMaintenance = useGameStore(s => s.startMaintenance);
  const policy = useGameStore(s => s.airlines['player']?.maintenancePolicy);
  const setMaintenancePolicy = useGameStore(s => s.setMaintenancePolicy);

  const requestedArticleId = typeof modalPayload === 'string'
    ? modalPayload
    : modalPayload && typeof modalPayload === 'object' && 'articleId' in modalPayload && typeof modalPayload.articleId === 'string'
      ? modalPayload.articleId
      : null;
  const readOnly = !!(
    modalPayload &&
    typeof modalPayload === 'object' &&
    'readOnly' in modalPayload &&
    modalPayload.readOnly === true
  );
  const article = requestedArticleId
    ? newspaperQueue.find(item => item.id === requestedArticleId)
    : newspaperQueue.find(item => !item.suppressAutoOpen) ?? newspaperQueue[0];

  if (!article) return null;
  const currentArticle = article;

  const styles   = SEVERITY_STYLES[currentArticle.severity];
  const gameDate = formatGameDate(gameTimeMs);
  const hasActions = !!currentArticle.actionAircraftId && !readOnly;

  function dismiss() {
    closeModal();
    if (!readOnly) popNewspaper(currentArticle.id);
  }

  function handleMaintenance() {
    if (!currentArticle.actionAircraftId) return;
    startMaintenance(currentArticle.actionAircraftId, gameDay, 'standard');
    dismiss();
  }

  function handleAlwaysMaintainIssues() {
    if (policy) setMaintenancePolicy({ ...policy, autoMaintainIssues: true });
    handleMaintenance();
  }

  function handleKeepFlying() {
    if (!currentArticle.actionAircraftId) return;
    ignoreGrounding(currentArticle.actionAircraftId);
    dismiss();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={!hasActions ? dismiss : undefined}
    >
      <div
        className="relative w-full max-w-lg max-h-[92svh] overflow-y-auto rounded-lg shadow-2xl"
        style={{ background: '#f5f0e8', color: '#1a1008' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Severity accent bar */}
        <div className={`h-1.5 w-full ${styles.bar} rounded-t-lg`} />

        <div className="px-5 pt-4 pb-5">
          {/* Masthead */}
          <div className="flex items-center justify-between border-b-2 pb-2 mb-3" style={{ borderColor: '#1a1008' }}>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-5 h-5 opacity-70" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1l3.5 1v-1.5L13 19v-5.5z"/>
              </svg>
              <span className="font-serif font-black text-base tracking-widest uppercase" style={{ letterSpacing: '0.15em', fontFamily: 'Georgia, "Times New Roman", serif' }}>
                The Aviation Herald
              </span>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: styles.labelColor }}>
                {styles.label}
              </div>
              <div className="text-[10px] opacity-50 font-mono">{gameDate}</div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-black text-2xl leading-tight mb-2 uppercase" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {currentArticle.headline}
          </h1>

          {/* Subheadline */}
          <p className="text-sm italic opacity-70 mb-4 leading-snug border-b pb-3" style={{ borderColor: 'rgba(26,16,8,0.2)', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {currentArticle.subheadline}
          </p>

          {/* Body */}
          <div className="space-y-3 mb-5">
            {currentArticle.paragraphs.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'justify' }}>
                {i === 0 && (
                  <span className="float-left font-black mr-1" style={{ fontSize: '3.2rem', lineHeight: '0.82' }}>
                    {para.charAt(0)}
                  </span>
                )}
                {i === 0 ? para.slice(1) : para}
              </p>
            ))}
          </div>

          {/* Actions */}
          <div className="border-t pt-4" style={{ borderColor: 'rgba(26,16,8,0.2)' }}>
            {hasActions ? (
              <div className="space-y-2">
                <p className="text-xs italic opacity-60 mb-3" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  Your operations team requires a decision on how to proceed.
                </p>
                <button
                  onClick={handleMaintenance}
                  className="w-full py-2.5 px-4 rounded text-sm font-bold text-left flex items-center justify-between transition-opacity hover:opacity-90"
                  style={{ background: '#1a4a1a', color: '#d4edda' }}
                >
                  <span>Send to Maintenance (Standard)</span>
                  {currentArticle.actionMaintenanceCost ? (
                    <span className="text-xs opacity-80">{formatCurrency(currentArticle.actionMaintenanceCost)}</span>
                  ) : null}
                </button>
                <button
                  onClick={handleAlwaysMaintainIssues}
                  className="w-full py-2.5 px-4 rounded text-sm font-bold text-left flex items-center justify-between transition-opacity hover:opacity-90"
                  style={{ background: '#164e63', color: '#cffafe' }}
                >
                  <span>Always Send Issue Aircraft to Maintenance</span>
                  <span className="text-xs opacity-80">Suppress Herald popups</span>
                </button>
                <button
                  onClick={handleKeepFlying}
                  className="w-full py-2.5 px-4 rounded text-sm font-bold text-left flex items-center justify-between transition-opacity hover:opacity-90"
                  style={{ background: '#4a1a1a', color: '#f8d7da' }}
                >
                  <span>Keep Flying  ⚠ Greatly increased crash risk</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[10px] opacity-40 italic" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  Reported by our aviation correspondent
                </span>
                <button
                  onClick={dismiss}
                  className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded"
                  style={{ background: '#1a1008', color: '#f5f0e8' }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
