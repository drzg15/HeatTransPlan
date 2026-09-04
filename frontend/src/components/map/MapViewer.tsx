import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Rectangle,
  useMap,
  useMapEvents,
  Pane,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProcessNode } from '../../types/process';
import { extractStreamInfo } from '../../utils/streamInfo';
import './MapViewer.css';

// Fix missing Leaflet default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface GroupCoords {
  lat?: string | number | null;
  lon?: string | number | null;
  hours?: string;
  box_scale?: string | number;
}

interface Props {
  center: [number, number];
  zoom: number;
  locked: boolean;
  processes: ProcessNode[];
  groups: number[][];
  groupNames: string[];
  groupCoordinates: Record<string, GroupCoords>;
  baseTile: string;
  onClick: (lat: number, lon: number) => void;
  onMoveEnd: (center: [number, number], zoom: number) => void;
  subprocessMapExpanded: Record<number, boolean>;
  childMapExpanded: Record<number, boolean>;
  onProcessesChange?: (processes: ProcessNode[]) => void;
  onGroupCoordinatesChange?: (coords: Record<string, GroupCoords>) => void;
  onElementDoubleClick?: (type: 'group' | 'sub' | 'child' | 'stream', id: any, subId?: any) => void;
  height?: string | number;

  // Selection
  selectedStreams?: Record<string, boolean>;
  onProcessesSelect?: (pIdxs: number[], val: boolean) => void;
  onSelectionToggle?: (pIdx: number, si: number) => void;
  selectionActive?: boolean;
  className?: string;
  allowMultiMove?: boolean;
}

/**
 * BoxSelector: Handles Click-and-Drag area selection on the map.
 * Re-implemented with direct DOM events for maximum reliability on locked maps.
 */
function BoxSelector({
  onSelect,
  active,
}: {
  onSelect: (bounds: L.LatLngBounds) => void;
  active: boolean;
}) {
  const map = useMap();
  const [visualBounds, setVisualBounds] = useState<L.LatLngBounds | null>(null);
  const startLatLngRef = useRef<L.LatLng | null>(null);

  useEffect(() => {
    if (!active) {
      setVisualBounds(null);
      startLatLngRef.current = null;
      return;
    }

    const container = map.getContainer();

    const onDown = (e: MouseEvent) => {
      // 1. Only left click
      if (e.button !== 0) return;

      // 2. Ignore UI
      const target = e.target as HTMLElement;
      if (
        target.closest('.leaflet-control') ||
        target.closest('.pa-map-toolbar') ||
        target.closest('.leaflet-marker-icon')
      ) {
        return;
      }

      // 3. Start selection
      const latlng = map.mouseEventToLatLng(e);
      startLatLngRef.current = latlng;
      setVisualBounds(null);

      // Prevent map panning
      map.dragging.disable();
    };

    const onMove = (e: MouseEvent) => {
      if (!startLatLngRef.current) return;

      const currentLatLng = map.mouseEventToLatLng(e);
      const bounds = L.latLngBounds(startLatLngRef.current, currentLatLng);
      setVisualBounds(bounds);
    };

    const onUp = (e: MouseEvent) => {
      if (!startLatLngRef.current) {
        map.dragging.enable();
        return;
      }

      const currentLatLng = map.mouseEventToLatLng(e);
      const bounds = L.latLngBounds(startLatLngRef.current, currentLatLng);

      // Clean up state immediately
      startLatLngRef.current = null;
      setVisualBounds(null);
      map.dragging.enable();

      // Trigger selection if meaningful distance
      if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 1.0) {
        onSelect(bounds);
      }
    };

    L.DomEvent.on(container, 'mousedown', onDown as any);
    L.DomEvent.on(window as any, 'mousemove', onMove as any);
    L.DomEvent.on(window as any, 'mouseup', onUp as any);

    return () => {
      L.DomEvent.off(container, 'mousedown', onDown as any);
      L.DomEvent.off(window as any, 'mousemove', onMove as any);
      L.DomEvent.off(window as any, 'mouseup', onUp as any);
      map.dragging.enable();
    };
  }, [active, map, onSelect]);

  if (!visualBounds) return null;
  return (
    <Rectangle
      bounds={visualBounds}
      pathOptions={{
        color: '#3498db',
        weight: 2,
        dashArray: '6, 8',
        fillOpacity: 0.15,
        interactive: false,
      }}
    />
  );
}

const TILE_URLS: Record<string, string> = {
  OpenStreetMap: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  Positron: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  Satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

function createDivIcon(
  _emoji: string,
  label: string,
  _color: string,
  scale: number = 1.0,
  isSelected: boolean = true,
  isMultiSelected: boolean = false,
  markerType: string = '',
  markerId: string = ''
) {
  const fs = Math.max(10, Math.round(10 * scale));
  const px = Math.max(4, Math.round(8 * scale));
  const py = Math.max(2, Math.round(4 * scale));
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

function MapController({
  center,
  zoom,
  locked,
}: {
  center: [number, number];
  zoom: number;
  locked: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (locked) {
      map.setView(center, zoom, { animate: false });
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      if ((map as any).touchZoom) (map as any).touchZoom.disable();
      if ((map as any).tap) (map as any).tap.disable();
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      if ((map as any).touchZoom) (map as any).touchZoom.enable();
      if ((map as any).tap) (map as any).tap.enable();
    }
  }, [center, zoom, locked, map]);
  return null;
}

function MapMoveHandler({
  onMoveEnd,
  locked,
}: {
  onMoveEnd: (center: [number, number], zoom: number) => void;
  locked: boolean;
}) {
  useMapEvents({
    moveend(e) {
      if (locked) return;
      const map = e.target;
      const c = map.getCenter();
      onMoveEnd([c.lat, c.lng], map.getZoom());
    },
  });
  return null;
}

function MapFullscreenResizer({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const delays = [50, 200, 500];
    const timers = delays.map((d) => setTimeout(() => map.invalidateSize(), d));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [active, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      if (onClick) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Called once on mount: invalidates the Leaflet container size, waits a tick
 * for Leaflet to recalculate its internal pixel grid, then snaps the view to
 * the correct center/zoom. invalidateSize and setView MUST be in separate
 * timeouts — calling them together means setView runs before Leaflet has
 * finished updating its size math, causing the "cut-off corner" bug.
 */
function MapMountFitter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Step 1: force Leaflet to measure the real container size
    const invalidate = () => map.invalidateSize({ animate: false });
    // Step 2: after size is known, snap to correct center+zoom
    const refit = () => map.setView(center, zoom, { animate: false });

    timers.push(setTimeout(invalidate, 0));
    timers.push(setTimeout(refit, 50));
    timers.push(setTimeout(invalidate, 100));
    timers.push(setTimeout(refit, 150));
    timers.push(setTimeout(invalidate, 300));
    timers.push(setTimeout(refit, 400));

    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function SubprocessCanvasOverlay({ active, deps }: { active: boolean; deps?: any }) {
  const map = useMap();
  const [center, setCenter] = useState<L.LatLng | null>(null);
  const [size, setSize] = useState<L.Point | null>(null);

  // We re-evaluate the center whenever deps change to ensure the canvas follows the map if needed
  useEffect(() => {
    if (active) {
      setCenter(map.getCenter());
      setSize(map.getSize());
    } else {
      setCenter(null);
      setSize(null);
    }
  }, [active, map, deps]);

  if (!active || !center || !size) return null;

  // Use 90% of the viewport dimensions
  const width = size.x * 0.9;
  const height = size.y * 0.9;

  // By using a DOM-based Marker instead of a vector Rectangle, we completely bypass
  // Leaflet's SVG renderer limitations with custom panes.
  const bgIcon = L.divIcon({
    className: 'subprocess-canvas-bg',
    html: `<div style="width: ${width}px; height: ${height}px; margin-left: -${width / 2}px; margin-top: -${height / 2}px; background: var(--surface, #ffffff); opacity: 0.91; pointer-events: none; border-radius: 12px; border: 1px solid var(--border, #e0e0e0); box-shadow: 0 8px 32px rgba(0,0,0,0.08);"></div>`,
    iconSize: [0, 0],
  });

  return (
    <Marker
      position={center}
      icon={bgIcon}
      pane="canvasPane"
      interactive={false}
      keyboard={false}
    />
  );
}

// ─── Stream Circles Overlay ─────────────────────────────────────────────────
// Draws SVG bubble circles on the map above each process group, matching the
// Streamlit app: circle SIZE = Q heat power (kW, globally min-max scaled),
// COLOR = continuous blue→red gradient based on global temperature range.

interface StreamCirclesOverlayProps {
  processes: ProcessNode[];
  groups: number[][];
  groupNames: string[];
  groupCoordinates: Record<string, GroupCoords>;
  onElementDoubleClick?: (type: 'group' | 'sub' | 'child' | 'stream', id: any, subId?: any) => void;
  selectedStreams?: Record<string, boolean>;
  onSelectionToggle?: (pIdx: number, si: number) => void;
  locked?: boolean;
  onDragEnd?: (e: L.LeafletEvent, type: 'group' | 'sub' | 'child', id: string) => void;
  renderingMode?: 'default' | 'children';
  childMapExpanded?: Record<number, boolean>;
}

function streamColor(
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

function StreamCirclesOverlay({
  processes,
  groups,
  groupNames: _groupNames,
  groupCoordinates,
  onElementDoubleClick,
  selectedStreams,
  onSelectionToggle,
  locked = false,
  onDragEnd,
  renderingMode = 'default',
  childMapExpanded,
}: StreamCirclesOverlayProps) {
  interface StreamBubble {
    name: string;
    subprocess: string;
    tin: number | null;
    tout: number | null;
    Q: number | null;
    pIdx: number;
    ci?: number;
    si: number;
  }
  interface GroupBubbles {
    gIdx: number;
    lat: number;
    lon: number;
    streams: StreamBubble[];
  }

  const groupBubbles = useMemo<GroupBubbles[]>(() => {
    const result: GroupBubbles[] = [];
    if (renderingMode === 'children' && childMapExpanded) {
      processes.forEach((sub, si) => {
        if (!childMapExpanded[si]) return;
        (sub.children || []).forEach((child, ci) => {
          const lat = parseFloat(String(child.lat));
          const lon = parseFloat(String(child.lon));
          if (isNaN(lat) || isNaN(lon)) return;

          const streams: StreamBubble[] = [];
          (child.streams || []).forEach((s, sidx) => {
            const info = extractStreamInfo(s as Record<string, any>);
            streams.push({
              name: s.name || 'Stream',
              subprocess: child.name,
              tin: info.tin,
              tout: info.tout,
              Q: info.Q,
              pIdx: si,
              ci: ci,
              si: sidx,
            });
          });
          if (streams.length > 0) {
            result.push({ gIdx: -1, lat, lon, streams });
          }
        });
      });
    } else {
      groups.forEach((subIdxs, gIdx) => {
        const gCoords = groupCoordinates[gIdx];
        if (!gCoords) return;
        const lat = parseFloat(String(gCoords.lat ?? ''));
        const lon = parseFloat(String(gCoords.lon ?? ''));
        if (isNaN(lat) || isNaN(lon)) return;

        const streams: StreamBubble[] = [];
        subIdxs.forEach((si) => {
          const p = processes[si];
          if (!p) return;
          (p.streams || []).forEach((s, sidx) => {
            const info = extractStreamInfo(s as Record<string, any>);
            streams.push({
              name: s.name || 'Stream',
              subprocess: p.name,
              tin: info.tin,
              tout: info.tout,
              Q: info.Q,
              pIdx: si,
              si: sidx,
            });
          });
        });

        if (streams.length > 0) {
          result.push({ gIdx, lat, lon, streams });
        }
      });
    }
    return result;
  }, [processes, groups, groupCoordinates, renderingMode, childMapExpanded]);

  const { qMin, qRange } = useMemo(() => {
    const qs = groupBubbles.flatMap((gb) => gb.streams.map((s) => s.Q ?? 0)).filter((q) => q > 0);
    const mn = qs.length ? Math.min(...qs) : 0;
    const mx = qs.length ? Math.max(...qs) : 1;
    return { qMin: mn, qRange: mx === mn ? 1 : mx - mn };
  }, [groupBubbles]);

  const { hotMin, hotRange, coldMin, coldRange } = useMemo(() => {
    const hotTemps: number[] = [];
    const coldTemps: number[] = [];
    groupBubbles.forEach((gb) => {
      gb.streams.forEach((s) => {
        if (s.tin != null && s.tout != null) {
          const maxT = Math.max(s.tin, s.tout);
          if (s.tin > s.tout) hotTemps.push(maxT);
          else coldTemps.push(maxT);
        }
      });
    });
    const hMin = hotTemps.length ? Math.min(...hotTemps) : 0;
    const hMax = hotTemps.length ? Math.max(...hotTemps) : 200;
    const cMin = coldTemps.length ? Math.min(...coldTemps) : 0;
    const cMax = coldTemps.length ? Math.max(...coldTemps) : 200;
    return {
      hotMin: hMin,
      hotRange: hMax === hMin ? 1 : hMax - hMin,
      coldMin: cMin,
      coldRange: cMax === cMin ? 1 : cMax - cMin,
    };
  }, [groupBubbles]);

  const streamColorFor = (tin: number | null, tout: number | null, isSelected: boolean) => {
    if (tin == null || tout == null) return { fill: 'rgba(150,150,150,0.5)', stroke: '#999' };
    const isHot = tin > tout;
    const maxT = Math.max(tin, tout);
    const t = isHot
      ? Math.max(0, Math.min(1, (maxT - hotMin) / hotRange))
      : Math.max(0, Math.min(1, (maxT - coldMin) / coldRange));
    return streamColor(isHot, t, isSelected);
  };

  const R_MIN = 7;
  const R_MAX = 22;
  const getRadius = (Q: number | null) => {
    if (!Q || Q <= 0) return R_MIN;
    return R_MIN + Math.round(((Q - qMin) / qRange) * (R_MAX - R_MIN));
  };

  return (
    <>
      {groupBubbles.map(({ gIdx, lat, lon, streams }) => {
        const SPACING = 6;
        const radii = streams.map((s) => getRadius(s.Q));
        const maxR = Math.max(...radii, R_MIN);
        const svgH = maxR * 2 + 4;

        let cx = (radii[0] ?? R_MIN) + 2;
        const circleParts: string[] = [];
        streams.forEach((s, idx) => {
          const r = radii[idx];
          const isSelected =
            s.ci !== undefined
              ? selectedStreams?.[`stream_${s.pIdx}_${s.ci}_${s.si}`] !== false
              : selectedStreams?.[`stream_${s.pIdx}_${s.si}`] !== false;

          const { fill, stroke } = streamColorFor(s.tin, s.tout, isSelected);
          circleParts.push(
            `<circle 
               cx="${cx}" 
               cy="${maxR + 2}" 
               r="${r}" 
               fill="${fill}" 
               stroke="${stroke}" 
               stroke-width="${isSelected ? 1.5 : 1}"
               class="stream-bubble"
               data-pidx="${s.pIdx}"
               ${s.ci !== undefined ? `data-cidx="${s.ci}"` : ''}
               data-si="${s.si}"
               style="cursor:pointer; transition:all 0.2s"
             >
               <title>${s.name} (${isSelected ? 'Selected' : 'Deselected'})</title>
             </circle>`
          );
          cx += r + (radii[idx + 1] ?? r) + SPACING;
        });

        const svgW = cx - SPACING;
        const icon = L.divIcon({
          className: 'stream-circles-icon',
          html: `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${circleParts.join('')}</svg>`,
          iconSize: [svgW, svgH],
          iconAnchor: [svgW / 2, svgH + 10],
        });

        const markerPane =
          renderingMode === 'children' ? 'expandedBubblesPane' : 'streamBubblesPane';

        return (
          <Marker
            key={`circles-${gIdx}-${lat}-${lon}`}
            position={[lat, lon]}
            icon={icon}
            interactive={true}
            draggable={!locked && renderingMode !== 'children'}
            pane={markerPane}
            eventHandlers={{
              click: (e) => {
                const target = e.originalEvent.target as HTMLElement;
                if (target.tagName === 'circle') {
                  const pid = parseInt(target.getAttribute('data-pidx') || '');
                  const cid = target.getAttribute('data-cidx');
                  const sid = parseInt(target.getAttribute('data-si') || '');

                  if (onSelectionToggle) {
                    onSelectionToggle(pid, sid); // Toggle handles it? Wait, my store might need cIdx
                  } else if (onElementDoubleClick) {
                    onElementDoubleClick('stream', pid, cid !== null ? parseInt(cid) : sid);
                  }
                }
              },
              dragend: (e) => {
                if (onDragEnd && renderingMode !== 'children') onDragEnd(e, 'group', String(gIdx));
              },
            }}
          />
        );
      })}
    </>
  );
}

// ─── Connection Lines ─────────────────────────────────────────────────────────
function ConnectionLines({
  processes,
  groups,
  groupNames,
  groupCoordinates,
  subprocessMapExpanded,
  childMapExpanded,
}: {
  processes: ProcessNode[];
  groups: number[][];
  groupNames: string[];
  groupCoordinates: Record<string, GroupCoords>;
  subprocessMapExpanded: Record<number, boolean>;
  childMapExpanded: Record<number, boolean>;
}) {
  const map = useMap();

  const connections = useMemo(() => {
    const result: React.ReactElement[] = [];

    // Determine which nodes are currently visible
    const visibleSubIdxs = new Set<number>();
    const visibleChildIdxs = new Map<number, Set<number>>(); // subIdx -> childIdxs
    const expandedGroups = new Set<number>();

    groups.forEach((subIdxs, gIdx) => {
      if (subprocessMapExpanded[gIdx]) {
        expandedGroups.add(gIdx);
        subIdxs.forEach((si) => {
          if (childMapExpanded[si]) {
            const cSet = new Set<number>();
            (processes[si].children || []).forEach((_, ci) => cSet.add(ci));
            visibleChildIdxs.set(si, cSet);
          } else {
            visibleSubIdxs.add(si);
          }
        });
      }
    });

    // Helper to draw a single connection
    const drawConn = (p: ProcessNode, tgt: ProcessNode) => {
      const srcLat = parseFloat(String(p.lat));
      const srcLon = parseFloat(String(p.lon));
      const tLat = parseFloat(String(tgt.lat));
      const tLon = parseFloat(String(tgt.lon));
      if (isNaN(srcLat) || isNaN(srcLon) || isNaN(tLat) || isNaN(tLon)) return null;

      const srcScale = p.box_scale ? parseFloat(String(p.box_scale)) : 1.0;
      const tgtScale = tgt.box_scale ? parseFloat(String(tgt.box_scale)) : 1.0;

      const p1 = map.latLngToContainerPoint([srcLat, srcLon]);
      const p2 = map.latLngToContainerPoint([tLat, tLon]);
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      if (dist < 40) return null;

      const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angleDeg = angleRad * (180 / Math.PI);
      const cos = Math.abs(Math.cos(angleRad));
      const sin = Math.abs(Math.sin(angleRad));

      const getOffset = (name: string, scale: number) => {
        const w = ((name.length * 6 + 12) * scale) / 2;
        const h = (12 * scale + 8) / 2;
        return Math.min(w / (cos || 0.001), h / (sin || 0.001));
      };

      const startOffset = getOffset(p.name, srcScale) + 2;
      const endOffset = getOffset(tgt.name, tgtScale) + 2;
      if (dist <= startOffset + endOffset + 10) return null;

      const startRatio = startOffset / dist;
      const arrowRatio = (dist - endOffset) / dist;
      const lineEndRatio = (dist - endOffset - 12) / dist;

      const pStart = L.point(p1.x + (p2.x - p1.x) * startRatio, p1.y + (p2.y - p1.y) * startRatio);
      const pArrow = L.point(p1.x + (p2.x - p1.x) * arrowRatio, p1.y + (p2.y - p1.y) * arrowRatio);
      const pLineEnd = L.point(
        p1.x + (p2.x - p1.x) * lineEndRatio,
        p1.y + (p2.y - p1.y) * lineEndRatio
      );

      const lStart = map.containerPointToLatLng(pStart);
      const lArrow = map.containerPointToLatLng(pArrow);
      const lEnd = map.containerPointToLatLng(pLineEnd);

      const icon = L.divIcon({
        className: 'custom-arrow',
        html: `<div style="transform: rotate(${angleDeg}deg); display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;">
          <svg width="20" height="20" viewBox="0 0 20 20" overflow="visible" style="display: block;">
            <path d="M2,4 L18,10 L2,16 L6,10 Z" fill="var(--text-main)" />
          </svg>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [18, 10],
      });

      return (
        <React.Fragment key={`conn-${p.name}-${tgt.name}`}>
          <Polyline
            positions={[lStart, lEnd]}
            pathOptions={{ color: 'var(--text-main)', weight: 3, pane: 'activeMarkerPane' }}
          />
          <Marker position={lArrow} icon={icon} interactive={false} pane="activeMarkerPane" />
        </React.Fragment>
      );
    };

    // 1. Level 0 connections (between Groups)
    if (expandedGroups.size === 0) {
      const groupConns = new Set<string>();
      groups.forEach((subIdxs, gIdx) => {
        subIdxs.forEach((si) => {
          const p = processes[si];
          if (!p.next) return;
          const targets = p.next
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean);
          targets.forEach((tName) => {
            let targetGIdx = -1;
            groups.forEach((tSubIdxs, tgIdx) => {
              if (tSubIdxs.some((tsi) => processes[tsi].name === tName)) {
                targetGIdx = tgIdx;
              }
            });

            if (targetGIdx !== -1 && targetGIdx !== gIdx) {
              const pairId = `${gIdx}-${targetGIdx}`;
              if (!groupConns.has(pairId)) {
                groupConns.add(pairId);
                const srcGC = groupCoordinates[gIdx];
                const tgtGC = groupCoordinates[targetGIdx];
                if (srcGC && tgtGC) {
                  const srcNode = {
                    name: groupNames[gIdx] || `Process ${gIdx + 1}`,
                    lat: srcGC.lat,
                    lon: srcGC.lon,
                    box_scale: srcGC.box_scale || 1.5,
                  } as any;
                  const tgtNode = {
                    name: groupNames[targetGIdx] || `Process ${targetGIdx + 1}`,
                    lat: tgtGC.lat,
                    lon: tgtGC.lon,
                    box_scale: tgtGC.box_scale || 1.5,
                  } as any;
                  const el = drawConn(srcNode, tgtNode);
                  if (el) result.push(el);
                }
              }
            }
          });
        });
      });
    }

    // 2. Connections within Level 1 (expanded groups)
    visibleSubIdxs.forEach((si) => {
      const p = processes[si];
      if (!p.next) return;
      const targets = p.next
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      targets.forEach((tName) => {
        // Find target among visible siblings
        const tgt = Array.from(visibleSubIdxs)
          .map((idx) => processes[idx])
          .find((pp) => pp.name === tName);
        if (tgt) {
          const el = drawConn(p, tgt);
          if (el) result.push(el);
        }
      });
    });

    // 3. Connections within Level 2 (expanded children)
    visibleChildIdxs.forEach((cIdxs, si) => {
      const sub = processes[si];
      cIdxs.forEach((ci) => {
        const p = sub.children![ci];
        if (!p.next) return;
        const targets = p.next
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean);
        targets.forEach((tName) => {
          const tgt = sub.children!.find((pp) => pp.name === tName);
          if (tgt) {
            const el = drawConn(p, tgt);
            if (el) result.push(el);
          }
        });
      });
    });

    return result;
  }, [processes, groups, subprocessMapExpanded, childMapExpanded, map]);

  return <>{connections}</>;
}

export default function MapViewer({
  center,
  zoom,
  locked,
  processes,
  groups,
  groupNames,
  groupCoordinates,
  baseTile,
  onClick: _onClick,
  onMoveEnd,
  subprocessMapExpanded,
  childMapExpanded,
  onProcessesChange,
  onGroupCoordinatesChange,
  onElementDoubleClick,
  height,
  selectedStreams,
  onProcessesSelect,
  onSelectionToggle,
  selectionActive,
  className,
  allowMultiMove = false,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectionTime = useRef(0);

  // Clear selection if we click empty map space (and didn't just finish a box selection)
  const handleMapClick = (lat: number, lon: number) => {
    if (_onClick) _onClick(lat, lon);

    // Tiny 100ms guard for the box selector
    if (Date.now() - lastSelectionTime.current < 100) return;

    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    }
  };

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isFullscreen]);

  const handleDragEnd = (e: L.LeafletEvent, type: 'group' | 'sub' | 'child', id: string) => {
    const marker = e.target as L.Marker;
    const { lat, lng } = marker.getLatLng();

    // 1. Calculate delta if part of a multi-selection
    const markerKey = `${type}-${id}`;
    let dLat = 0;
    let dLon = 0;

    if (allowMultiMove && selectedIds.has(markerKey)) {
      // Find original position to calc delta
      let oldLat = 0;
      let oldLon = 0;
      if (type === 'group') {
        oldLat = parseFloat(String(groupCoordinates[id]?.lat || 0));
        oldLon = parseFloat(String(groupCoordinates[id]?.lon || 0));
      } else if (type === 'sub') {
        oldLat = parseFloat(String(processes[parseInt(id)]?.lat || 0));
        oldLon = parseFloat(String(processes[parseInt(id)]?.lon || 0));
      } else if (type === 'child') {
        const [si, ci] = id.split('-').map(Number);
        oldLat = parseFloat(String(processes[si]?.children?.[ci]?.lat || 0));
        oldLon = parseFloat(String(processes[si]?.children?.[ci]?.lon || 0));
      }
      dLat = lat - oldLat;
      dLon = lng - oldLon;
    }

    // 2. Prepare updates
    let nextGroupCoords = { ...groupCoordinates };
    let nextProcesses = [...processes];
    let changedGroup = false;
    let changedProc = false;

    // Apply to selected set or just this marker
    const targets =
      allowMultiMove && selectedIds.has(markerKey) ? Array.from(selectedIds) : [markerKey];

    targets.forEach((key) => {
      const [tType, tId] = key.split('-') as ['group' | 'sub' | 'child', string];
      let tLat = lat;
      let tLon = lng;

      if (key !== markerKey) {
        // Apply delta to others
        if (tType === 'group') {
          tLat = parseFloat(String(groupCoordinates[tId]?.lat || 0)) + dLat;
          tLon = parseFloat(String(groupCoordinates[tId]?.lon || 0)) + dLon;
        } else if (tType === 'sub') {
          tLat = parseFloat(String(processes[parseInt(tId)]?.lat || 0)) + dLat;
          tLon = parseFloat(String(processes[parseInt(tId)]?.lon || 0)) + dLon;
        } else if (tType === 'child') {
          const [si, ci] = tId.split('-').map(Number);
          tLat = parseFloat(String(processes[si]?.children?.[ci]?.lat || 0)) + dLat;
          tLon = parseFloat(String(processes[si]?.children?.[ci]?.lon || 0)) + dLon;
        }
      }

      if (tType === 'group') {
        nextGroupCoords[tId] = {
          ...(nextGroupCoords[tId] || {}),
          lat: tLat.toString(),
          lon: tLon.toString(),
        };
        changedGroup = true;
      } else if (tType === 'sub') {
        const sIdx = parseInt(tId);
        nextProcesses[sIdx] = {
          ...nextProcesses[sIdx],
          lat: tLat.toString(),
          lon: tLon.toString(),
        };
        changedProc = true;
      } else if (tType === 'child') {
        const [si, ci] = tId.split('-').map(Number);
        nextProcesses[si] = { ...nextProcesses[si] };
        nextProcesses[si].children = [...(nextProcesses[si].children || [])];
        nextProcesses[si].children[ci] = {
          ...nextProcesses[si].children[ci],
          lat: tLat.toString(),
          lon: tLon.toString(),
        };
        changedProc = true;
      }
    });

    if (changedGroup && onGroupCoordinatesChange) onGroupCoordinatesChange(nextGroupCoords);
    if (changedProc && onProcessesChange) onProcessesChange(nextProcesses);
  };

  const tileUrl = TILE_URLS[baseTile] || TILE_URLS.OpenStreetMap;
  const isCanvasActive = useMemo(
    () =>
      Object.values(childMapExpanded).some(Boolean) ||
      Object.values(subprocessMapExpanded).some(Boolean),
    [childMapExpanded, subprocessMapExpanded]
  );

  return (
    <div
      className={`map-viewer-container ${className || ''} ${isFullscreen ? 'fullscreen' : ''} ${selectionActive ? 'pa-selection-active' : ''}`}
      style={
        !isFullscreen
          ? { height: height || '850px', flex: 'none', position: 'relative' }
          : { position: 'fixed', inset: 0, zIndex: 9999 }
      }
    >
      <div
        className="map-viewer-controls"
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: 8 }}
      >
        <button
          className="pa-btn"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          style={{ padding: '6px 10px' }}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={!locked}
        dragging={!locked}
        scrollWheelZoom={!locked}
        doubleClickZoom={!locked}
        boxZoom={!locked}
        keyboard={!locked}
        zoomSnap={0.25}
        zoomDelta={0.25}
      >
        <TileLayer url={tileUrl} />
        <MapController center={center} zoom={zoom} locked={locked} />
        <MapClickHandler onClick={handleMapClick} />
        <MapFullscreenResizer active={isFullscreen} />
        <MapMountFitter center={center} zoom={zoom} />

        {/* 1. Base Site Bubbles — Hidden by canvas if active */}
        <Pane name="streamBubblesPane" style={{ zIndex: 450 }}>
          <StreamCirclesOverlay
            processes={processes}
            groups={groups}
            groupNames={groupNames}
            groupCoordinates={groupCoordinates}
            selectedStreams={selectedStreams}
            onSelectionToggle={onSelectionToggle}
            onElementDoubleClick={onElementDoubleClick}
            locked={locked}
            onDragEnd={handleDragEnd}
          />
        </Pane>

        {/* 2. Focused Workshop Background — Above site markers, below expanded content */}
        <Pane name="canvasPane" style={{ zIndex: 650 }}>
          <SubprocessCanvasOverlay
            active={isCanvasActive}
            deps={
              isCanvasActive ? JSON.stringify({ subprocessMapExpanded, childMapExpanded }) : null
            }
          />
        </Pane>

        {/* 3. Main Site Markers — On top of canvas */}
        <Pane name="activeMarkerPane" style={{ zIndex: 660 }}>
          {groups.map((subIdxs, gIdx) => {
            const gCoords = groupCoordinates[gIdx];
            const showSubs = subprocessMapExpanded[gIdx];

            if (!showSubs) {
              const lat = parseFloat(String(gCoords?.lat ?? ''));
              const lon = parseFloat(String(gCoords?.lon ?? ''));
              if (isNaN(lat) || isNaN(lon)) return null;

              const gScale = gCoords?.box_scale ? parseFloat(String(gCoords.box_scale)) : 1.5;
              const isAnySelected =
                selectedStreams === undefined ||
                subIdxs.some((si) => {
                  const p = processes[si];
                  // If it has no streams, count as "selected" so it's opaque during placement
                  if ((p.streams || []).length === 0) return true;
                  return (p.streams || []).some(
                    (_, sidx) => selectedStreams?.[`stream_${si}_${sidx}`] !== false
                  );
                });

              return (
                <Marker
                  key={`group-${gIdx}`}
                  position={[lat, lon]}
                  draggable={true}
                  pane="activeMarkerPane"
                  eventHandlers={{
                    click: () => {
                      if (onProcessesSelect) onProcessesSelect(subIdxs, !isAnySelected);
                    },
                    dragend: (e) => handleDragEnd(e, 'group', String(gIdx)),
                  }}
                  icon={createDivIcon(
                    '',
                    groupNames[gIdx] || `Process ${gIdx + 1}`,
                    '',
                    gScale,
                    isAnySelected,
                    allowMultiMove && selectedIds.has(`group-${gIdx}`),
                    'group',
                    String(gIdx)
                  )}
                />
              );
            }
            return null;
          })}

          <ConnectionLines
            processes={processes}
            groups={groups}
            groupNames={groupNames}
            groupCoordinates={groupCoordinates}
            subprocessMapExpanded={subprocessMapExpanded}
            childMapExpanded={childMapExpanded}
          />
        </Pane>

        {/* 4. Hierarchical Expanded Content — Above site markers */}
        <Pane name="expandedContentPane" style={{ zIndex: 700 }}>
          {/* Subprocesses (if group expanded) */}
          {groups.map((subIdxs, gIdx) => {
            if (!subprocessMapExpanded[gIdx]) return null;
            return subIdxs.map((si) => {
              const p = processes[si];
              if (!p) return null;
              const lat = parseFloat(String(p.lat));
              const lon = parseFloat(String(p.lon));
              if (isNaN(lat) || isNaN(lon)) return null;

              const isSubSelected =
                selectedStreams === undefined ||
                (p.streams || []).length === 0 ||
                (p.streams || []).some(
                  (_, sidx) => selectedStreams?.[`stream_${si}_${sidx}`] !== false
                );

              return (
                <Marker
                  key={`sub-${si}`}
                  position={[lat, lon]}
                  draggable={true}
                  pane="expandedContentPane"
                  eventHandlers={{
                    click: () => {
                      if (onProcessesSelect) onProcessesSelect([si], !isSubSelected);
                    },
                    dragend: (e) => handleDragEnd(e, 'sub', String(si)),
                  }}
                  icon={createDivIcon(
                    '',
                    p.name,
                    '',
                    p.box_scale ? parseFloat(String(p.box_scale)) : 1.2,
                    isSubSelected,
                    allowMultiMove && selectedIds.has(`sub-${si}`),
                    'sub',
                    String(si)
                  )}
                />
              );
            });
          })}

          {/* Children (if subprocess expanded) */}
          {processes.map((p, si) => {
            if (!childMapExpanded[si]) return null;
            return (p.children || []).map((child, ci) => {
              const lat = parseFloat(String(child.lat));
              const lon = parseFloat(String(child.lon));
              if (isNaN(lat) || isNaN(lon)) return null;

              const isChildSelected =
                selectedStreams === undefined ||
                (child.streams || []).length === 0 ||
                (child.streams || []).some(
                  (_, sidx) => selectedStreams?.[`stream_${si}_${ci}_${sidx}`] !== false
                );

              return (
                <Marker
                  key={`child-${si}-${ci}`}
                  position={[lat, lon]}
                  draggable={true}
                  pane="expandedContentPane"
                  eventHandlers={{
                    dragend: (e) => handleDragEnd(e, 'child', `${si}-${ci}`),
                  }}
                  icon={createDivIcon(
                    '',
                    child.name,
                    '',
                    child.box_scale ? parseFloat(String(child.box_scale)) : 0.9,
                    isChildSelected,
                    allowMultiMove && selectedIds.has(`child-${si}-${ci}`),
                    'child',
                    `${si}-${ci}`
                  )}
                />
              );
            });
          })}
        </Pane>

        {/* 5. Hierarchical Expanded Bubbles — Top-most interaction */}
        <Pane name="expandedBubblesPane" style={{ zIndex: 750 }}>
          <StreamCirclesOverlay
            processes={processes}
            groups={[]}
            groupNames={[]}
            groupCoordinates={{}}
            selectedStreams={selectedStreams}
            onSelectionToggle={onSelectionToggle}
            onElementDoubleClick={onElementDoubleClick}
            locked={locked}
            onDragEnd={handleDragEnd}
            renderingMode="children"
            childMapExpanded={childMapExpanded}
          />
        </Pane>

        <BoxSelector
          active={locked} // Always active when map is locked
          onSelect={(bounds) => {
            lastSelectionTime.current = Date.now();
            const idxsInBox: number[] = [];
            const newSelected = new Set<string>();

            // 1. Check groups
            groups.forEach((subIdxs, gIdx) => {
              const gc = groupCoordinates[gIdx];
              if (gc && gc.lat && gc.lon) {
                const lat = parseFloat(String(gc.lat));
                const lon = parseFloat(String(gc.lon));
                if (bounds.contains([lat, lon])) {
                  idxsInBox.push(...subIdxs);
                  if (allowMultiMove) newSelected.add(`group-${gIdx}`);
                }
              }
            });

            // 2. Check independent processes
            processes.forEach((p, pi) => {
              if (p.lat && p.lon) {
                const lat = parseFloat(String(p.lat));
                const lon = parseFloat(String(p.lon));
                if (bounds.contains([lat, lon])) {
                  idxsInBox.push(pi);
                  if (allowMultiMove) newSelected.add(`sub-${pi}`);
                }
              }
            });

            if (allowMultiMove) setSelectedIds(newSelected);

            // 3. Smart Toggle for Analysis Streams
            if (onProcessesSelect && idxsInBox.length > 0) {
              const uniqueIdxs = Array.from(new Set(idxsInBox));

              const allInBoxSelected = uniqueIdxs.every((pi) => {
                const p = processes[pi];
                return (p.streams || []).every(
                  (_: any, si: number) => selectedStreams?.[`stream_${pi}_${si}`] !== false
                );
              });

              onProcessesSelect(uniqueIdxs, !allInBoxSelected);
            }
          }}
        />

        {onMoveEnd && <MapMoveHandler onMoveEnd={onMoveEnd} locked={locked} />}
        <MapMountFitter center={center} zoom={zoom} />
        <MapFullscreenResizer active={isFullscreen} />
      </MapContainer>
    </div>
  );
}
