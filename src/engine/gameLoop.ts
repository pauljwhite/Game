import { useGameStore } from '@/store';
import { runDailyTick } from './economicsEngine';
import { runAITick } from './aiEngine';
import { updatePlanePositions } from './planePositions';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';

let rafHandle = 0;
let lastRealTimeMs = 0;
let lastStoreCommitRealMs = 0;
let loopGameTimeMs = 0;

const MAX_DELTA_REAL_MS = 500; // cap to prevent runaway on tab refocus
const STORE_COMMIT_INTERVAL_MS = 1000;

export function startGameLoop(): void {
  if (rafHandle) return; // already running
  loopGameTimeMs = useGameStore.getState().gameTimeMs;
  lastRealTimeMs = performance.now();
  lastStoreCommitRealMs = lastRealTimeMs;
  rafHandle = requestAnimationFrame(tick);
}

export function stopGameLoop(): void {
  if (rafHandle) {
    cancelAnimationFrame(rafHandle);
    rafHandle = 0;
  }
}

function tick(nowMs: number): void {
  rafHandle = requestAnimationFrame(tick);

  const store = useGameStore.getState();
  if (store.isPaused || store.speed === 0) {
    loopGameTimeMs = store.gameTimeMs;
    lastRealTimeMs = nowMs;
    lastStoreCommitRealMs = nowMs;
    return;
  }

  const deltaReal = Math.min(nowMs - lastRealTimeMs, MAX_DELTA_REAL_MS);
  lastRealTimeMs = nowMs;

  const deltaGame = deltaReal * store.speed;
  const prevDay = Math.floor(loopGameTimeMs / 86_400_000);
  loopGameTimeMs += deltaGame;
  const newDay = Math.floor(loopGameTimeMs / 86_400_000);

  const shouldCommitTime = newDay > prevDay || nowMs - lastStoreCommitRealMs >= STORE_COMMIT_INTERVAL_MS;
  if (shouldCommitTime) {
    store.advanceTime(loopGameTimeMs, newDay);
    lastStoreCommitRealMs = nowMs;
  }

  const newState = useGameStore.getState();

  if (newDay > prevDay) {
    // One or more game days have passed - run economics + AI
    runDailyTick(newState);
    runAITick(newState, newDay);
  }

  // Update plane positions (cheap interpolation, no React)
  const { routes, aiRoutes, aircraft, aiAircraft } = newState;

  const routePositionData: Record<string, {
    originLat: number; originLon: number;
    destLat: number; destLon: number;
    distanceKm: number; aircraftId: string | null;
    isActive: boolean; flightsPerWeek: number;
  }> = {};

  const aircraftSpeeds: Record<string, number> = {};

  [...Object.values(routes), ...Object.values(aiRoutes)].forEach(r => {
    const origin = newState.airports[r.originIata];
    const dest = newState.airports[r.destinationIata];
    if (!origin || !dest) return;
    routePositionData[r.id] = {
      originLat: origin.lat, originLon: origin.lon,
      destLat: dest.lat, destLon: dest.lon,
      distanceKm: r.distanceKm,
      aircraftId: r.aircraftId,
      isActive: r.isActive,
      flightsPerWeek: r.flightsPerWeek,
    };
  });

  [...Object.values(aircraft), ...Object.values(aiAircraft)].forEach(ac => {
    const type = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
    if (type) aircraftSpeeds[ac.id] = type.cruiseSpeedKmh;
  });

  updatePlanePositions(deltaGame, routePositionData, aircraftSpeeds);
}
