export interface ArcPoint {
  lat: number;
  lon: number;
}

export interface ArcSegment {
  points: ArcPoint[];
}

/**
 * Returns one or two visual arc segments for a route.
 *
 * The game map is an equirectangular/Leaflet world view, so near-antipodal
 * great-circle paths can look like they shoot straight up toward the pole and
 * back down. For route display we prefer the shortest horizontal wrap across
 * the map, then add a restrained latitude bow for readability.
 */
export function computeArcSegments(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  numPoints = 80,
): ArcSegment[] {
  const lonDelta = shortestLonDelta(originLon, destLon);
  const unwrappedPts: ArcPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    unwrappedPts.push(computeVisualArcPoint(originLat, originLon, destLat, destLon, i / numPoints, false, lonDelta));
  }

  return splitArcAtAntimeridian(unwrappedPts);
}

export function computeVisualArcPoint(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  progress: number,
  normalize = true,
  precomputedLonDelta?: number,
): ArcPoint {
  const f = Math.max(0, Math.min(1, progress));
  const lonDelta = precomputedLonDelta ?? shortestLonDelta(originLon, destLon);
  const avgLatRad = ((originLat + destLat) / 2) * Math.PI / 180;
  const weightedLonDelta = lonDelta * Math.max(0.25, Math.cos(avgLatRad));
  const planarDistance = Math.hypot(weightedLonDelta, destLat - originLat);
  const hemisphere = ((originLat + destLat) / 2) >= 0 ? 1 : -1;
  const latBow = hemisphere * Math.min(10, planarDistance * 0.065 + Math.abs(lonDelta) / 180);
  const point = {
    lat: clampLat(originLat + (destLat - originLat) * f + Math.sin(Math.PI * f) * latBow),
    lon: originLon + lonDelta * f,
  };

  return normalize ? normalizePoint(point) : point;
}

export function computeVisualArcBearing(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  progress: number,
): number {
  const point = computeVisualArcPoint(originLat, originLon, destLat, destLon, progress);
  const ahead = computeVisualArcPoint(originLat, originLon, destLat, destLon, Math.min(progress + 0.01, 1));
  const lonDelta = shortestLonDelta(point.lon, ahead.lon);
  const latDelta = ahead.lat - point.lat;
  return (Math.atan2(lonDelta, latDelta) * 180 / Math.PI + 360) % 360;
}

function splitArcAtAntimeridian(unwrappedPts: ArcPoint[]): ArcSegment[] {
  const segments: ArcSegment[] = [];
  let current: ArcPoint[] = [normalizePoint(unwrappedPts[0])];

  for (let i = 1; i < unwrappedPts.length; i++) {
    const prev = unwrappedPts[i - 1];
    const next = unwrappedPts[i];
    const crossing = antimeridianBetween(prev.lon, next.lon);

    if (crossing !== null) {
      const t = (crossing - prev.lon) / (next.lon - prev.lon);
      const crossingLat = clampLat(prev.lat + (next.lat - prev.lat) * t);
      current.push({ lat: crossingLat, lon: crossing > 0 ? 180 : -180 });
      segments.push({ points: current });

      current = [
        { lat: crossingLat, lon: crossing > 0 ? -180 : 180 },
        normalizePoint(next),
      ];
    } else {
      current.push(normalizePoint(next));
    }
  }

  if (current.length > 0) segments.push({ points: current });

  return segments.filter(segment => segment.points.length > 1);
}

function shortestLonDelta(fromLon: number, toLon: number): number {
  return ((((toLon - fromLon) % 360) + 540) % 360) - 180;
}

function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function normalizePoint(point: ArcPoint): ArcPoint {
  return { lat: point.lat, lon: normalizeLon(point.lon) };
}

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

function antimeridianBetween(fromLon: number, toLon: number): number | null {
  const low = Math.min(fromLon, toLon);
  const high = Math.max(fromLon, toLon);
  const start = Math.ceil((low - 180) / 360);
  const end = Math.floor((high - 180) / 360);
  if (start > end) return null;
  const crossing = 180 + start * 360;
  if (crossing <= low || crossing >= high) return null;
  return crossing;
}
