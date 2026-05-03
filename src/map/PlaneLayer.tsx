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

const PLANE_PATH = 'M0,-6 L2,2 L0,0 L-2,2 Z'; // simple arrow/chevron

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
    const allRoutes = [...Object.values(routes), ...Object.values(aiRoutes)];
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
      const color = airline?.color ?? '#ffffff';

      if (!positions.has(ac.id)) {
        initPlanePosition(ac.id, route.id, ac.airlineId, color, origin.lat, origin.lon);
      }

      if (!document.getElementById(`plane-${ac.id}`)) {
        const planeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        planeG.id = `plane-${ac.id}`;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', PLANE_PATH);
        path.setAttribute('fill', color);
        path.setAttribute('stroke', 'rgba(0,0,0,0.5)');
        path.setAttribute('stroke-width', '0.5');
        planeG.appendChild(path);
        g.appendChild(planeG);
      }
    });

    // Remove planes for routes that no longer exist
    positions.forEach((_, aircraftId) => {
      const ac = allAircraft[aircraftId];
      if (!ac || ac.isGrounded || !ac.assignedRouteId) {
        removePlanePosition(aircraftId);
        const el = document.getElementById(`plane-${aircraftId}`);
        if (el) el.remove();
      }
    });

    // Also remove aircraft types to get speed
    const aircraftSpeeds: Record<string, number> = {};
    Object.values(allAircraft).forEach(ac => {
      const type = AIRCRAFT_TYPES.find(t => t.id === ac.typeId);
      if (type) aircraftSpeeds[ac.id] = type.cruiseSpeedKmh;
    });
  }, [routes, aiRoutes, aircraft, aiAircraft, airlines, aiAirlines, airports, svgOverlay]);

  // Animation loop — direct DOM, no React
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
