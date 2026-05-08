import { GAME_EPOCH_YEAR } from './constants';
import type { CurrencyCode } from '@/types';

export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; label: string; symbol: string; rateFromUSD: number }> = [
  { code: 'USD', label: 'US Dollars', symbol: '$', rateFromUSD: 1 },
  { code: 'GBP', label: 'Sterling', symbol: '£', rateFromUSD: 0.79 },
  { code: 'EUR', label: 'Euros', symbol: '€', rateFromUSD: 0.92 },
  { code: 'RUB', label: 'Rubles', symbol: '₽', rateFromUSD: 92 },
  { code: 'JPY', label: 'Yen', symbol: '¥', rateFromUSD: 150 },
  { code: 'CNY', label: 'Yuan', symbol: '¥', rateFromUSD: 7.2 },
  { code: 'CAD', label: 'Canadian Dollars', symbol: 'C$', rateFromUSD: 1.36 },
  { code: 'AUD', label: 'Australian Dollars', symbol: 'A$', rateFromUSD: 1.52 },
  { code: 'CHF', label: 'Swiss Francs', symbol: 'Fr', rateFromUSD: 0.88 },
];

let displayCurrency: CurrencyCode = 'USD';

export function setDisplayCurrency(currency: CurrencyCode): void {
  if (CURRENCY_OPTIONS.some(option => option.code === currency)) {
    displayCurrency = currency;
  }
}

export function formatCurrency(n: number): string {
  const option = CURRENCY_OPTIONS.find(item => item.code === displayCurrency) ?? CURRENCY_OPTIONS[0];
  const converted = n * option.rateFromUSD;
  const abs = Math.abs(converted);
  const sign = n < 0 ? '-' : '';
  const symbol = option.symbol;
  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function convertUSDToDisplayCurrency(n: number): number {
  const option = CURRENCY_OPTIONS.find(item => item.code === displayCurrency) ?? CURRENCY_OPTIONS[0];
  return n * option.rateFromUSD;
}

export function convertDisplayCurrencyToUSD(n: number): number {
  const option = CURRENCY_OPTIONS.find(item => item.code === displayCurrency) ?? CURRENCY_OPTIONS[0];
  return n / option.rateFromUSD;
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
