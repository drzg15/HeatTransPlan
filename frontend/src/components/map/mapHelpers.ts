/** Small pure helpers for the map: tile sources, box icons, stream colours. */

import L from 'leaflet';

export const TILE_URLS: Record<string, string> = {
  OpenStreetMap: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  Positron: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  Satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
};

export function createDivIcon(
  _emoji: string,
  label: string,
  _color: string,
  scale: number = 1.0,
  isSelected: boolean = true,
  isMultiSelected: boolean = false,
  markerType: string = '',
  markerId: string = ''
) {
  const fs = Math.max(12, Math.round(15 * scale));
  const px = Math.max(6, Math.round(12 * scale));
  const py = Math.max(3, Math.round(6 * scale));
  const opacity = isSelected ? 1.0 : 0.4;

  const borderColor = isMultiSelected ? 'var(--warning)' : isSelected ? '#1b5e20' : '#1b5e20';
  const bg = isMultiSelected ? 'var(--brand-magenta)' : isSelected ? '#2e7d32' : '#1b5e20';
  const borderWeight = isMultiSelected ? '3px' : '1px';
  const textColor = '#ffffff'; // Always white for green markers for best contrast

  const avgCharWidth = fs * 0.62;
  const width = Math.round(Math.max(20, label.length * avgCharWidth + px * 2 + 2));
  const height = Math.round(fs + py * 2 + 2);

  const dataAttrs = markerType
    ? `data-marker-type="${markerType}" data-marker-id="${markerId}"`
    : '';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="draggable-marker" ${dataAttrs} style="background:${bg};color:${textColor};padding:${py}px ${px}px;border-radius:4px;font-size:${fs}px;font-weight:600;white-space:nowrap;width:${width}px;height:${height}px;text-align:center;display:flex;align-items:center;justify-content:center;border:${borderWeight} solid ${borderColor};box-shadow:var(--shadow-sm);opacity:${opacity};transition:background 0.23s,opacity 0.23s;cursor:grab;user-select:none">
      ${label}
    </div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
}

export function streamColor(
  isHot: boolean,
  t: number,
  isSelected: boolean
): { fill: string; stroke: string } {
  if (!isSelected) {
    return {
      fill: 'rgba(180,180,180,0.3)',
      stroke: 'rgba(150,150,150,0.4)',
    };
  }
  if (isHot) {
    const r = 255;
    const g = Math.round(120 - t * 120);
    const b = Math.round(120 - t * 120);
    return {
      fill: `rgba(${r},${g},${b},0.88)`,
      stroke: `rgba(${Math.round(r * 0.6)},0,0,0.95)`,
    };
  } else {
    const r = Math.round(100 - t * 80);
    const g = Math.round(150 - t * 120);
    const b = 255;
    return {
      fill: `rgba(${r},${g},${b},0.88)`,
      stroke: `rgba(0,${Math.round(g * 0.4)},${Math.round(b * 0.6)},0.95)`,
    };
  }
}
