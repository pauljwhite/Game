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

const MAX_AI_ROUTE_ARCS = 120;
const ARC_POINT_COUNT = 32;

export const RouteLayer: React.FC<RouteLayerProps> = ({ map, mapVersion }) => {
  // Subscribe ONLY to a stable string derived from geometry-relevant fields. With
  // Zustand's default Object.is equality on the result, the component re-renders
  // only when a route is added/removed/activated or an airline's color changes —
  // NOT when revenue/profit/load-factor stats update every daily tick.
  const geomKey = useGameStore(s => {
    const parts: string[] = [];
    for (const r of Object.values(s.routes)) {
      const color = s.airlines[r.airlineId]?.color ?? '';
      parts.push(`P${r.id}:${r.originIata}-${r.destinationIata}:${r.isActive ? 1 : 0}:${color}`);
    }
    for (const r of Object.values(s.aiRoutes)) {
      if (!s.showAiOnMap) break;
      const ai = s.aiAirlines[r.airlineId];
      const color = ai?.color ?? '';
      const insolvent = ai?.isInsolvent ? 1 : 0;
      parts.push(`A${r.id}:${r.originIata}-${r.destinationIata}:${r.isActive ? 1 : 0}:${insolvent}:${color}`);
    }
    parts.push(`AI:${s.showAiOnMap ? 1 : 0}`);
    return parts.join('|');
  });
  const selectedRouteId = useGameStore(s => s.selectedRouteId);
  const selectRoute = useGameStore(s => s.selectRoute);
  const openModalById = useGameStore(s => s.openModalById);

  const arcs: RouteArc[] = useMemo(() => {
    // Pull fresh state lazily — referencing the dicts here doesn't cause renders.
    const { routes, aiRoutes, airports, airlines, aiAirlines, showAiOnMap } = useGameStore.getState();
    const result: RouteArc[] = [];
    const bounds = map.getBounds().pad(0.35);

    const processRoute = (route: Route, isPlayer: boolean): boolean => {
      if (!route.isActive) return false;
      const origin = airports[route.originIata];
      const dest = airports[route.destinationIata];
      if (!origin || !dest) return false;
      if (!isPlayer && !bounds.contains([origin.lat, origin.lon]) && !bounds.contains([dest.lat, dest.lon])) return false;

      const airline = isPlayer
        ? airlines[route.airlineId]
        : aiAirlines[route.airlineId];
      if (!isPlayer && airline?.isInsolvent) return false;
      const color = airline?.color ?? '#888';

      const segments = computeArcSegments(origin.lat, origin.lon, dest.lat, dest.lon, ARC_POINT_COUNT);
      const paths = segments.map(seg => {
        const svgPts = seg.points.map(p => latLonToSvgPoint(p.lat, p.lon, map));
        return buildSvgPathD(svgPts);
      }).filter(Boolean);

      result.push({ routeId: route.id, color, isPlayer, paths, isSelected: route.id === selectedRouteId });
      return true;
    };

    Object.values(routes).forEach(r => processRoute(r, true));
    let aiArcCount = 0;
    if (showAiOnMap) {
      for (const route of Object.values(aiRoutes)) {
        if (aiArcCount >= MAX_AI_ROUTE_ARCS) break;
        if (processRoute(route, false)) aiArcCount += 1;
      }
    }

    return result;
  }, [geomKey, selectedRouteId, mapVersion, map]);

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
              <path
                d={d}
                stroke="transparent"
                strokeWidth={arc.isPlayer ? 18 : 16}
                strokeLinecap="round"
                fill="none"
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
