import React, { useMemo } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ProcessNode } from '../../types/process';
import { extractStreamInfo } from '../../utils/streamInfo';
import type { ElementDoubleClick, GroupCoords, StreamLike } from './types';

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
  onElementDoubleClick?: ElementDoubleClick;
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

      const tgtScale = tgt.box_scale ? parseFloat(String(tgt.box_scale)) : 1.5;

      const p1 = map.latLngToContainerPoint([srcLat, srcLon]);
      const p2 = map.latLngToContainerPoint([tLat, tLon]);
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      if (dist < 40) return null;

      const fsTarget = Math.max(12, Math.round(15 * tgtScale));
      const pxTarget = Math.max(6, Math.round(12 * tgtScale));
      const pyTarget = Math.max(3, Math.round(6 * tgtScale));
      const avgCharWidthTarget = fsTarget * 0.62;
      const tgtW = Math.round(Math.max(20, tgt.name.length * avgCharWidthTarget + pxTarget * 2 + 2)) / 2;
      const tgtH = Math.round(fsTarget + pyTarget * 2 + 2) / 2;

      let pMid1: L.Point;
      let pMid2: L.Point;
      let pArrow: L.Point;
      let angleDeg: number;

      // The arrow center is 10px from the tip, so we offset by 12px total (10px + 2px padding) from the edge
      const ARROW_OFFSET = 12;
      const isHorizontalLayout = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y);

      if (isHorizontalLayout) {
        // Horizontal Layout: Exit Side, Enter Side (3 segments)
        const midX = (p1.x + p2.x) / 2;
        pMid1 = L.point(midX, p1.y);
        pMid2 = L.point(midX, p2.y);
        
        if (p2.x > p1.x) {
          // Target is Right: Enter Left side, point Right
          pArrow = L.point(p2.x - tgtW - ARROW_OFFSET, p2.y);
          angleDeg = 0;
        } else {
          // Target is Left: Enter Right side, point Left
          pArrow = L.point(p2.x + tgtW + ARROW_OFFSET, p2.y);
          angleDeg = 180;
        }
      } else {
        // Vertical Layout: Exit Top/Bottom, Enter Top/Bottom (3 segments)
        const midY = (p1.y + p2.y) / 2;
        pMid1 = L.point(p1.x, midY);
        pMid2 = L.point(p2.x, midY);

        if (p2.y > p1.y) {
          // Target is Below: Enter Top side, point Down
          pArrow = L.point(p2.x, p2.y - tgtH - ARROW_OFFSET);
          angleDeg = 90;
        } else {
          // Target is Above: Enter Bottom side, point Up
          pArrow = L.point(p2.x, p2.y + tgtH + ARROW_OFFSET);
          angleDeg = -90;
        }
      }

      const lArrow = map.containerPointToLatLng(pArrow);

      const arrowIcon = L.divIcon({
        className: 'custom-arrow',
        html: `<div style="transform: rotate(${angleDeg}deg); display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;">
          <svg width="20" height="20" viewBox="0 0 20 20" overflow="visible" style="display: block;">
            <path d="M2,4 L18,10 L2,16 L6,10 Z" fill="#475569" />
          </svg>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const createLineMarker = (pA: L.Point, pB: L.Point, suffix: string) => {
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx) * (180 / Math.PI);
        const lA = map.containerPointToLatLng(pA);
        
        const lineIcon = L.divIcon({
          className: 'custom-line-icon',
          html: `<div style="width: ${len}px; height: 2px; background: #475569; transform: rotate(${ang}deg); transform-origin: left center; margin-top: -1px;"></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        return <Marker key={`conn-${p.name}-${tgt.name}-${suffix}`} position={lA} icon={lineIcon} interactive={false} />;
      };

      // Draw product streams of the SOURCE process on its OUTGOING connection line
      const productStreams = (p.streams || []).filter((s) => s.type && s.type.toLowerCase() === 'product');
      let productTextMarker = null;
      if (productStreams.length > 0) {
        // Calculate source box dimensions to find the true visible start of the line
        const srcScale = p.box_scale ? parseFloat(String(p.box_scale)) : 1.5;
        const fsSrc = Math.max(12, Math.round(15 * srcScale));
        const pxSrc = Math.max(6, Math.round(12 * srcScale));
        const pySrc = Math.max(3, Math.round(6 * srcScale));
        const avgCharWidthSrc = fsSrc * 0.62;
        const srcW = Math.round(Math.max(20, p.name.length * avgCharWidthSrc + pxSrc * 2 + 2)) / 2;
        const srcH = Math.round(fsSrc + pySrc * 2 + 2) / 2;
        
        let midP: L.Point;
        let htmlContent = '';
        
        let pIdx = processes.findIndex(proc => proc === p);
        let cIdx: number | undefined = undefined;
        if (pIdx === -1) {
          processes.forEach((proc, i) => {
            if (proc.children) {
              const childIndex = proc.children.findIndex((c) => c === p);
              if (childIndex !== -1) {
                pIdx = i;
                cIdx = childIndex;
              }
            }
          });
        }

        let iconAnchorX, iconAnchorY;
        const svgW = 140;
        const svgH = 80;
        
        let svgContent = '';
        const sidxsStr = productStreams.map((s) => p.streams!.findIndex(orig => orig === s)).join(',');

        if (isHorizontalLayout) {
          const startX = pMid1.x > p1.x ? p1.x + srcW : p1.x - srcW;
          midP = L.point((startX + pMid1.x) / 2, p1.y);
          iconAnchorX = svgW / 2;
          iconAnchorY = svgH; // Bottom-center anchor
          
          let currentY = 20; // Start near the top of the SVG box
          
          productStreams.forEach((s, pIdx) => {
            const info = extractStreamInfo(s as StreamLike);
            const tColor = (info.tin || 0) > (info.tout || 0) ? '#e74c3c' : '#3498db';
            const numStr = productStreams.length > 1 ? ` ${pIdx + 1}` : '';
            const parts = [];
            if (info.tin !== null && info.tin !== undefined) parts.push(`Tin=${info.tin}°C`);
            if (info.tout !== null && info.tout !== undefined) parts.push(`Tout=${info.tout}°C`);
            
            const extraProps = [];
            if (info.mdot !== null && info.mdot !== undefined) extraProps.push(`m=${info.mdot}`);
            if (info.cp !== null && info.cp !== undefined) extraProps.push(`cp=${info.cp}`);
            
            svgContent += `<text x="${svgW/2}" y="${currentY}" text-anchor="middle" font-size="11" font-weight="bold" fill="${tColor}" paint-order="stroke" stroke="white" stroke-width="3">Product${numStr}</text>`;
            currentY += 12;
            
            if (parts.length > 0) {
              svgContent += `<text x="${svgW/2}" y="${currentY}" text-anchor="middle" font-size="11" fill="${tColor}" paint-order="stroke" stroke="white" stroke-width="3">${parts.join(', ')}</text>`;
              currentY += 12;
            }
            if (extraProps.length > 0) {
              svgContent += `<text x="${svgW/2}" y="${currentY}" text-anchor="middle" font-size="11" fill="${tColor}" paint-order="stroke" stroke="white" stroke-width="3">${extraProps.join(', ')}</text>`;
              currentY += 12;
            }
            currentY += 4; // Spacing between multiple products
          });

        } else {
          const startY = pMid1.y > p1.y ? p1.y + srcH : p1.y - srcH;
          midP = L.point(p1.x, (startY + pMid1.y) / 2);
          iconAnchorX = 0;
          iconAnchorY = svgH / 2; // Left-center anchor
          
          let currentY = 30; // Start vertically centered-ish
          
          productStreams.forEach((s, pIdx) => {
            const info = extractStreamInfo(s as StreamLike);
            const tColor = (info.tin || 0) > (info.tout || 0) ? '#e74c3c' : '#3498db';
            const numStr = productStreams.length > 1 ? ` ${pIdx + 1}` : '';
            const parts = [];
            if (info.tin !== null && info.tin !== undefined) parts.push(`Tin=${info.tin}°C`);
            if (info.tout !== null && info.tout !== undefined) parts.push(`Tout=${info.tout}°C`);
            
            const extraProps = [];
            if (info.mdot !== null && info.mdot !== undefined) extraProps.push(`m=${info.mdot}`);
            if (info.cp !== null && info.cp !== undefined) extraProps.push(`cp=${info.cp}`);
            
            svgContent += `<text x="6" y="${currentY}" text-anchor="start" font-size="11" font-weight="bold" fill="${tColor}" paint-order="stroke" stroke="white" stroke-width="3">Product${numStr}</text>`;
            currentY += 12;
            
            if (parts.length > 0) {
              svgContent += `<text x="6" y="${currentY}" text-anchor="start" font-size="11" fill="${tColor}" paint-order="stroke" stroke="white" stroke-width="3">${parts.join(', ')}</text>`;
              currentY += 12;
            }
            if (extraProps.length > 0) {
              svgContent += `<text x="6" y="${currentY}" text-anchor="start" font-size="11" fill="${tColor}" paint-order="stroke" stroke="white" stroke-width="3">${extraProps.join(', ')}</text>`;
              currentY += 12;
            }
            currentY += 4;
          });
        }
        
        // Wrap the SVG content in a <g> tag with the class "stream-arrow" so it shares the identical CSS/Event rules as the normal streams.
        htmlContent = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
          <g class="stream-arrow" data-pidx="${pIdx}" data-cidx="${cIdx ?? ''}" data-sidxs="${sidxsStr}" style="cursor:pointer; transition:all 0.2s;">
            ${svgContent}
          </g>
        </svg>`;

        const lText = map.containerPointToLatLng(midP);
        
        const textIcon = L.divIcon({
          className: 'custom-product-text',
          html: `<style>.custom-product-text { background: none; border: none; pointer-events: none !important; } .custom-product-text .stream-arrow { pointer-events: auto !important; }</style>` + htmlContent,
          iconSize: [svgW, svgH],
          iconAnchor: [iconAnchorX, iconAnchorY],
        });

        const handleMarkerClick = (e: L.LeafletMouseEvent) => {
          const target = e.originalEvent.target as HTMLElement;
          const g = target.closest('g.stream-arrow');
          if (g && onElementDoubleClick && pIdx !== -1) {
            const sidxs = (g.getAttribute('data-sidxs') || '').split(',').filter(Boolean).map(Number);
            if (sidxs.length > 0) onElementDoubleClick('stream', pIdx, sidxs[0]);
          }
        };

        productTextMarker = <Marker 
          key={`conn-prod-${p.name}-${tgt.name}`} 
          position={lText} 
          icon={textIcon} 
          interactive={true} 
          eventHandlers={{ click: handleMarkerClick }}
        />;
      }

      return (
        <React.Fragment key={`conn-${p.name}-${tgt.name}`}>
          {createLineMarker(p1, pMid1, 'line1')}
          {createLineMarker(pMid1, pMid2, 'line2')}
          {createLineMarker(pMid2, pArrow, 'line3')}
          <Marker position={lArrow} icon={arrowIcon} interactive={false} />
          {productTextMarker}
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
                  };
                  const tgtNode = {
                    name: groupNames[targetGIdx] || `Process ${targetGIdx + 1}`,
                    lat: tgtGC.lat,
                    lon: tgtGC.lon,
                    box_scale: tgtGC.box_scale || 1.5,
                  };
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
