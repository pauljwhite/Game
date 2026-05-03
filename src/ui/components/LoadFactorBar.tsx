import React from 'react';

interface LoadFactorBarProps {
  value: number; // 0–1
  label?: string;
  className?: string;
}

export const LoadFactorBar: React.FC<LoadFactorBarProps> = ({ value, label, className = '' }) => {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-xs text-gray-400 w-8">{label}</span>}
      <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{pct}%</span>
    </div>
  );
};
