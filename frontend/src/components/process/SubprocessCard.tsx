import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProcessNode } from '../../types/process';
import type { Stream } from '../../types/stream';
import StreamEditor from './StreamEditor';
import { useUIStore } from '../../store/uiStore';
import './SubprocessCard.css';

interface Props {
  id?: string;
  subprocess: ProcessNode;
  subIdx: number;
  groupIdx: number;
  allProcessNames: string[];
  onUpdate: (updated: ProcessNode) => void;
  onDelete: () => void;
  onPlaceRequest: (target: string) => void;
  placementTarget: string | null;
}

const DEFAULT_STREAM: Stream = {
  name: 'Stream 1',
  type: 'product',
  display_vars: ['Tin', 'Tout', 'ṁ', 'cp'],
  stream_values: {},
};

export default function SubprocessCard({
  id,
  subprocess,
  subIdx,
  groupIdx: _groupIdx,
  allProcessNames,
  onUpdate,
  onDelete,
  onPlaceRequest,
  placementTarget,
}: Props) {
  const { t } = useTranslation();
  const expanded = useUIStore((s) => s.expandedSubprocesses.has(subIdx));
  const setExpanded = (v: boolean) => useUIStore.getState().setSubprocessExpanded(subIdx, v);

  const activeSection = useUIStore((s) => s.activeSections[subIdx] || 'streams');
  const setActiveSection = (sec: string) => useUIStore.getState().setActiveSection(subIdx, sec);

  const [confirmDel, setConfirmDel] = useState(false);

  const isPlacing = placementTarget === `sub_${subIdx}`;

  const update = (partial: Partial<ProcessNode>) => {
    onUpdate({ ...subprocess, ...partial });
  };

  const addStream = () => {
    const streams = [...(subprocess.streams || [])];
    streams.push({
      ...DEFAULT_STREAM,
      name: `Stream ${streams.length + 1}`,
    });
    update({ streams });
  };

  const updateStream = (sIdx: number, updated: Stream) => {
    const streams = [...(subprocess.streams || [])];
    streams[sIdx] = updated;
    update({ streams });
  };

  const deleteStream = (sIdx: number) => {
    const streams = (subprocess.streams || []).filter((_, i) => i !== sIdx);
    update({ streams });
  };

  // Build next options: all other process names
  const nextOptions = allProcessNames.filter((n) => n !== subprocess.name);
  const selectedNext = subprocess.next
    ? subprocess.next
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="sp-card" id={id}>
      {/* Header */}
      <div className="sp-header">
        <button
          className="pgl-toggle"
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          <span className={`collapsible-arrow ${expanded ? 'open' : ''}`}>▶</span>
        </button>

        <input
          type="text"
          className="sp-name-input"
          value={subprocess.name}
          onChange={(e) => update({ name: e.target.value })}
        />

        <div className="pgl-scale">
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={subprocess.box_scale || 1.0}
            onChange={(e) => update({ box_scale: parseFloat(e.target.value) })}
          />
        </div>

        <button
          className={`btn btn-sm ${isPlacing ? 'btn-primary' : ''}`}
          onClick={() => onPlaceRequest(isPlacing ? '' : `sub_${subIdx}`)}
        >
          {isPlacing ? t('process.done') : t('process.place')}
        </button>

        {confirmDel ? (
          <span className="pgl-confirm">
            <button className="btn btn-sm btn-danger" onClick={onDelete}>
              ✅
            </button>
            <button className="btn btn-sm" onClick={() => setConfirmDel(false)}>
              ❌
            </button>
          </span>
        ) : (
          <button className="btn btn-sm" onClick={() => setConfirmDel(true)}>
            ✕
          </button>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="sp-body">
          {/* Section tabs */}
          <div className="sp-tabs">
            {[
              { key: 'relationships', label: t('subprocess.next_processes'), color: '#2980b9' },
              { key: 'streams', label: t('data_collection.streams'), color: '#e74c3c' },
              { key: 'notes', label: t('analysis.sections.notes'), color: '#f39c12' },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`sp-tab ${activeSection === tab.key ? 'active' : ''}`}
                style={activeSection === tab.key ? { borderBottomColor: tab.color } : {}}
                onClick={() => setActiveSection(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeSection === 'relationships' && (
            <div className="sp-section" style={{ padding: '8px 0' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('subprocess.next_processes')}
              </label>
              <div className="flex" style={{ flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {nextOptions.length === 0 && (
                  <span style={{ fontSize: '11px', color: '#999' }}>
                    {t('subprocess.no_other_processes')}
                  </span>
                )}
                {nextOptions.map((opt) => {
                  const isSelected = selectedNext.includes(opt);
                  return (
                    <button
                      key={opt}
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : ''}`}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '12px',
                        border: isSelected ? 'none' : '1px solid var(--border-strong)',
                      }}
                      onClick={() => {
                        if (isSelected) {
                          update({ next: selectedNext.filter((n) => n !== opt).join(', ') });
                        } else {
                          update({ next: [...selectedNext, opt].join(', ') });
                        }
                      }}
                    >
                      {opt} {isSelected && '✓'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Streams */}
          {activeSection === 'streams' && (
            <div className="sp-section">
              <div className="flex justify-between items-center mb-sm">
                <span className="sp-section-title">
                  {t('data_collection.streams')} ({subprocess.streams?.length || 0})
                </span>
                <button className="btn btn-sm btn-primary" onClick={addStream}>
                  ➕ {t('subprocess.add_stream')}
                </button>
              </div>
              {(subprocess.streams || []).map((stream, sIdx) => (
                <StreamEditor
                  key={sIdx}
                  id={`stream-editor-${subIdx}-${sIdx}`}
                  stream={stream}
                  onChange={(updated) => updateStream(sIdx, updated)}
                  onDelete={() => deleteStream(sIdx)}
                />
              ))}
            </div>
          )}

          {/* Parameters & Notes */}
          {activeSection === 'notes' && (
            <div className="sp-section">
              <div className="pgl-info-grid mb-sm">
                <div>
                  <label>{t('subprocess.density')}</label>
                  <input
                    type="text"
                    value={subprocess.extra_info?.density || ''}
                    onChange={(e) =>
                      update({
                        extra_info: {
                          ...(subprocess.extra_info || {}),
                          density: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label>{t('subprocess.pressure')}</label>
                  <input
                    type="text"
                    value={subprocess.extra_info?.pressure || ''}
                    onChange={(e) =>
                      update({
                        extra_info: {
                          ...(subprocess.extra_info || {}),
                          pressure: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label>{t('subprocess.water_in')}</label>
                  <input
                    type="text"
                    value={subprocess.extra_info?.water_content_in || ''}
                    onChange={(e) =>
                      update({
                        extra_info: {
                          ...(subprocess.extra_info || {}),
                          water_content_in: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label>{t('subprocess.water_out')}</label>
                  <input
                    type="text"
                    value={subprocess.extra_info?.water_content_out || ''}
                    onChange={(e) =>
                      update({
                        extra_info: {
                          ...(subprocess.extra_info || {}),
                          water_content_out: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <label>{t('analysis.sections.notes')}</label>
              <textarea
                value={subprocess.extra_info?.notes || ''}
                onChange={(e) =>
                  update({
                    extra_info: {
                      ...(subprocess.extra_info || {}),
                      notes: e.target.value,
                    },
                  })
                }
                rows={3}
                style={{ width: '100%' }}
                placeholder={t('subprocess.notes_placeholder')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
