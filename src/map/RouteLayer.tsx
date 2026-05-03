import React, { useMemo } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { Route } from '@/types';
import { computeArcSegments } from './greatCircle';
import { latLonToSvgPoint, buildSvgPathD } from './mapProjection';
import { useGameStore } from '@/store';

interface RouteLayerProps {
  map: LeafletMap;
  mapVersion: number; // increment on map move/zoom to trigger re-render
}

interface RouteArc {
  routeId: string;
  color: string;
  isPlayer: boolean;
  paths: string[];
  isSelected: boolean;
}

export const RouteLayer: React.FC<RouteLayerProps> = ({ map, mapVersion }) => {
  const routes = useGameStore(s => s.routes);
  const aiRoutes = useGameStore(s => s.aiRoutes);
  const airports = useGameStore(s => s.airports);
  const airlines = useGameStore(s => s.airlines);
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const selectedRouteId = useGameStore(s => s.selectedRouteId);
  const selectRoute = useGameStore(s => s.selectRoute);
  const openModalById = useGameStore(s => s.openModalById);

  const arcs: RouteArc[] = useMemo(() => {
    const result: RouteArc[] = [];

    const processRoute = (route: Route, isPlayer: boolean) => {
      if (!route.isActive) return;
      const origin = airports[route.originIata];
      const dest = airports[route.destinationIata];
      if (!origin || !dest) return;

      const airline = isPlayer
        ? airlines[route.airlineId]
        : aiAirlines[route.airlineId];
      const color = airline?.color ?? '#888';

      const segments = computeArcSegments(origin.lat, origin.lon, dest.lat, dest.lon, 80);
      const paths = segments.map(seg => {
        const svgPts = seg.points.map(p => latLonToSvgPoint(p.lat, p.lon, map));
        return buildSvgPathD(svgPts);
      }).filter(Boolean);

      result.push({ routeId: route.id, color, isPlayer, paths, isSelected: route.id === selectedRouteId });
    };

    Object.values(routes).forEach(r => processRoute(r, true));
    Object.values(aiRoutes).forEach(r => processRoute(r, false));

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, aiRoutes, airports, airlines, aiAirlines, selectedRouteId, mapVersion]);

  void mapVersion;

  return (
    <>
      {arcs.map(arc =>
        arc.paths.map((d, i) => (
          <path
            key={`${arc.routeId}-${i}`}
            d={d}
            stroke={arc.color}
            strokeWidth={arc.isSelected ? 3 : arc.isPlayer ? 1.5 : 1}
            strokeOpacity={arc.isSelected ? 1 : arc.isPlayer ? 0.8 : 0.4}
            fill="none"
            style={{ cursor: arc.isPlayer ? 'pointer' : 'default' }}
            onClick={arc.isPlayer ? () => {
              selectRoute(arc.routeId);
              openModalById('routeDetail', arc.routeId);
            } : undefined}
          />
        ))
      )}
    </>
  );
};
