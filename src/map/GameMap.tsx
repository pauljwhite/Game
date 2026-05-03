import React, { useState, useEffect, useRef } from 'react';
import { useLeafletMap } from './useLeafletMap';
import { RouteLayer } from './RouteLayer';
import { AirportMarkers } from './AirportMarkers';
import { PlaneLayer } from './PlaneLayer';

const MAP_CONTAINER_ID = 'leaflet-map';

export const GameMap: React.FC = () => {
  const { map, svgOverlay } = useLeafletMap(MAP_CONTAINER_ID);
  const [mapVersion, setMapVersion] = useState(0);
  const listenerRef = useRef(false);

  useEffect(() => {
    if (!map || listenerRef.current) return;
    listenerRef.current = true;
    const bump = () => setMapVersion(v => v + 1);
    map.on('moveend', bump);
    map.on('zoomend', bump);
    map.on('resize', bump);
    return () => {
      listenerRef.current = false;
      map.off('moveend', bump);
      map.off('zoomend', bump);
      map.off('resize', bump);
    };
  }, [map]);

  return (
    <div className="relative w-full h-full">
      <div id={MAP_CONTAINER_ID} className="w-full h-full relative z-0" />
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
