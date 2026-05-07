import { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';

const TILE_URL_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_URL_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_OPTIONS = { subdomains: 'abcd' as const, maxZoom: 19, noWrap: true };

export interface LeafletMapHandle {
  map: L.Map | null;
  svgOverlay: SVGSVGElement | null;
}

const WORLD_BOUNDS = L.latLngBounds(
  L.latLng(-85.05112878, -180),
  L.latLng(85.05112878, 180),
);

export function useLeafletMap(containerId: string, isDark = true): LeafletMapHandle {
  const [map, setMap] = useState<L.Map | null>(null);
  const [svgOverlay, setSvgOverlay] = useState<SVGSVGElement | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

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
      preferCanvas: true,
      maxBounds: WORLD_BOUNDS,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
    });

    tileLayerRef.current = L.tileLayer(
      isDark ? TILE_URL_DARK : TILE_URL_LIGHT,
      { ...TILE_OPTIONS, bounds: WORLD_BOUNDS },
    ).addTo(m);

    // SVG overlay - absolutely positioned over the map container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.zIndex = '450';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    svg.id = 'route-svg-overlay';
    container.style.position = 'relative';
    container.appendChild(svg);

    let sizeRaf = 0;
    const scheduleSvgSizeSync = () => {
      if (sizeRaf) return;
      sizeRaf = requestAnimationFrame(() => {
        sizeRaf = 0;
        syncSvgSize(m, svg);
      });
    };

    syncSvgSize(m, svg);
    m.on('resize', scheduleSvgSizeSync);
    m.on('move', scheduleSvgSizeSync);
    m.on('zoom', scheduleSvgSizeSync);

    setMap(m);
    setSvgOverlay(svg);

    return () => {
      if (sizeRaf) cancelAnimationFrame(sizeRaf);
      m.off('resize', scheduleSvgSizeSync);
      m.off('move', scheduleSvgSizeSync);
      m.off('zoom', scheduleSvgSizeSync);
      m.remove();
      if (svg.parentNode) svg.parentNode.removeChild(svg);
      setMap(null);
      setSvgOverlay(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  // Swap tile layer when theme changes after map init
  useEffect(() => {
    if (!map || !tileLayerRef.current) return;
    tileLayerRef.current.remove();
    tileLayerRef.current = L.tileLayer(
      isDark ? TILE_URL_DARK : TILE_URL_LIGHT,
      { ...TILE_OPTIONS, bounds: WORLD_BOUNDS },
    ).addTo(map);
  }, [isDark, map]);

  return { map, svgOverlay };
}
