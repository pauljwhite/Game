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

const PLANE_PATH = 'M0,-8 L3,3 L0,1 L-3,3 Z';
const MAX_RENDERED_PLANES = 300;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function PlaneLayer({ map, svgOverlay }: PlaneLayerProps) {
  const routes = useGameStore(s => s.routes);
  const aiRoutes = useGameStore(s => s.aiRoutes);
  const aircraft = useGameStore(s => s.aircraft);
  const aiAircraft = useGameStore(s => s.aiAircraft);
  const airlines = useGameStore(s => s.airlines);
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const airports = useGameStore(s => s.airports);

  const rafRef = useRef(0);
  const planeGroupRef = useRef<SVGGElement | null>(null);

  // Initialize/sync plane DOM nodes when routes change
  useEffect(() => {
    if (!planeGroupRef.current) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.id = 'plane-layer';
      svgOverlay.appendChild(g);
      planeGroupRef.current = g;
    }

    const g = planeGroupRef.current;
    const positions = getPlanePositions();

    // Add planes for active routes
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

      if (!document.getElementById(`plane-${ac.id}`)) {
        const planeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        planeG.id = `plane-${ac.id}`;
        planeG.setAttribute('class', 'route-plane');

        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('r', '7');
        halo.setAttribute('fill', color);
        halo.setAttribute('opacity', '0.22');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', PLANE_PATH);
        path.setAttribute('fill', color);
        path.setAttribute('stroke', '#ffffff');
        path.setAttribute('stroke-width', '0.8');
        path.setAttribute('stroke-linejoin', 'round');
        planeG.appendChild(halo);
        planeG.appendChild(path);
        g.appendChild(planeG);
      } else {
        const el = document.getElementById(`plane-${ac.id}`);
        el?.querySelector('circle')?.setAttribute('fill', color);
        el?.querySelector('path')?.setAttribute('fill', color);
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
        const el = document.getElementById(`plane-${aircraftId}`);
        if (el) el.remove();
      }
    });

  }, [routes, aiRoutes, aircraft, aiAircraft, airlines, aiAirlines, airports, svgOverlay]);

  useEffect(() => {
    const group = planeGroupRef.current;
    return () => {
      group?.remove();
      planeGroupRef.current = null;
    };
  }, []);

  // Animation loop - direct DOM, no React
  useEffect(() => {
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const positions = getPlanePositions();
      positions.forEach((state, aircraftId) => {
        const el = document.getElementById(`plane-${aircraftId}`);
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
