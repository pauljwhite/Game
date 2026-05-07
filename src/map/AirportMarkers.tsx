import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { useGameStore } from '@/store';
import type { Airport } from '@/types';

const BASE_RADIUS: Record<string, number> = {
  small: 2.5, medium: 3.5, large: 5, major: 6.5,
};

const MIN_ZOOM: Record<string, number> = {
  small: 5, medium: 4, large: 2, major: 2,
};

const HIT_RADIUS: Record<string, number> = {
  small: 14, medium: 14, large: 15, major: 16,
};
const BOUNDS_PADDING = 0.35;
const AIRPORT_PANE = 'airport-marker-pane';
const AIRPORT_PANE_Z_INDEX = 720;

function getVisualRadius(size: string, zoom: number): number {
  const base = BASE_RADIUS[size] ?? 4;
  if (zoom <= 3) return Math.max(2, base * 0.55);
  if (zoom <= 5) return Math.max(2.25, base * (0.55 + (zoom - 3) * 0.18));
  return Math.min(base * 1.5, base * (0.91 + (zoom - 5) * 0.12));
}

function getHitRadius(size: string): number {
  return HIT_RADIUS[size] ?? 14;
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
  const gameDay = useGameStore(s => s.gameDay);
  const entriesRef = useRef<Map<string, MarkerEntry>>(new Map());
  const rendererRef = useRef<L.Renderer | null>(null);
  const hubIatas = playerAirline?.hubIatas ?? [];
  const hubKey = hubIatas.join(',');
  const gameDayRef = useRef(gameDay);
  const hubIatasRef = useRef(hubIatas);

  gameDayRef.current = gameDay;
  hubIatasRef.current = hubIatas;

  const applyMarkerStyle = (entry: MarkerEntry, zoom: number) => {
    const airport = entry.airport;
    const isHub = airport.isHub || hubIatasRef.current.includes(airport.iata);
    const isClosed = airport.closedUntilGameDay !== undefined && airport.closedUntilGameDay >= gameDayRef.current;
    const color = isClosed ? '#ef4444' : isHub ? '#f59e0b' : '#60a5fa';

    entry.visual.setRadius(getVisualRadius(airport.size, zoom));
    entry.visual.setStyle({
      color,
      fillColor: color,
      fillOpacity: 0.9,
      opacity: 1,
    });
  };

  useEffect(() => {
    let pane = map.getPane(AIRPORT_PANE);
    if (!pane) pane = map.createPane(AIRPORT_PANE);
    pane.style.zIndex = String(AIRPORT_PANE_Z_INDEX);
    pane.style.pointerEvents = 'auto';

    const renderer = L.svg({ pane: AIRPORT_PANE }).addTo(map);
    rendererRef.current = renderer;

    const removeMarker = (iata: string) => {
      const entry = entriesRef.current.get(iata);
      if (!entry) return;
      entry.visual.remove();
      entry.hit.remove();
      entriesRef.current.delete(iata);
    };

    const syncVisibleMarkers = () => {
      const zoom = map.getZoom();
      const bounds = map.getBounds().pad(BOUNDS_PADDING);
      const wanted = new Set<string>();

      Object.values(airports).forEach(airport => {
        if (zoom < (MIN_ZOOM[airport.size] ?? 3)) return;
        if (!bounds.contains([airport.lat, airport.lon])) return;

        wanted.add(airport.iata);
        const latlng: [number, number] = [airport.lat, airport.lon];
        const existing = entriesRef.current.get(airport.iata);
        if (existing) {
          existing.airport = airport;
          existing.visual.setLatLng(latlng);
          existing.hit.setLatLng(latlng);
          existing.hit.setRadius(getHitRadius(airport.size));
          applyMarkerStyle(existing, zoom);
          return;
        }

        const visual = L.circleMarker(latlng, {
          radius: getVisualRadius(airport.size, zoom),
          color: '#60a5fa',
          fillColor: '#60a5fa',
          fillOpacity: 0.9,
          opacity: 1,
          weight: 1,
          interactive: false,
          renderer,
        }).addTo(map);

        const hit = L.circleMarker(latlng, {
          radius: getHitRadius(airport.size),
          color: 'transparent',
          fillColor: 'transparent',
          fillOpacity: 0,
          opacity: 0,
          weight: 0,
          interactive: true,
          renderer,
        }).addTo(map);

        hit.on('click', () => selectAirport(airport.iata));
        hit.bindTooltip(airport.iata, { direction: 'top', offset: [0, -4], className: 'leaflet-tooltip-airport' });

        const entry = { visual, hit, airport };
        entriesRef.current.set(airport.iata, entry);
        applyMarkerStyle(entry, zoom);
      });

      Array.from(entriesRef.current.keys()).forEach(iata => {
        if (!wanted.has(iata)) removeMarker(iata);
      });
    };

    let raf = 0;
    const scheduleSync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncVisibleMarkers();
      });
    };

    syncVisibleMarkers();
    map.on('moveend', scheduleSync);
    map.on('zoomend', scheduleSync);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      map.off('moveend', scheduleSync);
      map.off('zoomend', scheduleSync);
      entriesRef.current.forEach(entry => {
        entry.visual.remove();
        entry.hit.remove();
      });
      entriesRef.current.clear();
      renderer.remove();
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airports, map, selectAirport]);

  useEffect(() => {
    const zoom = map.getZoom();
    entriesRef.current.forEach(entry => applyMarkerStyle(entry, zoom));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameDay, hubKey, map]);

  return null;
}
