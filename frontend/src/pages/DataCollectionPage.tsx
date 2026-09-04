import { useState, useCallback, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useAnalysisStore } from '../store/analysisStore';

import MapViewer from '../components/map/MapViewer';
import ProcessGroupList from '../components/process/ProcessGroupList';
import ActionBar from '../components/io/ActionBar';
import StreamDataTable from '../components/analysis/StreamDataTable';
import './DataCollectionPage.css';
import TutorialPanel from '../components/ui/TutorialPanel';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function DataCollectionPage() {
  const { t } = useTranslation();
  const state = useProjectStore((s) => s.state);
  const setMapCenter = useProjectStore((s) => s.setMapCenter);
  const setMapZoom = useProjectStore((s) => s.setMapZoom);
  const setMapLocked = useProjectStore((s) => s.setMapLocked);
  const setCurrentBase = useProjectStore((s) => s.setCurrentBase);
  const setProcesses = useProjectStore((s) => s.setProcesses);
  const setGroups = useProjectStore((s) => s.setGroups);
  const setGroupNames = useProjectStore((s) => s.setGroupNames);

  const selectedStreams = useAnalysisStore((s) => s.selectedStreams);
  const setSelectedStreams = useAnalysisStore((s) => s.setSelectedStreams);

  const [uiMode, setUiMode] = useState<'select' | 'analyze'>(
    state.map_locked ? 'analyze' : 'select'
  );

  // Below 900px the editor and the map can't sit side by side — they become
  // two panes the user switches between instead of a squeezed split view.
  const isMobile = useIsMobile();
  const [mobilePane, setMobilePane] = useState<'editor' | 'map'>('map');

  const [addressSearch, setAddressSearch] = useState('');
  const [_searchResults, setSearchResults] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Auto-sync UI mode with map_locked state (e.g., when loading files)
  useEffect(() => {
    setUiMode(state.map_locked ? 'analyze' : 'select');
  }, [state.map_locked]);

  // Placement state
  const [placementTarget, setPlacementTarget] = useState<string | null>(null);

  // Measure state
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureResult, setMeasureResult] = useState<string | null>(null);

  // Subprocess map view toggles
  const [subprocessMapExpanded, setSubprocessMapExpanded] = useState<Record<number, boolean>>({});

  const [showTutorial, setShowTutorial] = useState(false);
  const expandedGroups = useUIStore((s) => s.expandedGroups);
  const setExpandedGroups = (val: Set<number>) => useUIStore.getState().setGroupsExpanded(val);

  const handleElementDoubleClick = useCallback(
    (type: 'group' | 'sub' | 'child' | 'stream', id: any, subId?: any) => {
      let pIdx = -1;
      let targetGIdx = -1;

      if (type === 'group') targetGIdx = id;
      else if (type === 'sub') {
        pIdx = id;
        targetGIdx = state.proc_groups.findIndex((g) => g.includes(pIdx));
      } else if (type === 'child') {
        pIdx = id.subIdx;
        targetGIdx = state.proc_groups.findIndex((g) => g.includes(pIdx));
      } else if (type === 'stream') {
        pIdx = id;
        targetGIdx = state.proc_groups.findIndex((g) => g.includes(pIdx));
      }

      if (targetGIdx !== -1) {
        // ONLY expand this group
        setExpandedGroups(new Set([targetGIdx]));

        if (pIdx !== -1) {
          // ONLY expand this subprocess
          useUIStore.getState().setSubprocessExpanded(pIdx, true);
          useUIStore.getState().setActiveSection(pIdx, 'streams');
        }

        // Scroll with a slightly longer delay to allow expansion to paint
        setTimeout(() => {
          let scrollTargetId = `group-list-item-${targetGIdx}`;
          if (type === 'stream' && subId !== undefined) {
            scrollTargetId = `stream-editor-${pIdx}-${subId}`;
          } else if (pIdx !== -1) {
            scrollTargetId = `sub-card-${pIdx}`;
          }

          const el = document.getElementById(scrollTargetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight it briefly?
            el.style.outline = '2px solid var(--accent-primary)';
            setTimeout(() => {
              el.style.outline = 'none';
            }, 2000);
          }
        }, 300);
      }
    },
    [state.proc_groups]
  );

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return;
      // Touch and mouse report the pointer position differently; the drag is
      // otherwise identical. `.dc-resizer` sets touch-action:none so the browser
      // doesn't try to scroll the page out from under the drag.
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX == null) return;
      // Limit width between 200 and 800
      setSidebarWidth(Math.max(200, Math.min(800, clientX)));
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      window.addEventListener('touchmove', resize);
      window.addEventListener('touchend', stopResizing);
      window.addEventListener('touchcancel', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('touchend', stopResizing);
      window.removeEventListener('touchcancel', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const lockMap = useCallback(
    (center: [number, number], zoom: number) => {
      setMapCenter(center);
      setMapZoom(zoom);
      setMapLocked(true);
      setUiMode('analyze');
      // Locking is the hand-off from "find the site" to "describe the process",
      // so move the mobile view to the editor with it.
      setMobilePane('editor');
      setStatusMsg('Map locked — click on map to place processes');
    },
    [setMapCenter, setMapZoom, setMapLocked]
  );

  const unlockMap = useCallback(() => {
    setMapLocked(false);
    setUiMode('select');
    setPlacementTarget(null);
    setMeasureMode(false);
    setMobilePane('map');
    setStatusMsg(null);
  }, [setMapLocked]);

  const addProcessGroup = useCallback(() => {
    const processes = [...state.processes];
    const groups = [...state.proc_groups];
    const groupNames = [...state.proc_group_names];
    // Create a new empty subprocess (level 0 processes contain subprocesses)
    const newProcess = {
      name: `Subprocess ${processes.length + 1}`,
      lat: '',
      lon: '',
      box_scale: 1.0,
      next: '',
      hours: '',
      extra_info: { notes: '' },
      streams: [],
      children: [],
    };
    const newIdx = processes.length;
    processes.push(newProcess);
    groups.push([newIdx]);
    groupNames.push(`Process ${groups.length}`);

    setProcesses(processes);
    setGroups(groups);
    setGroupNames(groupNames);
    setStatusMsg(`Added Process ${groups.length}`);
  }, [state, setProcesses, setGroups, setGroupNames]);

  const handleAddressSearch = useCallback(async () => {
    if (!addressSearch.trim()) return;
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          addressSearch
        )}`
      );
      const data = await resp.json();
      if (data.length > 0) {
        setSearchResults(data);
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setMapCenter([lat, lon]);
        setMapZoom(17);
        setStatusMsg(`Found: ${data[0].display_name}`);
      } else {
        setStatusMsg('No results found');
      }
    } catch {
      setStatusMsg('Search failed');
    }
  }, [addressSearch, setMapCenter, setMapZoom]);

  // Handle map click (for placement or measurement)
  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (placementTarget) {
        // Place process at clicked coordinates
        const processes = [...state.processes];
        // Parse target: "group_N", "sub_N", "child_N_M"
        if (placementTarget.startsWith('group_')) {
          const gIdx = parseInt(placementTarget.split('_')[1]);
          const coords = { ...state.proc_group_coordinates };
          coords[gIdx] = {
            ...(coords[gIdx] || {}),
            lat: lat.toString(),
            lon: lon.toString(),
          };
          useProjectStore.getState().setGroupCoordinates(coords);
        } else if (placementTarget.startsWith('child_')) {
          const parts = placementTarget.split('_');
          const subIdx = parseInt(parts[1]);
          const childIdx = parseInt(parts[2]);
          processes[subIdx] = { ...processes[subIdx] };
          processes[subIdx].children = [...(processes[subIdx].children || [])];
          processes[subIdx].children[childIdx] = {
            ...processes[subIdx].children[childIdx],
            lat: lat.toString(),
            lon: lon.toString(),
          };
          setProcesses(processes);
        } else {
          // sub_N — place subprocess
          const subIdx = parseInt(placementTarget.split('_')[1]);
          processes[subIdx] = {
            ...processes[subIdx],
            lat: lat.toString(),
            lon: lon.toString(),
          };
          setProcesses(processes);
        }
        setPlacementTarget(null);
        setStatusMsg('Placed successfully');
      } else if (measureMode) {
        const newPoints = [...measurePoints, [lat, lon] as [number, number]];
        setMeasurePoints(newPoints);
        if (newPoints.length === 2) {
          // Haversine distance
          const [lat1, lon1] = newPoints[0];
          const [lat2, lon2] = newPoints[1];
          const R = 6371000;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) ** 2;
          const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distStr = d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${d.toFixed(1)} m`;
          setMeasureResult(`Distance: ${distStr}`);
          setMeasureMode(false);
          setMeasurePoints([]);
        }
      }
    },
    [placementTarget, measureMode, measurePoints, state, setProcesses]
  );

  return (
    <div className="dc-page">
      {/* Action bar */}
      <ActionBar
        uiMode={uiMode}
        statusMsg={
          placementTarget
            ? `Click on map to place ${placementTarget}`
            : measureMode
              ? `Click ${2 - measurePoints.length} point(s) to measure`
              : measureResult || statusMsg
        }
        onMeasureToggle={() => {
          setMeasureMode(!measureMode);
          setMeasurePoints([]);
          setMeasureResult(null);
        }}
        measureActive={measureMode}
        currentBase={state.current_base || 'OpenStreetMap'}
        onBaseChange={(b) => setCurrentBase(b)}
        onLockMap={lockMap}
        onUnlockMap={unlockMap}
        onAddProcess={addProcessGroup}
        addressSearch={addressSearch}
        onAddressSearchChange={setAddressSearch}
        onAddressSearchSubmit={handleAddressSearch}
        showHelp={showTutorial}
        onHelpToggle={() => setShowTutorial(!showTutorial)}
      />

      {/* Pane switcher — only reachable on narrow screens, where the split
          view collapses and the two panes take turns. */}
      {isMobile && (
        <div className="dc-pane-switch" role="tablist" aria-label="Data collection view">
          <button
            role="tab"
            aria-selected={mobilePane === 'editor'}
            className={mobilePane === 'editor' ? 'active' : ''}
            onClick={() => setMobilePane('editor')}
          >
            📋 Processes
          </button>
          <button
            role="tab"
            aria-selected={mobilePane === 'map'}
            className={mobilePane === 'map' ? 'active' : ''}
            onClick={() => setMobilePane('map')}
          >
            🗺️ Map &amp; Data
          </button>
        </div>
      )}

      <div className="dc-layout">
        {/* Left panel — process editor */}
        <div
          className="dc-left"
          hidden={isMobile && mobilePane !== 'editor'}
          style={isMobile ? undefined : { width: sidebarWidth, flex: 'none' }}
        >
          {uiMode === 'select' ? (
            <div className="dc-select-controls">
              <p className="dc-hint">
                <Trans i18nKey="action_bar.lock_map_hint">
                  Pan and zoom the map, then click <strong>Lock map</strong> to begin editing
                  processes.
                </Trans>
              </p>
            </div>
          ) : (
            <>
              <ProcessGroupList
                processes={state.processes}
                groups={state.proc_groups}
                groupNames={state.proc_group_names}
                groupCoordinates={state.proc_group_coordinates}
                onProcessesChange={setProcesses}
                onGroupsChange={setGroups}
                onGroupNamesChange={setGroupNames}
                onGroupCoordinatesChange={(c) => useProjectStore.getState().setGroupCoordinates(c)}
                expandedGroups={expandedGroups}
                onExpandedGroupsChange={setExpandedGroups}
                onPlaceRequest={(target) => {
                  setPlacementTarget(target);
                  setStatusMsg(`Click on map to place ${target}`);
                }}
                placementTarget={placementTarget}
                subprocessMapExpanded={subprocessMapExpanded}
                onSubprocessMapToggle={(gIdx) =>
                  setSubprocessMapExpanded((prev) => ({
                    [gIdx]: !prev[gIdx],
                  }))
                }
              />
            </>
          )}
        </div>

        {/* Resizer handle — there is nothing to resize once the panes stack */}
        {!isMobile && (
          <div
            className="dc-resizer"
            onMouseDown={startResizing}
            onTouchStart={startResizing}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize process panel"
          />
        )}

        {/* Right panel — map.
            Unmounted rather than hidden on mobile: Leaflet measures its
            container on init and comes up zero-sized if that container is
            display:none, so it has to mount only when it is actually visible. */}
        {(!isMobile || mobilePane === 'map') && (
          <div className="dc-right">
            {/* Removed redundant search bar — integrated into ActionBar */}

            <MapViewer
              height={isMobile ? 'clamp(280px, 58vh, 480px)' : '750px'}
              center={
                state.map_center?.length === 2
                  ? (state.map_center as [number, number])
                  : [51.707937580921694, 8.772205607882668]
              }
              zoom={state.map_zoom || 17}
              locked={uiMode === 'analyze'}
              processes={state.processes}
              groups={state.proc_groups}
              groupNames={state.proc_group_names}
              groupCoordinates={state.proc_group_coordinates}
              baseTile={state.current_base || 'OpenStreetMap'}
              onClick={handleMapClick}
              onMoveEnd={(center, zoom) => {
                if (uiMode === 'select') {
                  setMapCenter(center);
                  setMapZoom(zoom);
                }
              }}
              subprocessMapExpanded={subprocessMapExpanded}
              childMapExpanded={{}}
              onProcessesChange={setProcesses}
              onGroupCoordinatesChange={(c) => useProjectStore.getState().setGroupCoordinates(c)}
              onElementDoubleClick={handleElementDoubleClick}
              selectedStreams={selectedStreams}
              onProcessesSelect={(idxs, val) => {
                const next = { ...selectedStreams };
                idxs.forEach((pi) => {
                  const p = state.processes[pi];
                  if (!p || !p.streams) return;
                  p.streams.forEach((_, si) => {
                    next[`stream_${pi}_${si}`] = val;
                  });
                });
                setSelectedStreams(next);
              }}
              allowMultiMove={true}
            />

            {/* Legend — directly below the map — VERY COMPACT */}
            {state.processes.some(
              (p) =>
                (p.streams || []).length > 0 ||
                (p.children || []).some((c) => (c.streams || []).length > 0)
            ) && (
              <div
                style={{
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 15,
                  flexWrap: 'wrap',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('data_collection.legend')}
                </span>
                {/* Cold scale */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t('data_collection.cold')}</span>
                  <div
                    style={{
                      width: 40,
                      height: 8,
                      borderRadius: 4,
                      background: 'linear-gradient(to right, rgb(100,150,255), rgb(0,30,180))',
                    }}
                  />
                </div>
                {/* Hot scale */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t('data_collection.hot')}</span>
                  <div
                    style={{
                      width: 40,
                      height: 8,
                      borderRadius: 4,
                      background: 'linear-gradient(to right, rgb(255,120,120), rgb(180,0,0))',
                    }}
                  />
                </div>
                {/* Size */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[3, 5, 8].map((r) => (
                    <svg
                      key={r}
                      width={r * 2 + 2}
                      height={r * 2 + 2}
                      style={{ display: 'block', flexShrink: 0 }}
                    >
                      <circle
                        cx={r + 1}
                        cy={r + 1}
                        r={r}
                        fill="rgba(150,150,150,0.45)"
                        stroke="var(--border-strong)"
                        strokeWidth={1}
                      />
                    </svg>
                  ))}
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t('data_collection.q_power')}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="card mt-md">
              <label>{t('data_collection.project_notes')}</label>
              <textarea
                value={state.project_notes || ''}
                onChange={(e) => useProjectStore.getState().setProjectNotes(e.target.value)}
                rows={4}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>

            {/* Stream data table — below project notes so it gets all remaining space */}
            <StreamDataTable
              processes={state.processes}
              groups={state.proc_groups}
              groupNames={state.proc_group_names}
              groupCoordinates={state.proc_group_coordinates}
            />
          </div>
        )}
      </div>

      {/* Page-level so the help toggle works from either mobile pane, not just
          the one the map happens to be in. */}
      <TutorialPanel isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
  );
}
