import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';

export interface LeafletMapHandle {
  map: L.Map | null;
  svgOverlay: SVGSVGElement | null;
}

export function useLeafletMap(containerId: string): LeafletMapHandle {
  const mapRef = useRef<L.Map | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const syncSvgSize = useCallback(() => {
    const map = mapRef.current;
    const svg = svgRef.current;
    if (!map || !svg) return;
    const size = map.getSize();
    svg.setAttribute('width', String(size.x));
    svg.setAttribute('height', String(size.y));
    svg.style.width = `${size.x}px`;
    svg.style.height = `${size.y}px`;
  }, []);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [20, 0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 },
    ).addTo(map);

    // SVG overlay — absolutely positioned over the map
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    svg.id = 'route-svg-overlay';
    container.style.position = 'relative';
    container.appendChild(svg);

    mapRef.current = map;
    svgRef.current = svg;

    syncSvgSize();

    map.on('resize', syncSvgSize);
    map.on('move', syncSvgSize);
    map.on('zoom', syncSvgSize);

    return () => {
      map.remove();
      mapRef.current = null;
      svgRef.current = null;
    };
  }, [containerId, syncSvgSize]);

  return { map: mapRef.current, svgOverlay: svgRef.current };
}
