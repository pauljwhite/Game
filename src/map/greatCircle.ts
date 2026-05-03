import { interpolateGreatCircle } from '@/utils/geo';

export interface ArcPoint {
  lat: number;
  lon: number;
}

export interface ArcSegment {
  points: ArcPoint[];
}

/**
 * Returns one or two arc segments for a great-circle path.
 * Splits at the antimeridian when the path crosses ±180°.
 */
export function computeArcSegments(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  numPoints = 80,
): ArcSegment[] {
  const pts: ArcPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const [lat, lon] = interpolateGreatCircle(originLat, originLon, destLat, destLon, f);
    pts.push({ lat, lon });
  }

  const segments: ArcSegment[] = [];
  let current: ArcPoint[] = [pts[0]];

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const next = pts[i];
    const lonDiff = Math.abs(next.lon - prev.lon);

    if (lonDiff > 180) {
      // Antimeridian crossing - start new segment
      segments.push({ points: current });
      current = [next];
    } else {
      current.push(next);
    }
  }

  if (current.length > 0) segments.push({ points: current });

  return segments;
}
