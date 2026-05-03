import { useGameStore } from '@/store';
import { runDailyTick } from './economicsEngine';
import { runAITick } from './aiEngine';
import { updatePlanePositions } from './planePositions';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';

let rafHandle = 0;
let lastRealTimeMs = 0;
let lastStoreCommitRealMs = 0;
let lastPlaneCacheRealMs = 0;
let loopGameTimeMs = 0;

const MAX_DELTA_REAL_MS = 500; // cap to prevent runaway on tab refocus
const STORE_COMMIT_INTERVAL_MS = 1000;
const PLANE_CACHE_INTERVAL_MS = 1000;

type PlaneRouteData = Record<string, {
  originLat: number; originLon: number;
  destLat: number; destLon: number;
  distanceKm: number; aircraftId: string | null;
  isActive: boolean; flightsPerWeek: number;
}>;

const AIRCRAFT_SPEED_BY_TYPE_ID = Object.fromEntries(
  AIRCRAFT_TYPES.map(type => [type.id, type.cruiseSpeedKmh]),
);

let cachedRoutePositionData: PlaneRouteData = {};
let cachedAircraftSpeeds: Record<string, number> = {};

export function startGameLoop(): void {
  if (rafHandle) return; // already running
  loopGameTimeMs = useGameStore.getState().gameTimeMs;
  lastRealTimeMs = performance.now();
  lastStoreCommitRealMs = lastRealTimeMs;
  lastPlaneCacheRealMs = 0;
  rebuildPlaneCache(useGameStore.getState());
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

  if (newDay > prevDay || nowMs - lastPlaneCacheRealMs >= PLANE_CACHE_INTERVAL_MS) {
    rebuildPlaneCache(useGameStore.getState());
    lastPlaneCacheRealMs = nowMs;
  }

  updatePlanePositions(deltaGame, cachedRoutePositionData, cachedAircraftSpeeds);
}

function rebuildPlaneCache(state: ReturnType<typeof useGameStore.getState>): void {
  const routePositionData: PlaneRouteData = {};
  const aircraftSpeeds: Record<string, number> = {};

  const addRoute = (route: typeof state.routes[string]) => {
    if (!route.aircraftId) return;
    const origin = state.airports[route.originIata];
    const dest = state.airports[route.destinationIata];
    if (!origin || !dest) return;
    routePositionData[route.id] = {
      originLat: origin.lat, originLon: origin.lon,
      destLat: dest.lat, destLon: dest.lon,
      distanceKm: route.distanceKm,
      aircraftId: route.aircraftId,
      isActive: route.isActive,
      flightsPerWeek: route.flightsPerWeek,
    };
  };

  const addAircraftSpeed = (aircraft: typeof state.aircraft[string]) => {
    const speed = AIRCRAFT_SPEED_BY_TYPE_ID[aircraft.typeId];
    if (speed) aircraftSpeeds[aircraft.id] = speed;
  };

  Object.values(state.routes).forEach(addRoute);
  Object.values(state.aiRoutes).forEach(addRoute);
  Object.values(state.aircraft).forEach(addAircraftSpeed);
  Object.values(state.aiAircraft).forEach(addAircraftSpeed);

  cachedRoutePositionData = routePositionData;
  cachedAircraftSpeeds = aircraftSpeeds;
}
