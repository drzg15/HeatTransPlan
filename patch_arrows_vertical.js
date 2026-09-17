const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/map/MapViewer.tsx', 'utf8');

// We need to replace the body of StreamArrowsOverlay again.
const startStr = 'function StreamArrowsOverlay({';
const endStr = '    </>\n  );\n}';

const startIndex = content.indexOf(startStr);
if (startIndex === -1) {
  console.error("Could not find StreamArrowsOverlay");
  process.exit(1);
}
const endIndex = content.indexOf(endStr, startIndex) + endStr.length;

const newOverlay = `function StreamArrowsOverlay({
  processes,
  groups,
  subprocessMapExpanded,
  childMapExpanded,
  selectedStreams,
  onSelectionToggle,
  onElementDoubleClick,
  locked = false
}: any) {
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
    lat: number;
    lon: number;
    streams: StreamBubble[];
  }

  const arrowGroups = React.useMemo<GroupBubbles[]>(() => {
    const result: GroupBubbles[] = [];
    
    // 1. Subprocesses
    groups.forEach((subIdxs, gIdx) => {
      if (subprocessMapExpanded[gIdx]) {
        subIdxs.forEach((si) => {
          const p = processes[si];
          if (!p) return;
          const lat = parseFloat(String(p.lat));
          const lon = parseFloat(String(p.lon));
          if (isNaN(lat) || isNaN(lon)) return;

          const streams: StreamBubble[] = [];
          (p.streams || []).forEach((s: any, sidx: number) => {
            const info = extractStreamInfo(s);
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
            const info = extractStreamInfo(s);
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
          if (streams.length > 0) result.push({ lat, lon, streams });
        });
      }
    });

    return result;
  }, [processes, groups, subprocessMapExpanded, childMapExpanded]);

  const { qMin, qRange, hotMin, hotRange, coldMin, coldRange } = React.useMemo(() => {
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
      qMin: mn, qRange: mx === mn ? 1 : mx - mn,
      hotMin: hMin, hotRange: hMax === hMin ? 1 : hMax - hMin,
      coldMin: cMin, coldRange: cMax === cMin ? 1 : cMax - cMin,
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
        const streamSpacing = 80;
        const svgW = Math.max(200, N * streamSpacing + 40);
        const svgH = 200; // Fixed height, centered on process node
        
        const startX = (svgW / 2) - ((N - 1) * streamSpacing / 2);

        const arrowParts: string[] = [];
        streams.forEach((s, sidx) => {
          const cx = startX + sidx * streamSpacing;
          const isSelected =
            s.ci !== undefined
              ? selectedStreams?.[\`stream_\${s.pIdx}_\${s.ci}_\${s.si}\`] !== false
              : selectedStreams?.[\`stream_\${s.pIdx}_\${s.si}\`] !== false;

          const isHotStream = (s.tin || 0) > (s.tout || 0);
          const inColor = streamColorForTemp(s.tin, isHotStream, isSelected);
          const outColor = streamColorForTemp(s.tout, isHotStream, isSelected);

          const strokeWidth = isSelected ? 3 : 2;
          const opacity = isSelected ? 1 : 0.5;
          
          const textStyle = \`font-size="11" font-weight="bold" fill="#333" paint-order="stroke" stroke="white" stroke-width="3" opacity="\${opacity}"\`;

          // IN arrow (Top, pointing DOWN)
          const inArrow = \`
            <text x="\${cx}" y="20" text-anchor="middle" \${textStyle}>\${s.name} (Tin=\${s.tin}°C)</text>
            <line x1="\${cx}" y1="30" x2="\${cx}" y2="70" stroke="\${inColor.stroke}" stroke-width="\${strokeWidth}" opacity="\${opacity}" />
            <polygon points="\${cx-5},65 \${cx+5},65 \${cx},75" fill="\${inColor.stroke}" opacity="\${opacity}" />
          \`;

          // OUT arrow (Bottom, pointing DOWN)
          const outArrow = \`
            <line x1="\${cx}" y1="125" x2="\${cx}" y2="165" stroke="\${outColor.stroke}" stroke-width="\${strokeWidth}" opacity="\${opacity}" />
            <polygon points="\${cx-5},160 \${cx+5},160 \${cx},170" fill="\${outColor.stroke}" opacity="\${opacity}" />
            <text x="\${cx}" y="185" text-anchor="middle" \${textStyle}>Tout=\${s.tout}°C</text>
          \`;

          arrowParts.push(
            \`<g class="stream-arrow" data-pidx="\${s.pIdx}" \${s.ci !== undefined ? \`data-cidx="\${s.ci}"\` : ''} data-si="\${s.si}" style="cursor:pointer; transition:all 0.2s">
               <title>\${s.name} (\${isSelected ? 'Selected' : 'Deselected'}) - In: \${s.tin}°C, Out: \${s.tout}°C</title>
               \${inArrow}
               \${outArrow}
             </g>\`
          );
        });

        const icon = L.divIcon({
          className: 'stream-arrows-icon',
          html: \`<svg width="\${svgW}" height="\${svgH}" viewBox="0 0 \${svgW} \${svgH}">\${arrowParts.join('')}</svg>\`,
          iconSize: [svgW, svgH],
          iconAnchor: [svgW / 2, svgH / 2], // Center exactly on the process node!
        });

        return (
          <Marker
            key={\`arrows-\${idx}-\${lat}-\${lon}\`}
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
}`;

const finalContent = content.slice(0, startIndex) + newOverlay + content.slice(endIndex);
fs.writeFileSync('frontend/src/components/map/MapViewer.tsx', finalContent);
console.log("Patched MapViewer.tsx");
