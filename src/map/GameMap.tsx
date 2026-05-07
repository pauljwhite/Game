import React, { useState, useEffect, useRef } from 'react';
import { useLeafletMap } from './useLeafletMap';
import { RouteLayer } from './RouteLayer';
import { AirportMarkers } from './AirportMarkers';
import { PlaneLayer } from './PlaneLayer';
import { useGameStore } from '@/store';

const MAP_CONTAINER_ID = 'leaflet-map';

export const GameMap: React.FC = () => {
  const isDark = useGameStore(s => s.themeMode) !== 'light';
  const showAiOnMap = useGameStore(s => s.showAiOnMap);
  const setShowAiOnMap = useGameStore(s => s.setShowAiOnMap);
  const { map, svgOverlay } = useLeafletMap(MAP_CONTAINER_ID, isDark);
  const [mapVersion, setMapVersion] = useState(0);
  const listenerRef = useRef(false);

  useEffect(() => {
    if (!map || listenerRef.current) return;
    listenerRef.current = true;
    let raf = 0;
    const bump = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setMapVersion(v => v + 1);
      });
    };
    map.on('move', bump);
    map.on('zoom', bump);
    map.on('moveend', bump);
    map.on('zoomend', bump);
    map.on('resize', bump);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      listenerRef.current = false;
      map.off('move', bump);
      map.off('zoom', bump);
      map.off('moveend', bump);
      map.off('zoomend', bump);
      map.off('resize', bump);
    };
  }, [map]);

  return (
    <div className="relative w-full h-full">
      <div id={MAP_CONTAINER_ID} className="w-full h-full relative z-0" />
      <button
        type="button"
        onClick={() => setShowAiOnMap(!showAiOnMap)}
        aria-pressed={showAiOnMap}
        className={`absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur transition-colors ${
          isDark
            ? 'border-white/10 bg-gray-950/85 text-gray-200 hover:bg-gray-900'
            : 'border-slate-300 bg-white/90 text-slate-700 hover:bg-white'
        }`}
      >
        <span
          className={`h-3 w-6 rounded-full p-0.5 transition-colors ${
            showAiOnMap ? 'bg-sky-500' : isDark ? 'bg-gray-700' : 'bg-slate-300'
          }`}
        >
          <span
            className={`block h-2 w-2 rounded-full bg-white transition-transform ${
              showAiOnMap ? 'translate-x-3' : 'translate-x-0'
            }`}
          />
        </span>
        Show AI on map
      </button>
      {map && (
        <>
          <AirportMarkers map={map} />
          {svgOverlay && (
            <>
              {/* RouteLayer renders into a React portal-like pattern via the SVG element */}
              <SvgPortal svg={svgOverlay}>
                <RouteLayer map={map} mapVersion={mapVersion} />
              </SvgPortal>
              <PlaneLayer map={map} svgOverlay={svgOverlay} />
            </>
          )}
        </>
      )}
    </div>
  );
};

// Renders React children into an existing SVG element
import { createPortal } from 'react-dom';

function SvgPortal({ svg, children }: { svg: SVGSVGElement; children: React.ReactNode }) {
  // We need a <g> inside the SVG to hold React-managed route paths
  const gRef = useRef<SVGGElement | null>(null);
  if (!gRef.current) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = 'route-layer';
    svg.insertBefore(g, svg.firstChild); // routes behind planes
    gRef.current = g;
  }
  return createPortal(children, gRef.current);
}
