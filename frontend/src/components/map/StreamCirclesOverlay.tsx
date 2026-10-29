import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { ProcessNode } from '../../types/process';
import { extractStreamInfo } from '../../utils/streamInfo';
import { streamColor } from './mapHelpers';
import type { GroupCoords } from './types';

export interface StreamCirclesOverlayProps {
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

export function StreamCirclesOverlay({
  processes,
  groups,
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
