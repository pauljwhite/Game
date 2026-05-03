import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { useGameStore } from '@/store';
import type { Airport } from '@/types';

const BASE_RADIUS: Record<string, number> = {
  small: 3, medium: 4, large: 6, major: 8,
};

const MIN_ZOOM: Record<string, number> = {
  small: 5, medium: 4, large: 2, major: 2,
};

// Visual radius scales with zoom; hit area is always at least 4px so clicking works
function getRadius(size: string, zoom: number): number {
  const base = BASE_RADIUS[size] ?? 4;
  const scale = Math.max(0.4, zoom / 5);
  return Math.max(4, base * scale);
}

interface MarkerEntry {
  marker: L.CircleMarker;
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
    entriesRef.current.forEach(e => e.marker.remove());
    entriesRef.current = [];

    const zoom = map.getZoom();

    Object.values(airports).forEach(airport => {
      const isHub = airport.isHub || hubIatas.includes(airport.iata);
      const color = isHub ? '#f59e0b' : '#60a5fa';
      const visible = zoom >= (MIN_ZOOM[airport.size] ?? 3);

      const marker = L.circleMarker([airport.lat, airport.lon], {
        radius: getRadius(airport.size, zoom),
        color,
        fillColor: color,
        fillOpacity: visible ? 0.9 : 0,
        opacity: visible ? 1 : 0,
        weight: 1,
      }).addTo(map);

      marker.on('click', () => { if (zoom >= (MIN_ZOOM[airport.size] ?? 3)) selectAirport(airport.iata); });
      marker.bindTooltip(airport.name, { direction: 'top', offset: [0, -4] });

      entriesRef.current.push({ marker, airport });
    });

    return () => {
      entriesRef.current.forEach(e => e.marker.remove());
      entriesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airports, map, selectAirport, hubIatas.join(',')]);

  useEffect(() => {
    function onZoom() {
      const zoom = map.getZoom();
      entriesRef.current.forEach(({ marker, airport }) => {
        const visible = zoom >= (MIN_ZOOM[airport.size] ?? 3);
        marker.setRadius(getRadius(airport.size, zoom));
        marker.setStyle({
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
