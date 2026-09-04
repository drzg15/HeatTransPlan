import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProcessNode } from '../../types/process';
import SubprocessCard from './SubprocessCard';
import './ProcessGroupList.css';

interface GroupCoords {
  lat?: string | number | null;
  lon?: string | number | null;
  hours?: string;
  box_scale?: string | number;
}

interface Props {
  processes: ProcessNode[];
  groups: number[][];
  groupNames: string[];
  groupCoordinates: Record<string, GroupCoords>;
  onProcessesChange: (p: ProcessNode[]) => void;
  onGroupsChange: (g: number[][]) => void;
  onGroupNamesChange: (n: string[]) => void;
  onGroupCoordinatesChange: (c: Record<string, GroupCoords>) => void;
  onPlaceRequest: (target: string) => void;
  placementTarget: string | null;
  subprocessMapExpanded: Record<number, boolean>;
  onSubprocessMapToggle: (gIdx: number) => void;

  expandedGroups?: Set<number>;
  onExpandedGroupsChange?: (set: Set<number>) => void;
}

export default function ProcessGroupList({
  processes,
  groups,
  groupNames,
  groupCoordinates,
  onProcessesChange,
  onGroupsChange,
  onGroupNamesChange,
  onGroupCoordinatesChange,
  onPlaceRequest,
  placementTarget,
  subprocessMapExpanded,
  onSubprocessMapToggle,

  expandedGroups = new Set(),
  onExpandedGroupsChange,
}: Props) {
  const { t } = useTranslation();
  const [infoExpanded, setInfoExpanded] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const toggleGroup = (idx: number) => {
    // If we're clicking an already expanded group, collapse it
    if (expandedGroups.has(idx)) {
      if (subprocessMapExpanded[idx]) {
        onSubprocessMapToggle(idx);
      }
      onExpandedGroupsChange?.(new Set()); // Collapse all
    } else {
      // Otherwise, ONLY expand the new one
      onExpandedGroupsChange?.(new Set([idx]));
    }
  };

  const toggleInfo = (idx: number) => {
    setInfoExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const updateGroupName = (gIdx: number, name: string) => {
    const names = [...groupNames];
    names[gIdx] = name;
    onGroupNamesChange(names);
  };

  const updateGroupCoord = (gIdx: number, field: string, value: string | number) => {
    const coords = { ...groupCoordinates };
    coords[gIdx] = { ...(coords[gIdx] || {}), [field]: value };
    onGroupCoordinatesChange(coords);
  };

  const deleteGroup = (gIdx: number) => {
    const newGroups = groups.filter((_, i) => i !== gIdx);
    const newNames = groupNames.filter((_, i) => i !== gIdx);
    const newCoords = { ...groupCoordinates };
    delete newCoords[gIdx];
    // Re-index coordinates
    const reindexed: Record<string, GroupCoords> = {};
    Object.keys(newCoords).forEach((k) => {
      const oldIdx = parseInt(k);
      const newIdx = oldIdx > gIdx ? oldIdx - 1 : oldIdx;
      reindexed[newIdx] = newCoords[oldIdx];
    });
    onGroupsChange(newGroups);
    onGroupNamesChange(newNames);
    onGroupCoordinatesChange(reindexed);
    setConfirmDelete(null);
  };

  const addSubprocess = (gIdx: number) => {
    const newProcesses = [...processes];
    const newSub: ProcessNode = {
      name: `Subprocess ${newProcesses.length + 1}`,
      lat: '',
      lon: '',
      box_scale: 1.0,
      next: '',
      hours: '',
      extra_info: { notes: '' },
      streams: [],
      children: [],
    };
    const newIdx = newProcesses.length;
    newProcesses.push(newSub);

    const newGroups = [...groups];
    newGroups[gIdx] = [...newGroups[gIdx], newIdx];

    onProcessesChange(newProcesses);
    onGroupsChange(newGroups);
  };

  const updateSubprocess = (subIdx: number, updated: ProcessNode) => {
    const newProcesses = [...processes];
    newProcesses[subIdx] = updated;
    onProcessesChange(newProcesses);
  };

  const deleteSubprocess = (gIdx: number, subIdx: number) => {
    const newGroups = [...groups];
    newGroups[gIdx] = newGroups[gIdx].filter((i) => i !== subIdx);
    // Don't remove from processes array to avoid re-indexing issues
    // Just remove from group
    if (newGroups[gIdx].length === 0) {
      // Remove empty group
      deleteGroup(gIdx);
    } else {
      onGroupsChange(newGroups);
    }
  };

  return (
    <div className="pgl">
      {groups.map((subIdxs, gIdx) => {
        const expanded = expandedGroups.has(gIdx);
        const showInfo = infoExpanded.has(gIdx);
        const gCoords = groupCoordinates[gIdx] || {};
        const isPlacing = placementTarget === `group_${gIdx}`;

        return (
          <div key={gIdx} className="pgl-group card" id={`group-list-item-${gIdx}`}>
            {/* Group header */}
            <div className="pgl-group-header">
              <button
                className="pgl-toggle"
                onClick={() => toggleGroup(gIdx)}
                title={expanded ? 'Collapse' : 'Expand'}
              >
                <span className={`collapsible-arrow ${expanded ? 'open' : ''}`}>▶</span>
              </button>

              <input
                type="text"
                className="pgl-name-input"
                value={groupNames[gIdx] || ''}
                onChange={(e) => updateGroupName(gIdx, e.target.value)}
              />

              <div className="pgl-scale">
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={gCoords.box_scale ?? 1.5}
                  onChange={(e) => updateGroupCoord(gIdx, 'box_scale', parseFloat(e.target.value))}
                  title={`Box size: ${gCoords.box_scale ?? 1.5}`}
                />
              </div>

              <button
                className={`btn btn-sm ${isPlacing ? 'btn-primary' : ''}`}
                onClick={() => onPlaceRequest(isPlacing ? '' : `group_${gIdx}`)}
              >
                {isPlacing ? t('process.done') : t('process.place')}
              </button>

              <span className="pgl-badge">
                {subIdxs.length} {t('data_collection.sub_short')}
              </span>

              {confirmDelete === gIdx ? (
                <span className="pgl-confirm">
                  <button className="btn btn-sm btn-danger" onClick={() => deleteGroup(gIdx)}>
                    ✅
                  </button>
                  <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>
                    ❌
                  </button>
                </span>
              ) : (
                <button
                  className="btn btn-sm"
                  onClick={() => setConfirmDelete(gIdx)}
                  title="Delete group"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Expanded content */}
            {expanded && (
              <div className="pgl-group-body">
                {/* Info section */}
                <div className="pgl-section">
                  <div className="pgl-section-header" onClick={() => toggleInfo(gIdx)}>
                    <span className={`collapsible-arrow ${showInfo ? 'open' : ''}`}>▶</span>
                    <span>{t('process.info')}</span>
                  </div>
                  {showInfo && (
                    <div className="pgl-info-grid">
                      <div>
                        <label>{t('process.lat')}</label>
                        <input
                          type="text"
                          value={gCoords.lat || ''}
                          onChange={(e) => updateGroupCoord(gIdx, 'lat', e.target.value)}
                        />
                      </div>
                      <div>
                        <label>{t('process.lon')}</label>
                        <input
                          type="text"
                          value={gCoords.lon || ''}
                          onChange={(e) => updateGroupCoord(gIdx, 'lon', e.target.value)}
                        />
                      </div>
                      <div>
                        <label>{t('process.hours')}</label>
                        <input
                          type="text"
                          value={gCoords.hours || ''}
                          onChange={(e) => updateGroupCoord(gIdx, 'hours', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Subprocesses */}
                <div className="pgl-section">
                  <div className="pgl-section-header flex justify-between items-center">
                    <span>
                      {t('process.subprocesses')} ({subIdxs.length})
                    </span>
                    <div className="flex gap-xs">
                      <button className="btn btn-sm" onClick={() => onSubprocessMapToggle(gIdx)}>
                        {subprocessMapExpanded[gIdx]
                          ? `🔽 ${t('process.hide_map')}`
                          : `🗺️ ${t('process.show_map')}`}
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => addSubprocess(gIdx)}
                      >
                        ➕ {t('process.add')}
                      </button>
                    </div>
                  </div>

                  {subIdxs.map((si) => {
                    const sub = processes[si];
                    if (!sub) return null;
                    return (
                      <SubprocessCard
                        key={si}
                        id={`sub-card-${si}`}
                        subprocess={sub}
                        subIdx={si}
                        groupIdx={gIdx}
                        allProcessNames={subIdxs.map((idx) => processes[idx]?.name).filter(Boolean)}
                        onUpdate={(updated) => updateSubprocess(si, updated)}
                        onDelete={() => deleteSubprocess(gIdx, si)}
                        onPlaceRequest={onPlaceRequest}
                        placementTarget={placementTarget}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="pgl-empty">
          <p>{t('process.empty_hint')}</p>
        </div>
      )}
    </div>
  );
}
