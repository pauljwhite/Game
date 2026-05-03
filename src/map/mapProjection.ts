import type { Map as LeafletMap } from 'leaflet';

export interface SvgPoint {
  x: number;
  y: number;
}

/**
 * Converts a lat/lon to SVG pixel coordinates using the Leaflet map's projection.
 * The SVG overlay is absolutely positioned to cover the map container.
 */
export function latLonToSvgPoint(lat: number, lon: number, map: LeafletMap): SvgPoint {
  const point = map.latLngToContainerPoint([lat, lon]);
  return { x: point.x, y: point.y };
}

export function buildSvgPathD(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const parts = [`M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`];
  for (const pt of rest) {
    parts.push(`L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
  }
  return parts.join(' ');
}
