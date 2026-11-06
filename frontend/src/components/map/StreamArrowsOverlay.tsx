import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import i18n from '../../i18n';
import { extractStreamInfo, streamSvgText } from '../../utils/streamInfo';
import { streamColor } from './mapHelpers';

export function StreamArrowsOverlay({
  processes,
  groups,
  subprocessMapExpanded,
  childMapExpanded,
  selectedStreams,
  onSelectionToggle,
  onElementDoubleClick,
}: any) {
  interface StreamBubble {
    name: string;
    subprocess: string;
    tin: number | null;
    tout: number | null;
    mdot: number | null;
    cp: number | null;
    Q: number | null;
    pIdx: number;
    ci?: number;
    si: number;
  }
  interface GroupBubbles {
    lat: number;
    lon: number;
    streams: StreamBubble[];
  }

  const arrowGroups = React.useMemo<GroupBubbles[]>(() => {
    const result: GroupBubbles[] = [];

    // 1. Subprocesses
    groups.forEach((subIdxs: number[], gIdx: number) => {
      if (subprocessMapExpanded[gIdx]) {
        subIdxs.forEach((si: number) => {
          const p = processes[si];
          if (!p) return;
          const lat = parseFloat(String(p.lat));
          const lon = parseFloat(String(p.lon));
          if (isNaN(lat) || isNaN(lon)) return;

          const streams: StreamBubble[] = [];
          (p.streams || []).forEach((s: any, sidx: number) => {
            if (s.type && s.type.toLowerCase() === 'product') return;
            const info = extractStreamInfo(s);
            streams.push({
              name: s.name || 'Stream',
              subprocess: p.name,
              tin: info.tin,
              tout: info.tout,
              mdot: info.mdot,
              cp: info.cp,
              Q: info.Q,
              pIdx: si,
              si: sidx,
            });
          });
          if (streams.length > 0) result.push({ lat, lon, streams });
        });
      }
    });

    // 2. Children
    processes.forEach((sub: any, si: number) => {
      if (childMapExpanded[si]) {
        (sub.children || []).forEach((child: any, ci: number) => {
          const lat = parseFloat(String(child.lat));
          const lon = parseFloat(String(child.lon));
          if (isNaN(lat) || isNaN(lon)) return;

          const streams: StreamBubble[] = [];
          (child.streams || []).forEach((s: any, sidx: number) => {
            if (s.type && s.type.toLowerCase() === 'product') return;
            const info = extractStreamInfo(s);
            streams.push({
              name: s.name || 'Stream',
              subprocess: child.name,
              tin: info.tin,
              tout: info.tout,
              mdot: info.mdot,
              cp: info.cp,
              Q: info.Q,
              pIdx: si,
              ci: ci,
              si: sidx,
            });
          });
          if (streams.length > 0) result.push({ lat, lon, streams });
        });
      }
    });

    return result;
  }, [processes, groups, subprocessMapExpanded, childMapExpanded]);

  const { hotMin, hotRange, coldMin, coldRange } = React.useMemo(() => {
    const qs = arrowGroups.flatMap((gb) => gb.streams.map((s) => s.Q ?? 0)).filter((q) => q > 0);
    const mn = qs.length ? Math.min(...qs) : 0;
    const mx = qs.length ? Math.max(...qs) : 1;

    const hotTemps: number[] = [];
    const coldTemps: number[] = [];
    arrowGroups.forEach((gb) => {
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
      qMin: mn,
      qRange: mx === mn ? 1 : mx - mn,
      hotMin: hMin,
      hotRange: hMax === hMin ? 1 : hMax - hMin,
      coldMin: cMin,
      coldRange: cMax === cMin ? 1 : cMax - cMin,
    };
  }, [arrowGroups]);

  const streamColorForTemp = (temp: number | null, isHotStream: boolean, isSelected: boolean) => {
    if (temp == null) return { fill: 'rgba(150,150,150,0.5)', stroke: '#999' };
    const t = isHotStream
      ? Math.max(0, Math.min(1, (temp - hotMin) / hotRange))
      : Math.max(0, Math.min(1, (temp - coldMin) / coldRange));
    // reuse streamColor from MapViewer
    return streamColor(isHotStream, t, isSelected);
  };

  return (
    <>
      {arrowGroups.map(({ lat, lon, streams }, idx) => {
        const N = streams.length;
        const streamSpacing = 120; // Increased spacing to prevent overlap
        const svgW = Math.max(250, N * streamSpacing + 60);
        const svgH = 300; // Taller to allow 4 lines of text

        const startX = svgW / 2 - ((N - 1) * streamSpacing) / 2;

        const arrowParts: string[] = [];
        streams.forEach((s, sidx) => {
          const cx = startX + sidx * streamSpacing;
          const isSelected =
            s.ci !== undefined
              ? selectedStreams?.[`stream_${s.pIdx}_${s.ci}_${s.si}`] !== false
              : selectedStreams?.[`stream_${s.pIdx}_${s.si}`] !== false;

          const isHotStream = (s.tin || 0) > (s.tout || 0);
          const inColor = streamColorForTemp(s.tin, isHotStream, isSelected);
          const outColor = streamColorForTemp(s.tout, isHotStream, isSelected);

          const match = s.name.match(/\d+/);
          const num = match ? match[0] : s.si + 1;
          const streamTypeStr = i18n.t(isHotStream ? 'map.heat_source' : 'map.heat_sink');
          const tColor = isHotStream ? '#c0392b' : '#2471a3';
          const text = streamSvgText(s);
          const strokeWidth = isSelected ? 3 : 2;
          const opacity = isSelected ? 1 : 0.5;
          const textStyle = `font-size="11" fill="${tColor}" paint-order="stroke" style="stroke: var(--surface, #fff)" stroke-width="3" stroke-linejoin="round" opacity="${opacity}"`;

          // Labels stack away from their arrow: below it from its end, or above
          // it ending at its start, 15 px a line (room for the subscripts).
          const LH = 15;
          const label = (lines: string[], y: number, below: boolean) => {
            if (lines.length === 0) return '';
            const first = below ? y + 12 : y - 6 - (lines.length - 1) * LH;
            const spans = lines
              .map(
                (l, i) =>
                  `<tspan x="${cx}" ${i === 0 ? `y="${first}" font-weight="700"` : `dy="${LH}"`}>${l}</tspan>`
              )
              .join('');
            return `<text text-anchor="middle" ${textStyle}>${spans}</text>`;
          };
          const feed = [`${streamTypeStr} ${num}`, text.tin, text.mdot, text.cp].filter(Boolean);
          const product = [text.tout].filter(Boolean);
          const arrow = (y1: number, y2: number, color: string) => {
            const dir = y2 > y1 ? 1 : -1;
            return `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2 - dir * 8}" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" />
              <polygon points="${cx - 5},${y2 - dir * 10} ${cx + 5},${y2 - dir * 10} ${cx},${y2}" fill="${color}" opacity="${opacity}" />`;
          };

          // Hot streams run upwards through the box, cold ones downwards.
          const inArrow = isHotStream
            ? arrow(245, 180, inColor.stroke) + label(feed, 245, true)
            : arrow(55, 120, inColor.stroke) + label(feed, 55, false);
          const outArrow = isHotStream
            ? arrow(120, 55, outColor.stroke) + label(product, 55, false)
            : arrow(180, 245, outColor.stroke) + label(product, 245, true);

          arrowParts.push(
            `<g class="stream-arrow" data-pidx="${s.pIdx}" ${s.ci !== undefined ? `data-cidx="${s.ci}"` : ''} data-si="${s.si}" style="cursor:pointer; transition:all 0.2s">
               <title>${s.name}: ${s.tin ?? '–'} → ${s.tout ?? '–'} °C</title>
               ${inArrow}
               ${outArrow}
             </g>`
          );
        });

        const icon = L.divIcon({
          className: 'stream-arrows-icon',
          html: `<style>.stream-arrows-icon { background: none; border: none; pointer-events: none !important; } .stream-arrows-icon .stream-arrow { pointer-events: auto !important; }</style><svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="overflow:visible">${arrowParts.join('')}</svg>`,
          iconSize: [svgW, svgH],
          iconAnchor: [svgW / 2, svgH / 2],
        });

        return (
          <Marker
            key={`arrows-${idx}-${lat}-${lon}`}
            position={[lat, lon]}
            icon={icon}
            interactive={true}
            draggable={false}
            pane="expandedBubblesPane"
            eventHandlers={{
              click: (e) => {
                const target = e.originalEvent.target as HTMLElement;
                const g = target.closest('g.stream-arrow');
                if (g) {
                  const pid = parseInt(g.getAttribute('data-pidx') || '');
                  const cid = g.getAttribute('data-cidx');
                  const sid = parseInt(g.getAttribute('data-si') || '');
                  if (onSelectionToggle) {
                    onSelectionToggle(pid, sid);
                  } else if (onElementDoubleClick) {
                    onElementDoubleClick('stream', pid, cid !== null ? parseInt(cid) : sid);
                  }
                }
              },
            }}
          />
        );
      })}
    </>
  );
}
