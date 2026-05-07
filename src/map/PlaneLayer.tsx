import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { getPlanePositions, initPlanePosition, removePlanePosition } from '@/engine/planePositions';
import { latLonToSvgPoint } from './mapProjection';
import { useGameStore } from '@/store';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';
import cessnaPlaneUrl from '@/assets/cessna-map-plane.svg';

interface PlaneLayerProps {
  map: LeafletMap;
  svgOverlay: SVGSVGElement;
}

const MAX_RENDERED_PLANES = 300;
const PLANE_ICON_SIZE = 28;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function PlaneLayer({ map, svgOverlay }: PlaneLayerProps) {
  // Subscribe to a stable key that only changes when plane DOM topology needs to
  // change: route assignments, active state, grounded state, color. Stats updates
  // (revenue/profit/load) won't re-trigger DOM diffing every tick.
  const planeKey = useGameStore(s => {
    const parts: string[] = [];
    const addRoute = (r: { id: string; aircraftId: string | null; isActive: boolean; airlineId: string }, prefix: string) => {
      if (!r.aircraftId || !r.isActive) return;
      const ac = s.aircraft[r.aircraftId] ?? s.aiAircraft[r.aircraftId];
      if (!ac || ac.isGrounded) return;
      const airline = s.airlines[ac.airlineId] ?? s.aiAirlines[ac.airlineId];
      if (airline?.isInsolvent) return;
      parts.push(`${prefix}${r.id}:${r.aircraftId}:${ac.typeId}:${airline?.color ?? ''}`);
    };
    for (const r of Object.values(s.routes)) addRoute(r, 'P');
    for (const r of Object.values(s.aiRoutes)) addRoute(r, 'A');
    return parts.join('|');
  });

  const rafRef = useRef(0);
  const planeGroupRef = useRef<SVGGElement | null>(null);
  const planeElementsRef = useRef<Map<string, SVGGElement>>(new Map());

  // Initialize/sync plane DOM nodes when planeKey changes
  useEffect(() => {
    if (!planeGroupRef.current) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.id = 'plane-layer';
      svgOverlay.appendChild(g);
      planeGroupRef.current = g;
    }

    const g = planeGroupRef.current;
    const positions = getPlanePositions();

    // Pull fresh state lazily — these dict refs don't drive the effect.
    const { routes, aiRoutes, aircraft, aiAircraft, airlines, aiAirlines, airports } = useGameStore.getState();

    const allRoutes = [
      ...Object.values(routes),
      ...Object.values(aiRoutes).slice(0, Math.max(0, MAX_RENDERED_PLANES - Object.keys(routes).length)),
    ];
    const allAircraft = { ...aircraft, ...aiAircraft };
    const allAirlines = { ...airlines, ...aiAirlines };

    allRoutes.forEach(route => {
      if (!route.isActive || !route.aircraftId) return;
      const ac = allAircraft[route.aircraftId];
      if (!ac || ac.isGrounded) return;

      const origin = airports[route.originIata];
      const dest = airports[route.destinationIata];
      if (!origin || !dest) return;

      const airline = allAirlines[ac.airlineId];
      if (airline?.isInsolvent) return;
      const color = airline?.color ?? '#ffffff';
      const aircraftType = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
      const speedKmh = aircraftType?.cruiseSpeedKmh ?? 850;
      const flightDurationMs = (route.distanceKm / speedKmh) * 3_600_000;
      const cycleOffsetMs = hashString(ac.id) % Math.max(1, Math.round(flightDurationMs * 2));
      const position = positions.get(ac.id);

      if (!position || position.routeId !== route.id) {
        initPlanePosition(ac.id, route.id, ac.airlineId, color, origin.lat, origin.lon, cycleOffsetMs);
      }

      let planeG = planeElementsRef.current.get(ac.id);
      if (!planeG) {
        const planeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        planeG.id = `plane-${ac.id}`;
        planeG.setAttribute('class', 'route-plane');
        const maskId = `plane-mask-${ac.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('r', '8');
        halo.setAttribute('fill', color);
        halo.setAttribute('opacity', '0.18');

        const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        mask.id = maskId;
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('x', `${-PLANE_ICON_SIZE / 2}`);
        mask.setAttribute('y', `${-PLANE_ICON_SIZE / 2}`);
        mask.setAttribute('width', `${PLANE_ICON_SIZE}`);
        mask.setAttribute('height', `${PLANE_ICON_SIZE}`);
        mask.setAttribute('style', 'mask-type: alpha;');

        const maskImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        maskImage.setAttribute('href', cessnaPlaneUrl);
        maskImage.setAttribute('x', `${-PLANE_ICON_SIZE / 2}`);
        maskImage.setAttribute('y', `${-PLANE_ICON_SIZE / 2}`);
        maskImage.setAttribute('width', `${PLANE_ICON_SIZE}`);
        maskImage.setAttribute('height', `${PLANE_ICON_SIZE}`);
        maskImage.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        mask.appendChild(maskImage);

        const shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shape.setAttribute('x', `${-PLANE_ICON_SIZE / 2}`);
        shape.setAttribute('y', `${-PLANE_ICON_SIZE / 2}`);
        shape.setAttribute('width', `${PLANE_ICON_SIZE}`);
        shape.setAttribute('height', `${PLANE_ICON_SIZE}`);
        shape.setAttribute('fill', color);
        shape.setAttribute('mask', `url(#${maskId})`);

        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        outline.setAttribute('href', cessnaPlaneUrl);
        outline.setAttribute('x', `${-PLANE_ICON_SIZE / 2}`);
        outline.setAttribute('y', `${-PLANE_ICON_SIZE / 2}`);
        outline.setAttribute('width', `${PLANE_ICON_SIZE}`);
        outline.setAttribute('height', `${PLANE_ICON_SIZE}`);
        outline.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        outline.setAttribute('opacity', '0.18');
        planeG.appendChild(halo);
        planeG.appendChild(mask);
        planeG.appendChild(shape);
        planeG.appendChild(outline);
        g.appendChild(planeG);
        planeElementsRef.current.set(ac.id, planeG);
      } else {
        planeG.querySelector('circle')?.setAttribute('fill', color);
        planeG.querySelector('rect')?.setAttribute('fill', color);
      }
    });

    const activeAircraftIds = new Set(
      allRoutes
        .filter(route => route.isActive && route.aircraftId)
        .map(route => route.aircraftId as string),
    );

    // Remove planes for routes that no longer exist or are no longer active
    positions.forEach((_, aircraftId) => {
      const ac = allAircraft[aircraftId];
      if (!ac || ac.isGrounded || !ac.assignedRouteId || !activeAircraftIds.has(aircraftId)) {
        removePlanePosition(aircraftId);
        const el = planeElementsRef.current.get(aircraftId);
        if (el) el.remove();
        planeElementsRef.current.delete(aircraftId);
      }
    });

  }, [planeKey, svgOverlay]);

  useEffect(() => {
    const group = planeGroupRef.current;
    return () => {
      group?.remove();
      planeGroupRef.current = null;
      planeElementsRef.current.clear();
    };
  }, []);

  // Animation loop - direct DOM, no React
  useEffect(() => {
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const positions = getPlanePositions();
      positions.forEach((state, aircraftId) => {
        const el = planeElementsRef.current.get(aircraftId);
        if (!el) return;
        const pt = latLonToSvgPoint(state.lat, state.lon, map);
        el.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)}) rotate(${state.bearing.toFixed(1)})`);
      });
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [map]);

  return null;
}
