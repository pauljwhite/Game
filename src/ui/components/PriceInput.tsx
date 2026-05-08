import React, { useEffect, useState } from 'react';
import { convertDisplayCurrencyToUSD, convertUSDToDisplayCurrency } from '@/utils/format';

function step(value: number): number {
  if (value < 200)  return 5;
  if (value < 1000) return 10;
  if (value < 5000) return 50;
  return 100;
}

interface Props {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

export const PriceInput: React.FC<Props> = ({ value, min = 0, max = 999999, disabled = false, onChange }) => {
  const displayValue = Math.round(convertUSDToDisplayCurrency(value));
  const displayMin = Math.round(convertUSDToDisplayCurrency(min));
  const displayMax = Math.round(convertUSDToDisplayCurrency(max));
  const [draftValue, setDraftValue] = useState(String(displayValue));
  const s = step(displayValue);
  const commitDisplayValue = (nextDisplayValue: number) => {
    const clampedDisplay = Math.min(displayMax, Math.max(displayMin, nextDisplayValue));
    onChange(convertDisplayCurrencyToUSD(clampedDisplay));
    setDraftValue(String(clampedDisplay));
  };
  const dec = () => commitDisplayValue(Math.round((displayValue - s) / s) * s);
  const inc = () => commitDisplayValue(Math.round((displayValue + s) / s) * s);

  useEffect(() => {
    setDraftValue(String(displayValue));
  }, [displayValue]);

  function commitDraft() {
    if (disabled) return;
    if (draftValue.trim() === '') {
      onChange(min);
      setDraftValue(String(displayMin));
      return;
    }

    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      setDraftValue(String(value));
      return;
    }

    commitDisplayValue(parsed);
  }

  return (
    <div className={`flex items-center ${disabled ? 'opacity-60' : ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={dec}
        className="w-8 h-9 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 rounded-l border border-gray-600 text-lg leading-none select-none transition-colors shrink-0 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-600"
      >
        −
      </button>
      <input
        type="number"
        min={displayMin}
        max={displayMax}
        disabled={disabled}
        value={draftValue}
        onChange={e => {
          if (disabled) return;
          const next = e.target.value;
          setDraftValue(next);
          if (next.trim() === '') return;

          const parsed = Number(next);
          if (Number.isFinite(parsed)) {
            const clamped = Math.min(displayMax, Math.max(displayMin, parsed));
            onChange(convertDisplayCurrencyToUSD(clamped));
            if (clamped !== parsed) setDraftValue(String(clamped));
          }
        }}
        onBlur={commitDraft}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="flex-1 min-w-0 h-9 bg-gray-800 border-y border-gray-600 text-white text-sm text-center focus:outline-none focus:border-blue-500 focus:z-10 disabled:cursor-not-allowed disabled:bg-gray-900 disabled:text-gray-600"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={inc}
        className="w-8 h-9 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 rounded-r border border-gray-600 text-lg leading-none select-none transition-colors shrink-0 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-600"
      >
        +
      </button>
    </div>
  );
};
