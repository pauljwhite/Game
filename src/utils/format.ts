import { GAME_EPOCH_YEAR } from './constants';

export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatGameDate(gameTimeMs: number): string {
  const epochMs = new Date(GAME_EPOCH_YEAR, 0, 1).getTime();
  const d = new Date(epochMs + gameTimeMs);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatGameClock(gameTimeMs: number): string {
  const epochMs = new Date(GAME_EPOCH_YEAR, 0, 1).getTime();
  const d = new Date(epochMs + gameTimeMs);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function getGameYear(gameTimeMs: number): number {
  const epochMs = new Date(GAME_EPOCH_YEAR, 0, 1).getTime();
  return new Date(epochMs + gameTimeMs).getFullYear();
}

export function formatDistance(km: number): string {
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  return `${Math.round(km)} km`;
}

export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export function formatNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
