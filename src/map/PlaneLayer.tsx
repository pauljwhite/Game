import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { getPlanePositions, initPlanePosition, removePlanePosition } from '@/engine/planePositions';
import { latLonToSvgPoint } from './mapProjection';
import { useGameStore } from '@/store';
import { AIRCRAFT_TYPES } from '@/data/aircraftTypes';

interface PlaneLayerProps {
  map: LeafletMap;
  svgOverlay: SVGSVGElement;
}

const MAX_RENDERED_PLANES = 300;

// Top-down propeller aircraft silhouette (nose points up = -Y)
// Subpath 1: propeller cross  Subpath 2: fuselage + wings + tail fins
const PLANE_PATH =
  'M-2.5,-9 L-2.5,-8.2 L-0.5,-8.2 L-0.5,-11 L0.5,-11 L0.5,-8.2 L2.5,-8.2 L2.5,-9 Z ' +
  'M0,-8 L1,-5 L12,-1 L12.5,1.5 L9.5,4 L1.5,3 L2,6.5 L5,8.5 L4.5,11 L0,10.5 ' +
  'L-4.5,11 L-5,8.5 L-2,6.5 L-1.5,3 L-9.5,4 L-12.5,1.5 L-12,-1 L-1,-5 Z';

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

        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('r', '9');
        halo.setAttribute('fill', color);
        halo.setAttribute('opacity', '0.18');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', PLANE_PATH);
        path.setAttribute('fill', color);
        path.setAttribute('stroke', 'rgba(0,0,0,0.35)');
        path.setAttribute('stroke-width', '0.5');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('fill-rule', 'evenodd');
        planeG.appendChild(halo);
        planeG.appendChild(path);
        g.appendChild(planeG);
        planeElementsRef.current.set(ac.id, planeG);
      } else {
        planeG.querySelector('circle')?.setAttribute('fill', color);
        planeG.querySelector('path')?.setAttribute('fill', color);
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
