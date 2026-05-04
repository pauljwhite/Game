import React from 'react';
import { useGameStore } from '@/store';
import type { ThemeMode } from '@/store/uiSlice';

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'dark', label: 'Dark', description: 'Low-glare cockpit style for long play sessions.' },
  { value: 'light', label: 'Light', description: 'Brighter interface for daylight and mobile screens.' },
];

export const SettingsModal: React.FC = () => {
  const closeModal = useGameStore(s => s.closeModal);
  const themeMode = useGameStore(s => s.themeMode);
  const setThemeMode = useGameStore(s => s.setThemeMode);

  const handleThemeSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    closeModal();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999]"
      onClick={closeModal}
    >
      <div
        className="glass-panel rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[92svh] overflow-hidden flex flex-col"
        onClick={event => event.stopPropagation()}
      >
        <div className="panel-header flex items-center justify-between px-4 sm:px-6">
          <div>
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <p className="text-gray-500 text-xs mt-0.5">Interface preferences</p>
          </div>
          <button
            onClick={closeModal}
            className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors text-lg leading-none"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 overscroll-contain">
          <div className="glass-card p-3">
            <div className="text-gray-300 text-sm font-semibold mb-2">Appearance</div>
            <div className="grid grid-cols-2 gap-2">
              {THEME_OPTIONS.map(option => {
                const active = themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleThemeSelect(option.value)}
                    className={`text-left rounded-lg border p-3 transition-all min-h-24 ${
                      active
                        ? 'border-sky-300/50 bg-sky-500/15 text-sky-100'
                        : 'border-white/10 bg-white/[0.045] text-gray-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{option.label}</span>
                      <span className={`h-4 w-4 rounded-full border ${active ? 'border-sky-200 bg-sky-300' : 'border-gray-500'}`} />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 leading-snug">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
