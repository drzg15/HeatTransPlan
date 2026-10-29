import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, ImageOverlay, Marker, Pane } from 'react-leaflet';
import L from 'leaflet';
// After leaflet: patches the global L so the map can rotate.
import 'leaflet-rotate';
import 'leaflet/dist/leaflet.css';
import type { ProcessNode } from '../../types/process';
import type { SitePlan } from '../../types/project';
import './MapViewer.css';
// Fix missing Leaflet default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { BoxSelector } from './BoxSelector';
import { ConnectionLines } from './ConnectionLines';
import {
  MapCenterSync,
  MapClickHandler,
  MapController,
  MapFullscreenResizer,
  MapMountFitter,
  MapMoveHandler,
  MapRotation,
  RotateControls,
  SubprocessCanvasOverlay,
  SubprocessMapFreeze,
} from './MapControls';
import { PlanControls } from './SitePlanControls';
import { StreamArrowsOverlay } from './StreamArrowsOverlay';
import { StreamCirclesOverlay } from './StreamCirclesOverlay';
import { TILE_URLS, createDivIcon } from './mapHelpers';
import type { GroupCoords } from './types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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
  /** Degrees clockwise from north; without the handler a turn is not saved. */
  bearing?: number;
  onRotateEnd?: (bearing: number) => void;
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

  // The user's own site plan: over the map, and behind each process diagram.
  // Without the change handlers the plans are only shown, not edited.
  sitePlan?: SitePlan | null;
  onSitePlanChange?: (plan: SitePlan | null) => void;
  canvasPlans?: Record<string, string>;
  onCanvasPlansChange?: (plans: Record<string, string>) => void;
}

export default function MapViewer({
  center,
  zoom,
  locked,
  processes: rawProcesses,
  groups,
  groupNames,
  groupCoordinates,
  baseTile,
  onClick: _onClick,
  onMoveEnd,
  bearing = 0,
  onRotateEnd,
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
  sitePlan,
  onSitePlanChange,
  canvasPlans = {},
  onCanvasPlansChange,
}: Props) {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapObj, setMapObj] = useState<L.Map | null>(null);

  // A subprocess belongs to its process, so it sits where the process sits
  // unless it has been given a spot of its own. The export table already
  // resolves coordinates this way (sub.lat || group.lat) — the map was the
  // one place that demanded explicit coordinates and silently skipped any
  // node without them, so a freshly added subprocess never appeared.
  //
  // Resolved once here, so every consumer below — markers, connectors, stream
  // bubbles and box selection — sees the inherited position without each
  // having to repeat the fallback.
  const processes = useMemo(() => {
    const groupOf = new Map<number, GroupCoords>();
    groups.forEach((subIdxs, gIdx) => {
      const gc = groupCoordinates[gIdx];
      if (gc) subIdxs.forEach((si) => groupOf.set(si, gc));
    });

    const inherit = (
      node: ProcessNode,
      fallbackLat: unknown,
      fallbackLon: unknown
    ): ProcessNode => {
      const hasOwn = node.lat !== '' && node.lat != null && node.lon !== '' && node.lon != null;
      const lat = hasOwn ? node.lat : (fallbackLat as ProcessNode['lat']);
      const lon = hasOwn ? node.lon : (fallbackLon as ProcessNode['lon']);
      const children = node.children?.length
        ? node.children.map((c) => inherit(c, lat, lon))
        : node.children;
      return children === node.children && lat === node.lat && lon === node.lon
        ? node
        : { ...node, lat, lon, children };
    };

    return rawProcesses.map((proc, si) => {
      const gc = groupOf.get(si);
      return inherit(proc, gc?.lat, gc?.lon);
    });
  }, [rawProcesses, groups, groupCoordinates]);
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
    const nextGroupCoords = { ...groupCoordinates };
    // Built from the RAW processes, not the resolved ones: writing back a
    // resolved array would stamp every inherited coordinate onto its node as
    // if it had been placed there, so a later move of the process would no
    // longer carry its subprocesses along.
    const nextProcesses = [...rawProcesses];
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

    // A subprocess belongs to its process, so moving the process takes its
    // subprocesses with it. Each keeps its own offset from the process, which
    // is what holds the diagram's shape together — otherwise dragging a
    // process left its subprocesses stranded at their old coordinates.
    if (type === 'group' && !(allowMultiMove && selectedIds.has(markerKey))) {
      const gIdx = parseInt(id);
      const prevLat = parseFloat(String(groupCoordinates[id]?.lat ?? ''));
      const prevLon = parseFloat(String(groupCoordinates[id]?.lon ?? ''));
      // With no previous coordinate there is no delta to apply: the group has
      // only just been placed, so its subprocesses inherit it instead.
      if (!isNaN(prevLat) && !isNaN(prevLon)) {
        const gLat = lat - prevLat;
        const gLon = lng - prevLon;
        const shift = (node: ProcessNode): ProcessNode => {
          const nLat = parseFloat(String(node.lat ?? ''));
          const nLon = parseFloat(String(node.lon ?? ''));
          const moved =
            isNaN(nLat) || isNaN(nLon)
              ? node
              : { ...node, lat: (nLat + gLat).toString(), lon: (nLon + gLon).toString() };
          return moved.children?.length ? { ...moved, children: moved.children.map(shift) } : moved;
        };
        (groups[gIdx] || []).forEach((si) => {
          if (!nextProcesses[si]) return;
          nextProcesses[si] = shift(nextProcesses[si]);
          changedProc = true;
        });
      }
    }

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
  // The open diagram whose background the plan button sets: a process (group)
  // or, one level down, a subprocess.
  const canvasKey = useMemo(() => {
    const g = Object.keys(subprocessMapExpanded).find((k) => subprocessMapExpanded[+k]);
    if (g !== undefined) return `g${g}`;
    const c = Object.keys(childMapExpanded).find((k) => childMapExpanded[+k]);
    return c !== undefined ? `s${c}` : null;
  }, [subprocessMapExpanded, childMapExpanded]);

  return (
    <div
      className={`map-viewer-container ${className || ''} ${isFullscreen ? 'fullscreen' : ''} ${selectionActive ? 'pa-selection-active' : ''} ${isCanvasActive ? 'map-frozen' : ''} ${sitePlan ? 'map-plan-only' : ''}`}
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
        {onSitePlanChange && (
          <PlanControls
            map={mapObj}
            canvasKey={isCanvasActive ? canvasKey : null}
            sitePlan={sitePlan}
            onSitePlanChange={onSitePlanChange}
            canvasPlans={canvasPlans}
            onCanvasPlansChange={onCanvasPlansChange}
          />
        )}
        <button
          className="pa-btn"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? t('ui.exit_fullscreen') : t('ui.fullscreen')}
          aria-label={isFullscreen ? t('ui.exit_fullscreen') : t('ui.fullscreen')}
          style={{ padding: '6px 10px' }}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      <MapContainer
        ref={setMapObj}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        // Always there: a locked map still zooms, it only stops panning.
        zoomControl
        dragging={!locked}
        scrollWheelZoom={!locked}
        doubleClickZoom={!locked}
        boxZoom={!locked}
        keyboard={!locked}
        zoomSnap={0.25}
        zoomDelta={0.25}
        // Turned by RotateControls, Shift + mouse wheel or two fingers.
        rotate
        bearing={bearing}
        rotateControl={false}
        shiftKeyRotate
        touchRotate
      >
        {/* A site plan replaces the map: on white, nothing behind it.
            Google has sharper satellite tiles one level further than OSM. */}
        {!sitePlan && (
          <TileLayer
            key={tileUrl}
            url={tileUrl}
            maxNativeZoom={baseTile === 'Satellite' ? 20 : 19}
            maxZoom={24}
          />
        )}
        <RotateControls hidden={isCanvasActive} />
        {sitePlan && (
          // In the rotating pane, so the plan turns with the map.
          <Pane name="sitePlanPane" pane="rotatePane" style={{ zIndex: 300 }}>
            <ImageOverlay
              key={sitePlan.url.length + sitePlan.bounds.flat().join()}
              url={sitePlan.url}
              bounds={sitePlan.bounds}
            />
          </Pane>
        )}
        <MapController center={center} zoom={zoom} locked={locked} frozen={isCanvasActive} />
        <MapClickHandler onClick={handleMapClick} />
        <MapFullscreenResizer active={isFullscreen} />
        <MapMountFitter center={center} zoom={zoom} />
        {/* Holds the map still so the diagram cannot be panned off its canvas. */}
        <SubprocessMapFreeze active={isCanvasActive} locked={locked} />
        <MapRotation bearing={bearing} frozen={isCanvasActive} onRotateEnd={onRotateEnd} />

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
            image={canvasKey ? canvasPlans[canvasKey] : undefined}
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
          })}
        </Pane>

        {/* 3.5 Connection Lines — Below markers but above canvas */}
        <Pane name="connectionLinesPane" style={{ zIndex: 655 }}>
          <ConnectionLines
            processes={processes}
            groups={groups}
            groupNames={groupNames}
            groupCoordinates={groupCoordinates}
            subprocessMapExpanded={subprocessMapExpanded}
            childMapExpanded={childMapExpanded}
            onElementDoubleClick={onElementDoubleClick}
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
                  // The map is frozen while the diagram is open, but the boxes
                  // are not: dragging one moves that box alone, which is how
                  // the diagram is arranged.
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
                    p.box_scale ? parseFloat(String(p.box_scale)) : 1.5,
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
                  // The map is frozen while the diagram is open, but the boxes
                  // are not: dragging one moves that box alone, which is how
                  // the diagram is arranged.
                  draggable={true}
                  pane="expandedContentPane"
                  eventHandlers={{
                    dragend: (e) => handleDragEnd(e, 'child', `${si}-${ci}`),
                  }}
                  icon={createDivIcon(
                    '',
                    child.name,
                    '',
                    child.box_scale ? parseFloat(String(child.box_scale)) : 1.2,
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
        </Pane>

        <BoxSelector
          active={locked} // Always active when map is locked
          locked={locked}
          onSelect={(inBox) => {
            lastSelectionTime.current = Date.now();
            const idxsInBox: number[] = [];
            const newSelected = new Set<string>();

            // 1. Check groups
            groups.forEach((subIdxs, gIdx) => {
              const gc = groupCoordinates[gIdx];
              if (gc && gc.lat && gc.lon) {
                const lat = parseFloat(String(gc.lat));
                const lon = parseFloat(String(gc.lon));
                if (inBox([lat, lon])) {
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
                if (inBox([lat, lon])) {
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
        <MapCenterSync center={center} zoom={zoom} />
        <MapFullscreenResizer active={isFullscreen} />
      </MapContainer>
    </div>
  );
}
