import React from 'react';

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

export const PriceInput: React.FC<Props> = ({ value, min = 1, max = 999999, onChange }) => {
  const s = step(value);
  const dec = () => onChange(Math.max(min, Math.round((value - s) / s) * s));
  const inc = () => onChange(Math.min(max, Math.round((value + s) / s) * s));

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
        value={value}
        onChange={e => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
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
