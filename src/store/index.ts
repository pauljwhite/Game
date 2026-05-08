import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import { createGameSlice, type GameSlice } from './gameSlice';
import { createPlayerSlice, type PlayerSlice } from './playerSlice';
import { createWorldSlice, type WorldSlice } from './worldSlice';
import { createUISlice, type UISlice } from './uiSlice';
import { calculateDailyLoanPayment } from '@/engine/finance';

export type GameStore = GameSlice & PlayerSlice & WorldSlice & UISlice;

const VALID_GAME_SPEEDS = new Set([0, 60, 300, 1200, 3600, 14400]);
const DEFAULT_GAME_SPEED = 300;
const SAVE_VERSION = 10;
const DEFAULT_SETTINGS: GameStore['settings'] = {
  playerAirlineName: 'My Airline',
  playerAirlineColor: '#3b82f6',
  playerAirlineEmoji: '✈️',
  startingCash: 30_000_000,
  difficulty: 'normal',
  aiCount: 6,
  startingYear: 1960,
  objective: 'last_airline_standing',
  targetMarketShare: 60,
  currency: 'USD',
};
const VALID_OBJECTIVES = new Set<GameStore['settings']['objective']>(['last_airline_standing', 'market_share']);
const VALID_CURRENCIES = new Set<GameStore['settings']['currency']>(['USD', 'GBP', 'EUR', 'RUB', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF']);

function uniqueExistingIds(ids: unknown, exists: (id: string) => boolean): string[] {
  if (!Array.isArray(ids)) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  ids.forEach(id => {
    if (typeof id !== 'string' || seen.has(id) || !exists(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result;
}

function mergeOwnedIds<T extends { id: string; airlineId: string }>(
  listedIds: unknown,
  records: Record<string, T>,
  airlineId: string,
): string[] {
  const ownedIds = Object.values(records)
    .filter(record => record.airlineId === airlineId)
    .map(record => record.id);
  const rawIds = Array.isArray(listedIds) ? listedIds : [];
  return uniqueExistingIds([...rawIds, ...ownedIds], id => records[id]?.airlineId === airlineId);
}

function sanitizeLoans(loans: unknown): NonNullable<GameStore['airlines'][string]['loans']> {
  if (!Array.isArray(loans)) return [];

  return loans.flatMap((loan) => {
    const raw = loan as Record<string, unknown>;
    const principalUSD = typeof raw.principalUSD === 'number' ? raw.principalUSD : 0;
    const annualInterestRate = typeof raw.annualInterestRate === 'number' ? raw.annualInterestRate : 0;
    const termYears = typeof raw.termYears === 'number' ? raw.termYears : 5;
    if (principalUSD <= 1 || annualInterestRate < 0 || termYears <= 0) return [];
    return [{
      id: typeof raw.id === 'string' ? raw.id : `loan-${Math.random().toString(36).slice(2)}`,
      principalUSD,
      annualInterestRate,
      termYears,
      dailyPaymentUSD: typeof raw.dailyPaymentUSD === 'number'
        ? raw.dailyPaymentUSD
        : calculateDailyLoanPayment(principalUSD, annualInterestRate, termYears),
      issuedGameDay: typeof raw.issuedGameDay === 'number' ? raw.issuedGameDay : 0,
    }];
  });
}

function sanitizePersistedState(state: Partial<GameStore>): Partial<GameStore> {
  const { airports: _airports, ...stateWithoutStaticAirports } = state;
  const aiRoutes = state.aiRoutes ?? {};
  const aiAircraft = state.aiAircraft ?? {};
  const routes = state.routes ?? {};
  const aircraft = state.aircraft ?? {};

  const aiAirlines = Object.fromEntries(
    Object.entries(state.aiAirlines ?? {}).map(([id, airline]) => {
      const raw = airline as unknown as Record<string, unknown>;
      return [
        id,
        {
          ...airline,
          totalPassengersAllTime: typeof raw.totalPassengersAllTime === 'number' ? raw.totalPassengersAllTime : 0,
          crashPenaltyDaysLeft: typeof raw.crashPenaltyDaysLeft === 'number' ? raw.crashPenaltyDaysLeft : 0,
          shareholders: (raw.shareholders as Record<string, number> | undefined) ?? {},
          lastDailyProfit: typeof raw.lastDailyProfit === 'number' ? raw.lastDailyProfit : 0,
          routeIds: mergeOwnedIds(airline.routeIds, aiRoutes, id),
          fleetIds: mergeOwnedIds(airline.fleetIds, aiAircraft, id),
        },
      ];
    }),
  );

  const DEFAULT_MAINT_POLICY = { enabled: false, threshold: 40, tier: 'standard' as const, autoMaintainIssues: false };

  const airlines = Object.fromEntries(
    Object.entries(state.airlines ?? {}).map(([id, airline]) => {
      const raw = airline as unknown as Record<string, unknown>;
      const rawPolicy = raw.maintenancePolicy as { enabled?: boolean; threshold?: number; tier?: string; autoMaintainIssues?: boolean } | undefined;
      const loans = sanitizeLoans(raw.loans);
      return [
        id,
        {
          ...airline,
          loans,
          totalDebt: loans.length > 0
            ? loans.reduce((sum, loan) => sum + loan.principalUSD, 0)
            : (typeof raw.totalDebt === 'number' ? raw.totalDebt : 0),
          totalPassengersAllTime: typeof raw.totalPassengersAllTime === 'number' ? raw.totalPassengersAllTime : 0,
          crashPenaltyDaysLeft: typeof raw.crashPenaltyDaysLeft === 'number' ? raw.crashPenaltyDaysLeft : 0,
          shareholders: (raw.shareholders as Record<string, number> | undefined) ?? {},
          lastDailyProfit: typeof raw.lastDailyProfit === 'number' ? raw.lastDailyProfit : 0,
          maintenancePolicy: rawPolicy
            ? {
                enabled: typeof rawPolicy.enabled === 'boolean' ? rawPolicy.enabled : false,
                threshold: typeof rawPolicy.threshold === 'number' ? rawPolicy.threshold : 40,
                tier: (['light', 'standard', 'full'].includes(rawPolicy.tier ?? '') ? rawPolicy.tier : 'standard') as 'light' | 'standard' | 'full',
                autoMaintainIssues: typeof rawPolicy.autoMaintainIssues === 'boolean' ? rawPolicy.autoMaintainIssues : false,
              }
            : DEFAULT_MAINT_POLICY,
          routeIds: mergeOwnedIds(airline.routeIds, routes, id),
          fleetIds: mergeOwnedIds(airline.fleetIds, aircraft, id),
        },
      ];
    }),
  );

  // Backfill missing maintenance fields on aircraft from older saves
  type MaintFields = { activeMaintTier: null; autoMaintenanceEnabled: boolean; autoMaintenanceThreshold: number; autoMaintenanceTier: 'light' | 'standard' | 'full' };
  const normalizedAircraft: Record<string, typeof aircraft[string]> = Object.fromEntries(
    Object.entries(aircraft).map(([id, ac]) => {
      const raw = ac as unknown as Record<string, unknown>;
      const defaults: MaintFields = {
        activeMaintTier: null,
        autoMaintenanceEnabled: (raw.autoMaintenanceEnabled as boolean | undefined) ?? false,
        autoMaintenanceThreshold: (raw.autoMaintenanceThreshold as number | undefined) ?? 40,
        autoMaintenanceTier: ((raw.autoMaintenanceTier as string | undefined) ?? 'standard') as 'light' | 'standard' | 'full',
      };
      const knownFaultRiskMod = typeof raw.knownFaultRiskMod === 'number' ? raw.knownFaultRiskMod : 1;
      const excludedFromPolicy = typeof raw.excludedFromPolicy === 'boolean' ? raw.excludedFromPolicy : false;
      return [id, { ...defaults, ...ac, knownFaultRiskMod, excludedFromPolicy }];
    }),
  );

  // Backfill knownFaultRiskMod on AI aircraft from older saves
  const normalizedAIAircraft: Record<string, typeof aiAircraft[string]> = Object.fromEntries(
    Object.entries(aiAircraft).map(([id, ac]) => {
      const raw = ac as unknown as Record<string, unknown>;
      const knownFaultRiskMod = typeof raw.knownFaultRiskMod === 'number' ? raw.knownFaultRiskMod : 1;
      return [id, { ...ac, knownFaultRiskMod }];
    }),
  );
  const persistedSettings = state.settings;
  const objective = VALID_OBJECTIVES.has(persistedSettings?.objective as GameStore['settings']['objective'])
    ? persistedSettings!.objective
    : DEFAULT_SETTINGS.objective;
  const currency = VALID_CURRENCIES.has(persistedSettings?.currency as GameStore['settings']['currency'])
    ? persistedSettings!.currency
    : DEFAULT_SETTINGS.currency;

  const sanitized: Partial<GameStore> = {
    ...stateWithoutStaticAirports,
    airlines,
    aiAirlines,
    aircraft: normalizedAircraft,
    aiAircraft: normalizedAIAircraft,
    airportDailyPax: (state.airportDailyPax && typeof state.airportDailyPax === 'object') ? state.airportDailyPax : {},
    speed: VALID_GAME_SPEEDS.has(state.speed as number) ? state.speed : DEFAULT_GAME_SPEED,
    themeMode: state.themeMode === 'light' ? 'light' : 'dark',
    isPaused: false,
    hasWon: typeof state.hasWon === 'boolean' ? state.hasWon : false,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(persistedSettings ?? {}),
      objective,
      currency,
      targetMarketShare: Math.min(100, Math.max(60, persistedSettings?.targetMarketShare ?? DEFAULT_SETTINGS.targetMarketShare)),
    },
  };

  if (Array.isArray(state.newsTicker)) {
    sanitized.newsTicker = state.newsTicker.slice(0, 20).map((item, index) => (
      typeof item === 'string'
        ? { id: `legacy_${index}`, text: item }
        : item
    ));
  }

  return sanitized;
}

function migratePersistedState(persistedState: unknown): unknown {
  if (!persistedState || typeof persistedState !== 'object') return persistedState;

  const state = persistedState as Partial<GameStore>;
  return sanitizePersistedState(state);
}

// Debounced localStorage. Keep JSON.stringify inside the debounced flush; using
// createJSONStorage would stringify the full save on every store commit even if
// the actual localStorage write is delayed.
let pendingWrite: { name: string; value: StorageValue<unknown> } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_DEBOUNCE_MS = 1500;

function flushPendingWrite(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (pendingWrite) {
    try { localStorage.setItem(pendingWrite.name, JSON.stringify(pendingWrite.value)); }
    catch (e) { console.warn('localStorage write failed', e); }
    pendingWrite = null;
  }
}

const debouncedPersistStorage: PersistStorage<unknown, void> = {
  getItem: (name) => {
    const stored = localStorage.getItem(name);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as StorageValue<unknown>;
    } catch (e) {
      console.warn('localStorage parse failed', e);
      return null;
    }
  },
  setItem: (name, value) => {
    pendingWrite = { name, value };
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      flushPendingWrite();
    }, WRITE_DEBOUNCE_MS);
  },
  removeItem: (name) => {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    pendingWrite = null;
    localStorage.removeItem(name);
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingWrite);
  window.addEventListener('beforeunload', flushPendingWrite);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingWrite();
  });
}

export const useGameStore = create<GameStore>()(
  persist(
    immer((...a) => ({
      ...createGameSlice(...a),
      ...createPlayerSlice(...a),
      ...createWorldSlice(...a),
      ...createUISlice(...a),
    })),
    {
      name: 'airline-empire-save',
      version: SAVE_VERSION,
      migrate: migratePersistedState,
      storage: debouncedPersistStorage,
      partialize: (state) => {
        // Exclude transient UI state from persistence
        const { selectedAirportIata: _s, selectedRouteId: _r, openPanel: _p, openModal: _m, modalPayload: _mp, airports: _a, newspaperQueue: _nq, ...rest } = state;
        return {
          ...rest,
          newsTicker: rest.newsTicker.slice(0, 20),
        };
      },
    },
  ),
);

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated());
  useEffect(() => {
    if (!hydrated) {
      const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
      return unsub;
    }
  }, [hydrated]);
  return hydrated;
}
