import { useEffect, useRef } from 'react';
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
const AIRPORT_OVERLAY_Z_INDEX = 800;

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
  group: SVGGElement;
  visual: SVGCircleElement;
  hit: SVGCircleElement;
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
  const overlayRef = useRef<SVGSVGElement | null>(null);
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

    entry.visual.setAttribute('r', String(getVisualRadius(airport.size, zoom)));
    entry.visual.setAttribute('stroke', color);
    entry.visual.setAttribute('fill', color);
  };

  useEffect(() => {
    const container = map.getContainer();
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.id = 'airport-svg-overlay';
    overlay.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.zIndex = String(AIRPORT_OVERLAY_Z_INDEX);
    overlay.style.pointerEvents = 'none';
    overlay.style.overflow = 'visible';
    container.appendChild(overlay);
    overlayRef.current = overlay;

    const syncOverlaySize = () => {
      const size = map.getSize();
      overlay.setAttribute('width', String(size.x));
      overlay.setAttribute('height', String(size.y));
      overlay.style.width = `${size.x}px`;
      overlay.style.height = `${size.y}px`;
    };

    const removeMarker = (iata: string) => {
      const entry = entriesRef.current.get(iata);
      if (!entry) return;
      entry.group.remove();
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
        const point = map.latLngToContainerPoint([airport.lat, airport.lon]);
        const existing = entriesRef.current.get(airport.iata);
        if (existing) {
          existing.airport = airport;
          existing.group.setAttribute('transform', `translate(${point.x.toFixed(1)},${point.y.toFixed(1)})`);
          existing.hit.setAttribute('r', String(getHitRadius(airport.size)));
          applyMarkerStyle(existing, zoom);
          return;
        }

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('transform', `translate(${point.x.toFixed(1)},${point.y.toFixed(1)})`);

        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hit.setAttribute('r', String(getHitRadius(airport.size)));
        hit.setAttribute('fill', 'transparent');
        hit.setAttribute('stroke', 'transparent');
        hit.style.cursor = 'pointer';
        hit.style.pointerEvents = 'all';

        const visual = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        visual.setAttribute('r', String(getVisualRadius(airport.size, zoom)));
        visual.setAttribute('stroke-width', '1');
        visual.setAttribute('fill-opacity', '0.9');
        visual.setAttribute('pointer-events', 'none');

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = airport.iata;

        hit.addEventListener('click', () => selectAirport(airport.iata));
        group.appendChild(hit);
        group.appendChild(visual);
        group.appendChild(title);
        overlay.appendChild(group);

        const entry = { group, visual, hit, airport };
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
        syncOverlaySize();
        syncVisibleMarkers();
      });
    };

    syncOverlaySize();
    syncVisibleMarkers();
    map.on('move', scheduleSync);
    map.on('zoom', scheduleSync);
    map.on('moveend', scheduleSync);
    map.on('zoomend', scheduleSync);
    map.on('resize', scheduleSync);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      map.off('move', scheduleSync);
      map.off('zoom', scheduleSync);
      map.off('moveend', scheduleSync);
      map.off('zoomend', scheduleSync);
      map.off('resize', scheduleSync);
      entriesRef.current.forEach(entry => {
        entry.group.remove();
      });
      entriesRef.current.clear();
      overlay.remove();
      overlayRef.current = null;
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
