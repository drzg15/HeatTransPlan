import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { extractStreamInfo } from '../../utils/streamInfo';
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
          const streamTypeStr = isHotStream ? 'Source' : 'Sink';

          const tColor = isHotStream ? '#e74c3c' : '#3498db';

          const tinText = s.tin !== null && s.tin !== undefined ? `Tin=${s.tin}°C` : '';
          const toutText = s.tout !== null && s.tout !== undefined ? `Tout=${s.tout}°C` : '';
          const extraProps = [];
          if (s.mdot !== null && s.mdot !== undefined) extraProps.push(`m=${s.mdot}`);
          if (s.cp !== null && s.cp !== undefined) extraProps.push(`cp=${s.cp}`);
          const extraText = extraProps.length > 0 ? extraProps.join(', ') : '';

          const feedSVG = `
            <tspan x="${cx}" dy="-6">Heat</tspan>
            <tspan x="${cx}" dy="12">${streamTypeStr} ${num}</tspan>
            ${tinText ? `<tspan x="${cx}" dy="12">${tinText}</tspan>` : ''}
            ${extraText ? `<tspan x="${cx}" dy="12">${extraText}</tspan>` : ''}
          `;

          const prodSVG = toutText ? `<tspan x="${cx}" dy="0">${toutText}</tspan>` : '';

          const strokeWidth = isSelected ? 3 : 2;
          const opacity = isSelected ? 1 : 0.5;

          const textStyle = `font-size="11" font-weight="bold" fill="${tColor}" paint-order="stroke" stroke="white" stroke-width="3" opacity="${opacity}"`;

          // Stagger Y positions for adjacent streams
          const staggerOffset = sidx % 2 === 0 ? 0 : 15;

          let inArrow = '';
          let outArrow = '';

          if (isHotStream) {
            // Hot stream: UPWARDS
            // Feed (inColor) enters from bottom (y=245 to 180)
            const inTextY = 260 + staggerOffset;
            inArrow = `
              <text x="${cx}" y="${inTextY}" text-anchor="middle" ${textStyle}>${feedSVG}</text>
              <line x1="${cx}" y1="245" x2="${cx}" y2="180" stroke="${inColor.stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />
              <polygon points="${cx - 5},190 ${cx + 5},190 ${cx},180" fill="${inColor.stroke}" opacity="${opacity}" />
            `;
            // Product (outColor) leaves from top (y=120 to 55)
            const outTextY = 45 - staggerOffset;
            outArrow = `
              ${prodSVG ? `<text x="${cx}" y="${outTextY}" text-anchor="middle" ${textStyle}>${prodSVG}</text>` : ''}
              <line x1="${cx}" y1="120" x2="${cx}" y2="55" stroke="${outColor.stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />
              <polygon points="${cx - 5},65 ${cx + 5},65 ${cx},55" fill="${outColor.stroke}" opacity="${opacity}" />
            `;
          } else {
            // Cold stream: DOWNWARDS
            // Feed (inColor) enters from top (y=55 to 120)
            const inTextY = 20 - staggerOffset;
            inArrow = `
              <text x="${cx}" y="${inTextY}" text-anchor="middle" ${textStyle}>${feedSVG}</text>
              <line x1="${cx}" y1="55" x2="${cx}" y2="120" stroke="${inColor.stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />
              <polygon points="${cx - 5},110 ${cx + 5},110 ${cx},120" fill="${inColor.stroke}" opacity="${opacity}" />
            `;
            // Product (outColor) leaves from bottom (y=180 to 245)
            const outTextY = 260 + staggerOffset;
            outArrow = `
              ${prodSVG ? `<text x="${cx}" y="${outTextY}" text-anchor="middle" ${textStyle}>${prodSVG}</text>` : ''}
              <line x1="${cx}" y1="180" x2="${cx}" y2="245" stroke="${outColor.stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />
              <polygon points="${cx - 5},235 ${cx + 5},235 ${cx},245" fill="${outColor.stroke}" opacity="${opacity}" />
            `;
          }

          arrowParts.push(
            `<g class="stream-arrow" data-pidx="${s.pIdx}" ${s.ci !== undefined ? `data-cidx="${s.ci}"` : ''} data-si="${s.si}" style="cursor:pointer; transition:all 0.2s">
               <title>${s.name} (${isSelected ? 'Selected' : 'Deselected'}) - In: ${s.tin}°C, Out: ${s.tout}°C</title>
               ${inArrow}
               ${outArrow}
             </g>`
          );
        });

        const icon = L.divIcon({
          className: 'stream-arrows-icon',
          html: `<style>.stream-arrows-icon { background: none; border: none; pointer-events: none !important; } .stream-arrows-icon .stream-arrow { pointer-events: auto !important; }</style><svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${arrowParts.join('')}</svg>`,
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
