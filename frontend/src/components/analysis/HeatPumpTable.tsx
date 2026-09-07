/** HeatPumpTable — shows available/excluded heat pumps with comparison data. */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import ChartHelpButton from '../ui/ChartHelpButton';

export default function HeatPumpTable() {
  const { t } = useTranslation();
  const hpiResult = useAnalysisStore((s) => s.hpiResult);
  const tMin = useAnalysisStore((s) => s.tMin);
  const [isExcludedOpen, setIsExcludedOpen] = useState(false);
  const [activeCalc, setActiveCalc] = useState<string | null>(null);

  if (!hpiResult) return null;

  const available = hpiResult.heat_pumps.filter((hp) => hp.available);
  const excluded = hpiResult.excluded_heat_pumps;

  if (available.length === 0 && excluded.length === 0) return null;

  return (
    <div className="pa-hp-table-wrap">
      {/* ── Available heat pumps ── */}
      {available.length > 0 && (
        <>
          <p className="pa-hp-section-label"> {t('analysis.tables.integrable_hp')}</p>
          <table className="pa-table pa-hp-table">
            <thead>
              <tr>
                <th>{t('analysis.tables.hp')}</th>
                <th>{t('analysis.tables.cop')}</th>
                <th>
                  Actual Source [°C]
                  <ChartHelpButton
                    title="Actual Source Temp"
                    description="The physical evaporation temperature of the heat pump. (Note: In some specific pocket configurations, this physical temperature may align with the integration temperature)."
                    inline={true}
                  />
                </th>
                <th>
                  Shifted Source (T-{tMin/2}K) [°C]
                  <ChartHelpButton
                    title="Shifted Source Temp"
                    description="The shifted temperature on the Grand Composite Curve (Actual - ΔTmin/2). This is the temperature used for the COP calculation."
                    inline={true}
                  />
                </th>
                <th>
                  Actual Sink [°C]
                  <ChartHelpButton
                    title="Actual Sink Temp"
                    description="The physical condensation temperature of the heat pump. (Note: In some specific pocket configurations, this physical temperature may align with the integration temperature)."
                    inline={true}
                  />
                </th>
                <th>
                  Shifted Sink (T+{tMin/2}K) [°C]
                  <ChartHelpButton
                    title="Shifted Sink Temp"
                    description="The shifted temperature on the Grand Composite Curve (Actual + ΔTmin/2). This is the temperature used for the COP calculation."
                    inline={true}
                  />
                </th>
                <th>{t('analysis.tables.q_source')}</th>
                <th>{t('analysis.tables.q_sink')}</th>
              </tr>
            </thead>
            <tbody>
              {available
                .sort((a, b) => (b.cop ?? 0) - (a.cop ?? 0))
                .map((hp) => (
                  <tr key={hp.name}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {hp.name}
                        {hp.calculation_details && (
                          <ChartHelpButton
                            inline
                            title={`${hp.name} Calculation`}
                            description={
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9em' }}>
                                {hp.calculation_details}
                              </pre>
                            }
                          />
                        )}
                      </div>
                    </td>
                    <td>{hp.cop?.toFixed(2) ?? '—'}</td>
                    <td>{hp.t_source?.toFixed(1) ?? '—'}</td>
                    <td>{hp.t_source != null ? (hp.t_source - tMin/2).toFixed(1) : '—'}</td>
                    <td>{hp.t_sink?.toFixed(1) ?? '—'}</td>
                    <td>{hp.t_sink != null ? (hp.t_sink + tMin/2).toFixed(1) : '—'}</td>
                    <td>{hp.q_source?.toFixed(1) ?? '—'}</td>
                    <td>{hp.q_sink?.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Excluded heat pumps — collapsible, closed by default ── */}
      {excluded.length > 0 && (
        <div className="pa-excluded-hp">
          <p
            className="pa-hp-section-label pa-panel-toggle"
            onClick={() => setIsExcludedOpen(!isExcludedOpen)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span> {t('analysis.tables.excluded_hp')}</span>
            <span
              style={{
                transform: isExcludedOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s',
              }}
            >
              ▼
            </span>
          </p>

          {isExcludedOpen && (
            <div className="pa-excluded-list">
              {excluded.map((hp) => (
                <div key={hp.name} className="pa-excluded-card">
                  <div className="pa-excluded-card-header">
                    <span className="pa-excluded-name">{hp.name}</span>
                    <span className="pa-excluded-badge">{t('analysis.tables.cannot_integrate')}</span>
                  </div>
                  <div className="pa-excluded-reason">{hp.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
