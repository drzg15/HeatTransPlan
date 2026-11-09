import React, { useEffect, useState } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ProcessNode } from '../../types/process';
import i18n from '../../i18n';
import { extractStreamInfo, streamSvgText, svgTextWidth } from '../../utils/streamInfo';
import type { GroupCoords } from './types';
import { boxHalf, labelSpot, routeConnection } from './connectionRoute';

const LINE = '#64748b';
// Product tag: line height (room for subscripts) and inner padding.
const LH = 15;
const PAD = 8;

type Pt = { x: number; y: number };

export function ConnectionLines({
  processes,
  groups,
  groupNames,
  groupCoordinates,
  subprocessMapExpanded,
  childMapExpanded,
  onElementDoubleClick,
}: {
  processes: ProcessNode[];
  groups: number[][];
  groupNames: string[];
  groupCoordinates: Record<string, GroupCoords>;
  subprocessMapExpanded: Record<number, boolean>;
  childMapExpanded: Record<number, boolean>;
  onElementDoubleClick?: (type: 'group' | 'sub' | 'child' | 'stream', id: any, subId?: any) => void;
}) {
  const map = useMap();
  // The lines are laid out in screen pixels, between boxes that keep their
  // pixel size: any change of view lays them out again, or they drift apart.
  const [, setView] = useState(0);
  useEffect(() => {
    const redraw = () => setView((n) => n + 1);
    const events = 'zoomend moveend resize viewreset rotate';
    map.on(events, redraw);
    return () => {
      map.off(events, redraw);
    };
  }, [map]);

  // A screen-space drawing pinned at its top-left corner.
  const pinned = (key: string, at: Pt, w: number, h: number, html: string, onClick?: any) => (
    <Marker
      key={key}
      position={map.containerPointToLatLng(L.point(at.x, at.y))}
      icon={L.divIcon({
        className: 'conn-drawing',
        html,
        iconSize: [w, h],
        iconAnchor: [0, 0],
      })}
      interactive={!!onClick}
      eventHandlers={onClick ? { click: onClick } : undefined}
    />
  );

  // The tag with a source's product streams, as SVG lines.
  const productTag = (p: ProcessNode) => {
    const products = (p.streams || []).filter((s: any) => s.type?.toLowerCase() === 'product');
    if (products.length === 0) return null;
    const lines: { svg: string; color: string; bold: boolean }[] = [];
    products.forEach((s: any, i) => {
      const info = extractStreamInfo(s);
      const color = (info.tin || 0) > (info.tout || 0) ? '#c0392b' : '#2471a3';
      const num = products.length > 1 ? ` ${i + 1}` : '';
      const text = streamSvgText(info);
      lines.push({ svg: `${i18n.t('map.product')}${num}`, color, bold: true });
      const temps = [text.tin, text.tout].filter(Boolean).join(', ');
      const flow = [text.mdot, text.cp].filter(Boolean).join(', ');
      if (temps) lines.push({ svg: temps, color, bold: false });
      if (flow) lines.push({ svg: flow, color, bold: false });
    });
    const w = Math.ceil(Math.max(...lines.map((l) => svgTextWidth(l.svg))) + PAD * 2);
    const h = lines.length * LH + PAD;
    const body = lines
      .map(
        (l, i) =>
          `<text x="${w / 2}" y="${PAD / 2 + 11 + i * LH}" text-anchor="middle" font-size="11" ${l.bold ? 'font-weight="700"' : ''} fill="${l.color}">${l.svg}</text>`
      )
      .join('');
    const sidxs = products.map((s) => p.streams!.indexOf(s)).join(',');
    return { w, h, body, sidxs };
  };

  const drawConn = (p: ProcessNode, tgt: ProcessNode, pIdx: number) => {
    const srcLat = parseFloat(String(p.lat));
    const srcLon = parseFloat(String(p.lon));
    const tLat = parseFloat(String(tgt.lat));
    const tLon = parseFloat(String(tgt.lon));
    if (isNaN(srcLat) || isNaN(srcLon) || isNaN(tLat) || isNaN(tLon)) return null;

    const p1 = map.latLngToContainerPoint([srcLat, srcLon]);
    const p2 = map.latLngToContainerPoint([tLat, tLon]);
    const src = boxHalf(p.name, p.box_scale);
    const dst = boxHalf(tgt.name, tgt.box_scale);
    // Edge to edge, so no part of the line hides under a box.
    const route = routeConnection(p1, p2, src, dst);
    if (!route) return null;

    // Line and arrowhead in one drawing: the tip touches the target box.
    const rad = (route.angle * Math.PI) / 180;
    const d = { x: Math.cos(rad), y: Math.sin(rad) };
    const tip = { x: route.arrow.x + d.x * 10, y: route.arrow.y + d.y * 10 };
    const base = { x: route.arrow.x - d.x * 2, y: route.arrow.y - d.y * 2 };
    const wing = { x: -d.y * 6, y: d.x * 6 };
    const path = [route.start, route.mid1, route.mid2, base];
    const head = [
      tip,
      { x: base.x + wing.x, y: base.y + wing.y },
      { x: base.x - wing.x, y: base.y - wing.y },
    ];
    const all = [...path, ...head];
    const o = {
      x: Math.min(...all.map((q) => q.x)) - 4,
      y: Math.min(...all.map((q) => q.y)) - 4,
    };
    const w = Math.max(...all.map((q) => q.x)) - o.x + 4;
    const h = Math.max(...all.map((q) => q.y)) - o.y + 4;
    const pts = (qs: Pt[]) =>
      qs.map((q) => `${(q.x - o.x).toFixed(1)},${(q.y - o.y).toFixed(1)}`).join(' ');
    const key = `conn-${p.name}-${tgt.name}`;
    const line = pinned(
      key,
      o,
      w,
      h,
      `<svg width="${w}" height="${h}" style="display:block;overflow:visible">` +
        `<polyline points="${pts(path)}" fill="none" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" />` +
        `<polygon points="${pts(head)}" fill="${LINE}" /></svg>`
    );

    const tag = productTag(p);
    if (!tag) return line;
    const at = labelSpot(route, p1, p2, src, dst, tag.w, tag.h);
    const onClick = (e: any) => {
      const g = (e.originalEvent.target as HTMLElement).closest('g.stream-arrow');
      const first = Number((g?.getAttribute('data-sidxs') || '').split(',')[0]);
      if (g && onElementDoubleClick && pIdx !== -1 && !isNaN(first)) {
        onElementDoubleClick('stream', pIdx, first);
      }
    };
    return (
      <React.Fragment key={key}>
        {line}
        {pinned(
          `${key}-tag`,
          at,
          tag.w,
          tag.h,
          `<svg width="${tag.w}" height="${tag.h}" style="display:block;overflow:visible">` +
            `<g class="stream-arrow" data-sidxs="${tag.sidxs}" style="cursor:pointer">` +
            `<rect x="0.5" y="0.5" width="${tag.w - 1}" height="${tag.h - 1}" rx="6" style="fill:var(--surface,#fff);stroke:var(--border,#e2e8f0)" />` +
            `${tag.body}</g></svg>`,
          onClick
        )}
      </React.Fragment>
    );
  };

  const connections: React.ReactElement[] = [];
  const targetsOf = (p: ProcessNode) =>
    (p.next || '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

  const expandedGroups = groups.map((_, g) => g).filter((g) => subprocessMapExpanded[g]);

  // 1. Between processes, when no process is opened.
  if (expandedGroups.length === 0) {
    const seen = new Set<string>();
    groups.forEach((subIdxs, gIdx) => {
      subIdxs.forEach((si) => {
        targetsOf(processes[si]).forEach((tName) => {
          const tg = groups.findIndex((t) => t.some((tsi) => processes[tsi].name === tName));
          const pair = `${gIdx}-${tg}`;
          if (tg === -1 || tg === gIdx || seen.has(pair)) return;
          seen.add(pair);
          const a = groupCoordinates[gIdx];
          const b = groupCoordinates[tg];
          if (!a || !b) return;
          const node = (g: number, c: GroupCoords) =>
            ({
              name: groupNames[g] || `Process ${g + 1}`,
              lat: c.lat,
              lon: c.lon,
              box_scale: c.box_scale || 1.5,
            }) as ProcessNode;
          const el = drawConn(node(gIdx, a), node(tg, b), -1);
          if (el) connections.push(el);
        });
      });
    });
  }

  // 2. Between the subprocesses of an opened process (those not opened themselves).
  expandedGroups.forEach((g) => {
    const visible = groups[g].filter((si) => !childMapExpanded[si]);
    visible.forEach((si) => {
      targetsOf(processes[si]).forEach((tName) => {
        const ti = visible.find((idx) => processes[idx].name === tName);
        if (ti === undefined) return;
        const el = drawConn(processes[si], processes[ti], si);
        if (el) connections.push(el);
      });
    });
  });

  // 3. Between the children of an opened subprocess.
  expandedGroups.forEach((g) => {
    groups[g].forEach((si) => {
      if (!childMapExpanded[si]) return;
      const children = processes[si].children || [];
      children.forEach((c) => {
        targetsOf(c).forEach((tName) => {
          const tgt = children.find((pp) => pp.name === tName);
          const el = tgt && drawConn(c, tgt, -1);
          if (el) connections.push(el);
        });
      });
    });
  });

  return <>{connections}</>;
}
