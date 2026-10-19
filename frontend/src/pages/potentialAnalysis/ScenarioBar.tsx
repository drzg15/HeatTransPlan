import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';

/** The saved scenarios as pills (click to load, double-click to rename) and the save field. */
export default function ScenarioBar() {
  const { t } = useTranslation();
  const scenarios = useAnalysisStore((s) => s.scenarios);
  const activeScenarioId = useAnalysisStore((s) => s.activeScenarioId);
  const saveScenario = useAnalysisStore((s) => s.saveScenario);
  const loadScenario = useAnalysisStore((s) => s.loadScenario);
  const deleteScenario = useAnalysisStore((s) => s.deleteScenario);
  const renameScenario = useAnalysisStore((s) => s.renameScenario);

  const [scenarioName, setScenarioName] = useState('');
  const [editingScenarioIdx, setEditingScenarioIdx] = useState<number | null>(null);

  // Auto-calculated default scenario name
  const defaultScenarioName = `Scenario ${scenarios.length + 1}`;

  const handleSaveScenario = () => {
    saveScenario(scenarioName.trim() || defaultScenarioName);
    setScenarioName('');
  };

  const handleRenameScenario = (idx: number, newName: string) => {
    if (!newName.trim()) return;
    renameScenario(idx, newName.trim());
    setEditingScenarioIdx(null);
  };

  return (
    <div className="pa-scenario-bar">
      <div className="pa-scenario-pills">
        {scenarios.map((scen, idx: number) => {
          const isActive = scen.id === activeScenarioId;
          return (
            <div
              key={scen.id || idx}
              className={`pa-scenario-pill ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: isActive ? 'var(--primary)' : 'var(--bg)',
                color: isActive ? 'var(--text-on-primary)' : 'var(--text-main)',
                border: '1px solid',
                borderColor: isActive ? 'var(--primary-hover)' : 'var(--border)',
                padding: '3px 10px',
                borderRadius: '16px',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {editingScenarioIdx === idx ? (
                <input
                  autoFocus
                  defaultValue={scen.name}
                  onBlur={(e) => handleRenameScenario(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameScenario(idx, e.currentTarget.value);
                    if (e.key === 'Escape') setEditingScenarioIdx(null);
                  }}
                  style={{
                    border: 'none',
                    background: 'var(--bg)',
                    padding: '0 4px',
                    fontSize: 'inherit',
                    width: '80px',
                    color: 'var(--text-main)',
                  }}
                />
              ) : (
                <span
                  style={{ cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => loadScenario(idx)}
                  onDoubleClick={() => setEditingScenarioIdx(idx)}
                  title="Click to load, double-click to rename"
                >
                  {scen.name}
                </span>
              )}
              <button
                className="pa-scenario-delete"
                aria-label={`Delete ${scen.name}`}
                onClick={() => deleteScenario(idx)}
                style={{ color: isActive ? '#bfdbfe' : '#94a3b8' }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="pa-scenario-save">
        <input
          type="text"
          className="pa-scenario-input"
          placeholder={t('analysis.placeholders.scenario_name')}
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveScenario()}
        />
        <button className="pa-scenario-save-btn" onClick={handleSaveScenario}>
          {t('analysis.buttons.save')}
        </button>
      </div>
    </div>
  );
}
