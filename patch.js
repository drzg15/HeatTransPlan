const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/map/MapViewer.tsx', 'utf8');

const overlayComponent = `
function StreamArrowsOverlay({
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

  const R_MIN = 7;
  const R_MAX = 22;
  const getRadius = (Q: number | null) => {
    if (!Q || Q <= 0) return R_MIN;
    return R_MIN + Math.round(((Q - qMin) / qRange) * (R_MAX - R_MIN));
  };

  return (
    <>
      {arrowGroups.map(({ lat, lon, streams }, idx) => {
        const SPACING = 12;
        const radii = streams.map((s) => getRadius(s.Q));
        const maxR = Math.max(...radii, R_MIN);
        const svgH = maxR * 2.5 + 10;

        let cx = (radii[0] ?? R_MIN) * 1.5 + 4;
        const arrowParts: string[] = [];
        streams.forEach((s, sidx) => {
          const r = radii[sidx];
          const isSelected =
            s.ci !== undefined
              ? selectedStreams?.[\`stream_\${s.pIdx}_\${s.ci}_\${s.si}\`] !== false
              : selectedStreams?.[\`stream_\${s.pIdx}_\${s.si}\`] !== false;

          const isHotStream = (s.tin || 0) > (s.tout || 0);
          const inColor = streamColorForTemp(s.tin, isHotStream, isSelected);
          const outColor = streamColorForTemp(s.tout, isHotStream, isSelected);

          const aw = Math.max(4, r * 0.6);
          const stemW = Math.max(2, aw * 0.5);
          const ah = Math.max(20, r * 2.2);
          const headH = Math.min(10, ah * 0.4);

          const inX = cx - aw - 1;
          const dIn = \`M \${inX - stemW},0 L \${inX + stemW},0 L \${inX + stemW},\${ah - headH} L \${inX + aw},\${ah - headH} L \${inX},\${ah} L \${inX - aw},\${ah - headH} L \${inX - stemW},\${ah - headH} Z\`;

          const outX = cx + aw + 1;
          const dOut = \`M \${outX},0 L \${outX + aw},\${headH} L \${outX + stemW},\${headH} L \${outX + stemW},\${ah} L \${outX - stemW},\${ah} L \${outX - stemW},\${headH} L \${outX - aw},\${headH} Z\`;

          arrowParts.push(
            \`<g class="stream-arrow" data-pidx="\${s.pIdx}" \${s.ci !== undefined ? \`data-cidx="\${s.ci}"\` : ''} data-si="\${s.si}" style="cursor:pointer; transition:all 0.2s">
               <title>\${s.name} (\${isSelected ? 'Selected' : 'Deselected'}) - In: \${s.tin}°C, Out: \${s.tout}°C</title>
               <path d="\${dIn}" fill="\${inColor.fill}" stroke="\${inColor.stroke}" stroke-width="\${isSelected ? 1.5 : 1}" />
               <path d="\${dOut}" fill="\${outColor.fill}" stroke="\${outColor.stroke}" stroke-width="\${isSelected ? 1.5 : 1}" />
             </g>\`
          );
          
          const nextR = radii[sidx + 1] ?? r;
          cx += (r * 1.5) + (nextR * 1.5) + SPACING;
        });

        const svgW = cx - SPACING;
        const icon = L.divIcon({
          className: 'stream-arrows-icon',
          html: \`<svg width="\${svgW}" height="\${svgH}" viewBox="0 0 \${svgW} \${svgH}">\${arrowParts.join('')}</svg>\`,
          iconSize: [svgW, svgH],
          iconAnchor: [svgW / 2, svgH + 10],
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
}
`;

// Insert it right after StreamCirclesOverlay finishes
const insertionPoint = content.indexOf('function ConnectionLines(');
const newContent = content.slice(0, insertionPoint) + overlayComponent + '\n' + content.slice(insertionPoint);

// Now update the Pane rendering
const startTarget = '<Pane name="expandedBubblesPane" style={{ zIndex: 750 }}>';
const endTarget = '</Pane>';
const expandedBubblesStart = newContent.indexOf(startTarget);
const expandedBubblesEnd = newContent.indexOf(endTarget, expandedBubblesStart) + endTarget.length;

const replacement = `<Pane name="expandedBubblesPane" style={{ zIndex: 750 }}>
          <StreamArrowsOverlay
            processes={processes}
            groups={groups}
            subprocessMapExpanded={subprocessMapExpanded}
            childMapExpanded={childMapExpanded}
            selectedStreams={selectedStreams}
            onSelectionToggle={onSelectionToggle}
            onElementDoubleClick={onElementDoubleClick}
            locked={locked}
          />
        </Pane>`;

const finalContent = newContent.slice(0, expandedBubblesStart) + replacement + newContent.slice(expandedBubblesEnd);

fs.writeFileSync('frontend/src/components/map/MapViewer.tsx', finalContent);
console.log("Patched MapViewer.tsx");
