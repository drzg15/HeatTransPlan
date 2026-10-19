import { useCallback, useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../store/projectStore';

interface Props {
  reportLoading: boolean;
  onGenerateReport: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
}

/** Save / load the project file, generate the report, toggle the analysis guide. */
export default function HeaderActions({
  reportLoading,
  onGenerateReport,
  showHelp,
  onToggleHelp,
}: Props) {
  const { t } = useTranslation();
  const projectState = useProjectStore((s) => s.state);
  const setState = useProjectStore((s) => s.setState);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSaveProject = useCallback(() => {
    const blob = new Blob([JSON.stringify(projectState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heattransplan_state_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectState]);

  const handleLoadProject = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          setState({ ...data, map_locked: true });
        } catch {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
      if (fileRef.current) fileRef.current.value = '';
    },
    [setState]
  );

  return (
    <div className="pa-header-actions">
      <button className="btn btn-sm" onClick={handleSaveProject} title="Save project to JSON">
        💾 {t('analysis.buttons.save')}
      </button>
      <label className="btn btn-sm" style={{ cursor: 'pointer' }} title="Load project from JSON">
        📂 {t('analysis.buttons.load')}
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleLoadProject}
          style={{ display: 'none' }}
        />
      </label>
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
      <button
        className="pa-btn-report"
        disabled={reportLoading}
        onClick={onGenerateReport}
        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
      >
        {reportLoading
          ? `⏳ ${t('analysis.buttons.generating')}`
          : `📄 ${t('analysis.buttons.report')}`}
      </button>
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
      <button
        className={`btn btn-sm icon-btn ${showHelp ? 'btn-primary' : ''}`}
        onClick={onToggleHelp}
        title="Toggle Analysis Guide"
      >
        💡
      </button>
    </div>
  );
}
