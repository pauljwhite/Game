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

const MAX_AI_ROUTE_ARCS = 250;
const ARC_POINT_COUNT = 48;

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
      if (!isPlayer && airline?.isInsolvent) return;
      const color = airline?.color ?? '#888';

      const segments = computeArcSegments(origin.lat, origin.lon, dest.lat, dest.lon, ARC_POINT_COUNT);
      const paths = segments.map(seg => {
        const svgPts = seg.points.map(p => latLonToSvgPoint(p.lat, p.lon, map));
        return buildSvgPathD(svgPts);
      }).filter(Boolean);

      result.push({ routeId: route.id, color, isPlayer, paths, isSelected: route.id === selectedRouteId });
    };

    Object.values(routes).forEach(r => processRoute(r, true));
    Object.values(aiRoutes).slice(0, MAX_AI_ROUTE_ARCS).forEach(r => processRoute(r, false));

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, aiRoutes, airports, airlines, aiAirlines, selectedRouteId, mapVersion]);

  void mapVersion;

  return (
    <>
      {arcs.map(arc =>
        arc.paths.map((d, i) => {
          const routeKey = `${arc.routeId}-${i}`;
          const clickHandler = arc.isPlayer
            ? () => { selectRoute(arc.routeId); openModalById('routeDetail', arc.routeId); }
            : () => { openModalById('aiRouteDetail', arc.routeId); };

          return (
            <g key={routeKey} className="route-arc">
              <path
                d={d}
                stroke={arc.color}
                strokeWidth={arc.isSelected ? 7 : arc.isPlayer ? 5 : 3}
                strokeOpacity={arc.isSelected ? 0.35 : arc.isPlayer ? 0.22 : 0.12}
                fill="none"
                pointerEvents="none"
              />
              <path
                d={d}
                stroke={arc.color}
                strokeWidth={arc.isSelected ? 3 : arc.isPlayer ? 2 : 1.25}
                strokeOpacity={arc.isSelected ? 1 : arc.isPlayer ? 0.85 : 0.45}
                strokeLinecap="round"
                strokeDasharray={arc.isPlayer ? '10 9' : '5 10'}
                fill="none"
                className={arc.isPlayer ? 'route-arc-line route-arc-line--animated' : 'route-arc-line'}
                style={{ cursor: 'pointer' }}
                pointerEvents="stroke"
                onClick={clickHandler}
              />
            </g>
          );
        })
      )}
    </>
  );
};
