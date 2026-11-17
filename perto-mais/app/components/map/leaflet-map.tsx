// Carregado só no navegador e só quando o mapa entra na tela (ver lazy-map.tsx).
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import * as React from 'react';
import type { MapProps } from './types';

function pinIcon(color = '#E86B19', selected = false) {
  const size = selected ? 44 : 36;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<svg viewBox="0 0 32 32" width="${size}" height="${size}" style="filter:drop-shadow(0 2px 3px rgb(0 0 0 / .3))"><path d="M16 2C9.9 2 5 6.8 5 12.8 5 21 16 30 16 30s11-9 11-17.2C27 6.8 22.1 2 16 2Z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="16" cy="13" r="4.5" fill="#fff"/></svg>`,
  });
}

export default function LeafletMap({
  center,
  zoom = 14,
  markers,
  cluster = false,
  fitToMarkers = false,
  selectedId,
  onMarkerClick,
  draggable = false,
  onMove,
  label,
  className,
}: MapProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const layerRef = React.useRef<L.LayerGroup | null>(null);
  const clickRef = React.useRef(onMarkerClick);
  const moveRef = React.useRef(onMove);
  clickRef.current = onMarkerClick;
  moveRef.current = onMove;

  React.useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // o mapa é criado uma vez; centro/zoom posteriores são aplicados abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    layerRef.current?.remove();
    const group = cluster
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 50,
          iconCreateFunction: (c) => {
            const n = c.getChildCount();
            const size = n < 10 ? 40 : n < 50 ? 48 : 56;
            return L.divIcon({
              className: '',
              iconSize: [size, size],
              html: `<div aria-label="${n} estabelecimentos" style="width:${size}px;height:${size}px;border-radius:9999px;background:#A3480D;color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px;border:3px solid #fff;box-shadow:0 0 0 6px rgb(232 107 25 / .3)">${n}</div>`,
            });
          },
        })
      : L.layerGroup();
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], {
        icon: pinIcon(m.color, m.id === selectedId),
        title: m.title,
        alt: m.title,
        draggable,
        keyboard: true,
        zIndexOffset: m.id === selectedId ? 1000 : 0,
      });
      marker.on('click', () => clickRef.current?.(m.id));
      marker.on('keypress', (e) => {
        if ((e as L.LeafletKeyboardEvent).originalEvent.key === 'Enter') clickRef.current?.(m.id);
      });
      if (draggable) {
        marker.on('dragend', () => {
          const p = marker.getLatLng();
          moveRef.current?.(p.lat, p.lng);
        });
      }
      group.addLayer(marker);
    }
    group.addTo(map);
    layerRef.current = group;
    if (fitToMarkers && markers.length > 1) {
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [40, 40], maxZoom: 16 });
    }
  }, [markers, cluster, selectedId, draggable, fitToMarkers]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!fitToMarkers || markers.length <= 1) map.setView(center, map.getZoom() < zoom && draggable ? zoom : map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  React.useEffect(() => {
    if (!draggable) return;
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => moveRef.current?.(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [draggable]);

  return <div ref={ref} role="region" aria-label={label} className={className} style={{ height: '100%', width: '100%' }} />;
}
