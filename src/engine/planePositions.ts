import { computeVisualArcBearing, computeVisualArcPoint } from '@/map/greatCircle';

export interface PlaneState {
  lat: number;
  lon: number;
  bearing: number;
  progress: number;
  cycleElapsedMs: number;
  routeId: string;
  airlineId: string;
  color: string;
}

const planePositions = new Map<string, PlaneState>();

export function getPlanePositions(): Map<string, PlaneState> {
  return planePositions;
}

export function initPlanePosition(
  aircraftId: string,
  routeId: string,
  airlineId: string,
  color: string,
  originLat: number,
  originLon: number,
  cycleElapsedMs = 0,
): void {
  planePositions.set(aircraftId, {
    lat: originLat,
    lon: originLon,
    bearing: 0,
    progress: 0,
    cycleElapsedMs,
    routeId,
    airlineId,
    color,
  });
}

export function removePlanePosition(aircraftId: string): void {
  planePositions.delete(aircraftId);
}

export function updatePlanePositions(
  deltaGameMs: number,
  routes: Record<string, {
    originLat: number; originLon: number;
    destLat: number; destLon: number;
    distanceKm: number; aircraftId: string | null;
    isActive: boolean; flightsPerWeek: number;
  }>,
  aircraftSpeeds: Record<string, number>,
): void {
  planePositions.forEach((state, aircraftId) => {
    const route = routes[state.routeId];
    if (!route || !route.isActive || route.aircraftId !== aircraftId) return;

    const speedKmh = aircraftSpeeds[aircraftId] ?? 850;
    const flightDurationMs = (route.distanceKm / speedKmh) * 3_600_000;
    const cycleMs = flightDurationMs * 2;

    state.cycleElapsedMs = (state.cycleElapsedMs + deltaGameMs) % cycleMs;

    let progress: number;
    let fromLat: number, fromLon: number, toLat: number, toLon: number;

    if (state.cycleElapsedMs < flightDurationMs) {
      progress = state.cycleElapsedMs / flightDurationMs;
      fromLat = route.originLat; fromLon = route.originLon;
      toLat = route.destLat; toLon = route.destLon;
    } else {
      progress = (state.cycleElapsedMs - flightDurationMs) / flightDurationMs;
      fromLat = route.destLat; fromLon = route.destLon;
      toLat = route.originLat; toLon = route.originLon;
    }

    const point = computeVisualArcPoint(fromLat, fromLon, toLat, toLon, progress);
    const bearing = computeVisualArcBearing(fromLat, fromLon, toLat, toLon, progress);

    state.lat = point.lat;
    state.lon = point.lon;
    state.bearing = bearing;
    state.progress = progress;
  });
}
