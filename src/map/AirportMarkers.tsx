import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { useGameStore } from '@/store';

const SIZE_RADIUS: Record<string, number> = {
  small: 3, medium: 4, large: 6, major: 8,
};

interface AirportMarkersProps {
  map: LeafletMap;
}

export function AirportMarkers({ map }: AirportMarkersProps) {
  const airports = useGameStore(s => s.airports);
  const playerAirline = useGameStore(s => s.airlines[s.playerAirlineId]);
  const selectAirport = useGameStore(s => s.selectAirport);
  const markersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    Object.values(airports).forEach(airport => {
      const radius = SIZE_RADIUS[airport.size] ?? 4;
      const isHub = airport.isHub || playerAirline?.hubIatas.includes(airport.iata);
      const color = isHub ? '#f59e0b' : '#60a5fa';

      const marker = L.circleMarker([airport.lat, airport.lon], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1,
      }).addTo(map);

      marker.on('click', () => selectAirport(airport.iata));
      marker.bindTooltip(airport.name, { direction: 'top', offset: [0, -4] });

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [airports, map, playerAirline?.hubIatas, selectAirport]);

  return null;
}
