import { useEffect, useState, useCallback } from 'react';
import L from 'leaflet';

export interface LeafletMapHandle {
  map: L.Map | null;
  svgOverlay: SVGSVGElement | null;
}

export function useLeafletMap(containerId: string): LeafletMapHandle {
  const [map, setMap] = useState<L.Map | null>(null);
  const [svgOverlay, setSvgOverlay] = useState<SVGSVGElement | null>(null);

  const syncSvgSize = useCallback((m: L.Map, svg: SVGSVGElement) => {
    const size = m.getSize();
    svg.setAttribute('width', String(size.x));
    svg.setAttribute('height', String(size.y));
    svg.style.width = `${size.x}px`;
    svg.style.height = `${size.y}px`;
  }, []);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const m = L.map(container, {
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
    ).addTo(m);

    // SVG overlay — absolutely positioned over the map container
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

    syncSvgSize(m, svg);
    m.on('resize', () => syncSvgSize(m, svg));
    m.on('move', () => syncSvgSize(m, svg));
    m.on('zoom', () => syncSvgSize(m, svg));

    setMap(m);
    setSvgOverlay(svg);

    return () => {
      m.remove();
      if (svg.parentNode) svg.parentNode.removeChild(svg);
      setMap(null);
      setSvgOverlay(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  return { map, svgOverlay };
}
