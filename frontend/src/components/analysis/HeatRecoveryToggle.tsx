/** How much of the possible heat recovery is credited: the two cases at the
 *  ends, a slider for the share in between. Parts 1 and 2 both follow it. */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import ChartHelpButton from '../ui/ChartHelpButton';

export default function HeatRecoveryToggle() {
  const { t } = useTranslation();
  const pct = useAnalysisStore((s) => s.recoveryPct);
  const setPct = useAnalysisStore((s) => s.setRecoveryPct);
  const busy = useAnalysisStore((s) => s.hpiLoading || s.hpiOptimizationLoading);
  // While dragging only the number moves; the charts update on release.
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? pct;
  const commit = () => {
    if (draft !== null && draft !== pct) setPct(draft);
    setDraft(null);
  };

  const end = (value: number, label: string, hint: string) => (
    <button
      type="button"
      className={`pa-recovery-end${pct === value ? ' active' : ''}`}
      onClick={() => setPct(value)}
      disabled={busy}
      aria-pressed={pct === value}
      title={hint}
    >
      {label}
    </button>
  );

  return (
    <div className="pa-recovery">
      <span className="pa-recovery-title">
        {t('analysis.recovery.title')}
        <ChartHelpButton
          inline
          title={t('analysis.recovery.title')}
          description={t('optimization.desc_hr_toggle')}
        />
      </span>
      {end(0, t('analysis.recovery.no'), t('analysis.recovery.explanation_no'))}
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={shown}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={t('analysis.recovery.pct')}
        className="pa-recovery-slider"
      />
      {end(100, t('analysis.recovery.with'), t('analysis.recovery.explanation_with'))}
      <span className="pa-recovery-pct">{shown} %</span>
    </div>
  );
}
