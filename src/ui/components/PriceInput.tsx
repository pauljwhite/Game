import React, { useEffect, useState } from 'react';

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
  onChange: (v: number) => void;
}

export const PriceInput: React.FC<Props> = ({ value, min = 0, max = 999999, onChange }) => {
  const [draftValue, setDraftValue] = useState(String(value));
  const s = step(value);
  const dec = () => onChange(Math.max(min, Math.round((value - s) / s) * s));
  const inc = () => onChange(Math.min(max, Math.round((value + s) / s) * s));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  function commitDraft() {
    if (draftValue.trim() === '') {
      onChange(min);
      setDraftValue(String(min));
      return;
    }

    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      setDraftValue(String(value));
      return;
    }

    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
    setDraftValue(String(clamped));
  }

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={dec}
        className="w-8 h-9 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 rounded-l border border-gray-600 text-lg leading-none select-none transition-colors shrink-0"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={draftValue}
        onChange={e => {
          const next = e.target.value;
          setDraftValue(next);
          if (next.trim() === '') return;

          const parsed = Number(next);
          if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
            onChange(parsed);
          }
        }}
        onBlur={commitDraft}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="flex-1 min-w-0 h-9 bg-gray-800 border-y border-gray-600 text-white text-sm text-center focus:outline-none focus:border-blue-500 focus:z-10"
      />
      <button
        type="button"
        onClick={inc}
        className="w-8 h-9 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 rounded-r border border-gray-600 text-lg leading-none select-none transition-colors shrink-0"
      >
        +
      </button>
    </div>
  );
};
