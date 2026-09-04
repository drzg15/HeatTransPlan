import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../store/projectStore';
import { exportProjectToCsv } from '../../utils/csvExport';
import { projectStateSchema } from '../../schemas/projectSchema';
import './ActionBar.css';

interface Props {
  uiMode: 'select' | 'analyze';
  statusMsg: string | null;
  onMeasureToggle: () => void;
  measureActive: boolean;
  currentBase: string;
  onBaseChange: (base: string) => void;
  onLockMap: (center: [number, number], zoom: number) => void;
  onUnlockMap: () => void;
  onAddProcess?: () => void;
  addressSearch?: string;
  onAddressSearchChange?: (val: string) => void;
  onAddressSearchSubmit?: () => void;
  showHelp?: boolean;
  onHelpToggle?: () => void;
}

const BASE_OPTIONS = ['OpenStreetMap', 'Positron', 'Satellite'];

export default function ActionBar({
  uiMode,
  statusMsg,
  onMeasureToggle,
  measureActive,
  currentBase,
  onBaseChange,
  onLockMap: _onLockMap,
  onUnlockMap,
  onAddProcess,
  addressSearch,
  onAddressSearchChange,
  onAddressSearchSubmit,
  showHelp,
  onHelpToggle,
}: Props) {
  const { t } = useTranslation();
  const state = useProjectStore((s) => s.state);
  const setState = useProjectStore((s) => s.setState);
  const resetState = useProjectStore((s) => s.resetState);
  const fileRef = useRef<HTMLInputElement>(null);

  const [showResetModal, setShowResetModal] = useState(false);

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heattransplan_state_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawData = JSON.parse(reader.result as string);

        // Strictly validate the loaded JSON against our schemas
        const parsed = projectStateSchema.safeParse(rawData);

        if (!parsed.success) {
          // If validation fails, extract a readable error message
          const firstError = parsed.error.errors[0];
          const path = firstError.path.join('.');
          alert(`Invalid Project File.\n\nError at '${path}': ${firstError.message}`);
          return;
        }

        // If it succeeds, parsed.data is heavily typed and guaranteed to be clean
        setState({ ...parsed.data, map_locked: true });
      } catch (err) {
        alert('Could not parse the file. It is not a valid JSON document.');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExportCsv = () => {
    exportProjectToCsv(state);
  };

  return (
    <>
      <div className="action-bar card flex items-center justify-between gap-md">
        {/* 1. Primary Actions (Left) */}
        <div className="ab-group ab-group-primary flex items-center gap-xs">
          {/* Mode-specific Primary Actions (Mode dependent) */}
          {uiMode === 'select' && (
            <>
              <button
                className="btn btn-sm btn-primary"
                onClick={() =>
                  _onLockMap(
                    (state.map_center?.length === 2
                      ? state.map_center
                      : [51.707937580921694, 8.772205607882668]) as [number, number],
                    state.map_zoom || 17
                  )
                }
              >
                🔒 {t('action_bar.lock_map')}
              </button>
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            </>
          )}

          {/* Primary mode actions */}
          {uiMode === 'analyze' && (
            <>
              <button
                className="btn btn-sm"
                onClick={onUnlockMap}
                title="Unlock map to move selection"
              >
                🔓 {t('action_bar.unlock_map')}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={onAddProcess}
                title="Add a new process group"
              >
                ➕ {t('action_bar.add_process')}
              </button>
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            </>
          )}

          <button className="btn btn-sm" onClick={handleSave} title="Save project to JSON">
            💾 {t('action_bar.save')}
          </button>

          <label className="btn btn-sm ab-load-label" title="Load project from JSON">
            📂 {t('action_bar.load')}
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleLoad}
              style={{ display: 'none' }}
            />
          </label>

          <button
            className="btn btn-sm"
            onClick={() => setShowResetModal(true)}
            title="Clear local data and reset project"
            style={{ color: '#d32f2f' }}
          >
            🗑️ {t('action_bar.reset')}
          </button>

          {/* Mode-specific Primary Actions */}
          {uiMode === 'analyze' && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

              <button
                className={`btn btn-sm ${measureActive ? 'btn-primary' : ''}`}
                onClick={onMeasureToggle}
              >
                {measureActive ? `🔄 ${t('action_bar.reset')}` : `📏 ${t('action_bar.measure')}`}
              </button>

              <button className="btn btn-sm" onClick={handleExportCsv}>
                📄 {t('action_bar.export_csv')}
              </button>
            </>
          )}
        </div>

        {/* 2. Search / Status (Center) */}
        <div className="ab-group ab-group-center flex-1 flex justify-center items-center gap-md">
          {uiMode === 'select' && (
            <div className="ab-search flex items-center gap-xs">
              <input
                type="text"
                className="ab-search-input"
                placeholder={t('action_bar.search_placeholder')}
                value={addressSearch}
                onChange={(e) => onAddressSearchChange?.(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddressSearchSubmit?.()}
              />
              <button
                className="btn btn-sm ab-search-btn"
                onClick={onAddressSearchSubmit}
                aria-label="Search for address"
              >
                🔍
              </button>
            </div>
          )}

          {/* Global info message */}
          <div className="ab-status">
            {statusMsg || (uiMode === 'select' ? t('action_bar.lock_map_hint') : t('action_bar.locked_map'))}
          </div>
        </div>

        {/* 3. Base Layer (Right) */}
        <div className="ab-group ab-group-right flex items-center gap-sm justify-end">
          <select
            className="ab-base-select"
            value={currentBase}
            onChange={(e) => onBaseChange(e.target.value)}
            aria-label="Map base layer"
          >
            {BASE_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button
            className={`btn btn-sm icon-btn ${showHelp ? 'btn-primary' : ''}`}
            onClick={onHelpToggle}
            title="Toggle Help / Tutorial"
            aria-label="Toggle help"
          >
            💡
          </button>
        </div>
      </div>

      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 400,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ margin: 0, color: '#d32f2f' }}>{t('action_bar.reset_modal_title')}</h3>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              {t('action_bar.reset_modal_desc')}
            </p>
            <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-muted)' }}>
              {t('action_bar.reset_modal_recommend')}
            </p>

            <div
              style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}
            >
              <button className="btn" onClick={() => setShowResetModal(false)}>
                {t('cop_modal.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                💾 {t('action_bar.download_project')}
              </button>
              <button
                className="btn"
                style={{ background: '#d32f2f', color: '#fff', border: 'none' }}
                onClick={() => {
                  resetState();
                  setShowResetModal(false);
                }}
              >
                {t('action_bar.clear_anyway')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

