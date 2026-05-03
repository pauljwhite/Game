import { interpolateGreatCircle } from '@/utils/geo';

export interface PlaneState {
  lat: number;
  lon: number;
  bearing: number;
  progress: number; // 0–1 along current leg
  routeId: string;
  airlineId: string;
  color: string;
}

// Module-level map — lives outside React/Zustand for 60fps direct DOM updates
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
): void {
  planePositions.set(aircraftId, {
    lat: originLat,
    lon: originLon,
    bearing: 0,
    progress: 0,
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
    if (!route || !route.isActive || !route.aircraftId) return;

    const speedKmh = aircraftSpeeds[aircraftId] ?? 850;
    const flightDurationMs = (route.distanceKm / speedKmh) * 3_600_000;
    const cycleMs = flightDurationMs * 2;

    const prevElapsed = state.progress * flightDurationMs;
    const newElapsed = (prevElapsed + deltaGameMs) % cycleMs;

    let progress: number;
    let fromLat: number, fromLon: number, toLat: number, toLon: number;

    if (newElapsed < flightDurationMs) {
      progress = newElapsed / flightDurationMs;
      fromLat = route.originLat; fromLon = route.originLon;
      toLat = route.destLat; toLon = route.destLon;
    } else {
      progress = (newElapsed - flightDurationMs) / flightDurationMs;
      fromLat = route.destLat; fromLon = route.destLon;
      toLat = route.originLat; toLon = route.originLon;
    }

    const [lat, lon] = interpolateGreatCircle(fromLat, fromLon, toLat, toLon, progress);
    const ahead = Math.min(progress + 0.01, 0.999);
    const [aheadLat, aheadLon] = interpolateGreatCircle(fromLat, fromLon, toLat, toLon, ahead);

    const dLon = (aheadLon - lon) * Math.PI / 180;
    const latR = lat * Math.PI / 180;
    const aheadLatR = aheadLat * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(aheadLatR);
    const x = Math.cos(latR) * Math.sin(aheadLatR) - Math.sin(latR) * Math.cos(aheadLatR) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

    state.lat = lat;
    state.lon = lon;
    state.bearing = bearing;
    state.progress = newElapsed < flightDurationMs ? progress : 0;
  });
}
