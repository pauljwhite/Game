export const AI_AIRLINE_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#fb7185',
  '#facc15',
  '#4ade80',
  '#2dd4bf',
  '#38bdf8',
  '#60a5fa',
  '#818cf8',
  '#c084fc',
  '#e879f9',
  '#fb923c',
  '#a3e635',
  '#34d399',
  '#22d3ee',
  '#93c5fd',
  '#f472b6',
];

export function pickUnusedAirlineColor(usedColors: Iterable<string>, seed = 0): string {
  const used = new Set(Array.from(usedColors, color => color.toLowerCase()));
  const unused = AI_AIRLINE_COLORS.filter(color => !used.has(color.toLowerCase()));
  const pool = unused.length > 0 ? unused : AI_AIRLINE_COLORS;
  return pool[Math.abs(seed) % pool.length];
}
