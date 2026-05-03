import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { useGameStore } from '@/store';
import type { Airport } from '@/types';

const BASE_RADIUS: Record<string, number> = {
  small: 3, medium: 5, large: 7, major: 9,
};

const MIN_ZOOM: Record<string, number> = {
  small: 5, medium: 4, large: 2, major: 2,
};

const HIT_RADIUS = 14; // invisible hit-area radius in px (makes small dots easy to tap)

function getVisualRadius(size: string, zoom: number): number {
  const base = BASE_RADIUS[size] ?? 4;
  const scale = Math.max(0.5, zoom / 5);
  return Math.max(3, base * scale);
}

interface MarkerEntry {
  visual: L.CircleMarker;
  hit: L.CircleMarker;
  airport: Airport;
}

interface AirportMarkersProps {
  map: LeafletMap;
}

export function AirportMarkers({ map }: AirportMarkersProps) {
  const airports = useGameStore(s => s.airports);
  const playerAirline = useGameStore(s => s.airlines[s.playerAirlineId]);
  const selectAirport = useGameStore(s => s.selectAirport);
  const entriesRef = useRef<MarkerEntry[]>([]);
  const hubIatas = playerAirline?.hubIatas ?? [];

  useEffect(() => {
    entriesRef.current.forEach(e => { e.visual.remove(); e.hit.remove(); });
    entriesRef.current = [];

    const zoom = map.getZoom();

    Object.values(airports).forEach(airport => {
      const isHub = airport.isHub || hubIatas.includes(airport.iata);
      const color = isHub ? '#f59e0b' : '#60a5fa';
      const visible = zoom >= (MIN_ZOOM[airport.size] ?? 3);
      const latlng: [number, number] = [airport.lat, airport.lon];

      // Visible dot (non-interactive, purely cosmetic)
      const visual = L.circleMarker(latlng, {
        radius: getVisualRadius(airport.size, zoom),
        color,
        fillColor: color,
        fillOpacity: visible ? 0.9 : 0,
        opacity: visible ? 1 : 0,
        weight: 1,
        interactive: false,
      }).addTo(map);

      // Invisible hit area — always large enough to tap
      const hit = L.circleMarker(latlng, {
        radius: HIT_RADIUS,
        color: 'transparent',
        fillColor: 'transparent',
        fillOpacity: 0,
        opacity: 0,
        weight: 0,
        interactive: true,
      }).addTo(map);

      hit.on('click', () => { if (zoom >= (MIN_ZOOM[airport.size] ?? 3)) selectAirport(airport.iata); });
      hit.bindTooltip(airport.iata, { direction: 'top', offset: [0, -4], className: 'leaflet-tooltip-airport' });

      entriesRef.current.push({ visual, hit, airport });
    });

    return () => {
      entriesRef.current.forEach(e => { e.visual.remove(); e.hit.remove(); });
      entriesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airports, map, selectAirport, hubIatas.join(',')]);

  useEffect(() => {
    function onZoom() {
      const zoom = map.getZoom();
      entriesRef.current.forEach(({ visual, airport }) => {
        const visible = zoom >= (MIN_ZOOM[airport.size] ?? 3);
        visual.setRadius(getVisualRadius(airport.size, zoom));
        visual.setStyle({
          fillOpacity: visible ? 0.9 : 0,
          opacity: visible ? 1 : 0,
        });
      });
    }

    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map]);

  return null;
}
