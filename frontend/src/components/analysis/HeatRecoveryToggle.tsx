import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import type { ProfileMode } from '../../types/analysis';
import ChartHelpButton from '../ui/ChartHelpButton';

interface ModeOption {
  mode: ProfileMode;
  label: string;
  short: string;
  description: string;
}

export default function HeatRecoveryToggle() {
  const { t } = useTranslation();
  const profileMode = useAnalysisStore((s) => s.profileMode);
  const setProfileMode = useAnalysisStore((s) => s.setProfileMode);
  const hpiLoading = useAnalysisStore((s) => s.hpiLoading);
  const hpiOptimizationLoading = useAnalysisStore((s) => s.hpiOptimizationLoading);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  const MODES: ModeOption[] = [
    {
      mode: 'net_load',
      label: t('analysis.recovery.with'),
      short: t('analysis.recovery.with_desc'),
      description: t('analysis.recovery.explanation_with'),
    },
    {
      mode: 'composite',
      label: t('analysis.recovery.no'),
      short: t('analysis.recovery.no_desc'),
      description: t('analysis.recovery.explanation_no'),
    },
  ];

  const busy = hpiLoading || hpiOptimizationLoading;
  const active = MODES.find((m) => m.mode === profileMode) ?? MODES[0];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        margin: '0.75rem 0 1.25rem',
        padding: '0.85rem 1rem',
        borderRadius: '8px',
        background: isDark ? '#0F172A' : '#F8FAFC',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: isDark ? '#94A3B8' : '#64748B',
          }}
        >
          {t('analysis.recovery.title')}
        </span>
        <ChartHelpButton
          inline
          title={t('analysis.recovery.title')}
          description={
            'Chooses how much internal heat recovery is credited before the heat pump is placed. ' +
            'It changes the source and sink profiles that both the heat pump integration and the ' +
            'refrigerant optimization run on, and therefore the resulting duties and COPs.'
          }
        />
      </div>

      <div
        role="group"
        aria-label="Heat recovery mode"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
      >
        {MODES.map((opt) => {
          const selected = opt.mode === profileMode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setProfileMode(opt.mode)}
              disabled={busy}
              aria-pressed={selected}
              title={opt.description}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '0.15rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '6px',
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy && !selected ? 0.6 : 1,
                fontWeight: 600,
                fontSize: '0.85rem',
                border: `1px solid ${
                  selected ? (isDark ? '#3B82F6' : '#2563EB') : isDark ? '#475569' : '#CBD5E1'
                }`,
                background: selected
                  ? isDark
                    ? '#1D4ED8'
                    : '#2563EB'
                  : isDark
                    ? '#1E293B'
                    : '#FFF',
                color: selected ? '#FFF' : isDark ? '#F8FAFC' : '#0F172A',
              }}
            >
              {opt.label}
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  opacity: 0.8,
                }}
              >
                {opt.short}
              </span>
            </button>
          );
        })}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: '0.8rem',
          lineHeight: 1.5,
          color: isDark ? '#94A3B8' : '#64748B',
        }}
      >
        {active.description}
      </p>
    </div>
  );
}
