/** StatusQuoComparison — table comparing status quo vs pinch-optimal demands. */

import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import type { HPIResult } from '../../types/analysis';
import ChartHelpButton from '../ui/ChartHelpButton';

export default function StatusQuoComparison() {
  const { t } = useTranslation();
  const statusQuoResult = useAnalysisStore((s) => s.statusQuoResult);
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const hpiResult = useAnalysisStore((s) => s.hpiResult);
  const selectedHPTypes = useAnalysisStore((s) => s.selectedHPTypes);
  const energyDemands = useAnalysisStore((s) => s.energyDemands);

  if (!pinchResult) return null;

  const hasDemands = energyDemands.some((d) => d.heat_demand > 0 || d.cooling_demand > 0);

  if (!hasDemands) {
    return (
      <div className="pa-info-box">
        {t('analysis.tables.status_quo.warning')}
      </div>
    );
  }

  if (!statusQuoResult) return null;

  const {
    total_current_heating,
    total_current_cooling,
    pinch_hot_utility,
    pinch_cold_utility,
    heating_savings_kW,
    cooling_savings_kW,
  } = statusQuoResult;

  const heatPct =
    total_current_heating > 0
      ? `${((Math.abs(heating_savings_kW) / total_current_heating) * 100).toFixed(1)}%`
      : 'N/A';
  const coolPct =
    total_current_cooling > 0
      ? `${((Math.abs(cooling_savings_kW) / total_current_cooling) * 100).toFixed(1)}%`
      : 'N/A';

  // Find best HP for coverage columns
  const bestHP = getBestHP(hpiResult, selectedHPTypes);
  const hpLabel = bestHP ? `${t('analysis.tables.status_quo.hp_cov_kw')} – ${bestHP.name}` : t('analysis.tables.status_quo.hp_cov_kw');
  let hpHeatCov = 'N/A',
    hpCoolCov = 'N/A',
    hpHeatPct = 'N/A',
    hpCoolPct = 'N/A';

  if (bestHP && bestHP.q_sink != null && bestHP.q_source != null) {
    const hCov = Math.min(bestHP.q_sink, pinch_hot_utility);
    const cCov = Math.min(bestHP.q_source, pinch_cold_utility);
    hpHeatCov = hCov.toFixed(1);
    hpCoolCov = cCov.toFixed(1);
    hpHeatPct = pinch_hot_utility > 0 ? `${((hCov / pinch_hot_utility) * 100).toFixed(1)}%` : 'N/A';
    hpCoolPct =
      pinch_cold_utility > 0 ? `${((cCov / pinch_cold_utility) * 100).toFixed(1)}%` : 'N/A';
  }

  return (
    <div className="pa-section">
      <h3 style={{ display: 'flex', alignItems: 'center' }}>
        {t('analysis.tables.status_quo.title')}
        <ChartHelpButton
          inline
          title={t('analysis.tables.status_quo.title')}
          description={t('analysis.tables.status_quo.desc')}
        />
      </h3>
      {/* Seven columns don't fit a phone — scroll the table, not the page. */}
      <div className="scroll-x">
        <table className="pa-table">
          <thead>
            <tr>
              <th>{t('analysis.tables.status_quo.type')}</th>
              <th>{t('analysis.tables.status_quo.current')}</th>
              <th>{t('analysis.tables.status_quo.min')}</th>
              <th>{t('analysis.tables.status_quo.savings_kw')}</th>
              <th>{t('analysis.tables.status_quo.savings_pct')}</th>
              <th>{hpLabel}</th>
              <th>{t('analysis.tables.hp_coverage')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('analysis.tables.status_quo.heating')}</td>
              <td>{total_current_heating.toFixed(1)}</td>
              <td>{pinch_hot_utility.toFixed(1)}</td>
              <td>{heating_savings_kW.toFixed(1)}</td>
              <td>{heatPct}</td>
              <td>{hpHeatCov}</td>
              <td>{hpHeatPct}</td>
            </tr>
            <tr>
              <td>{t('analysis.tables.status_quo.cooling')}</td>
              <td>{total_current_cooling.toFixed(1)}</td>
              <td>{pinch_cold_utility.toFixed(1)}</td>
              <td>{cooling_savings_kW.toFixed(1)}</td>
              <td>{coolPct}</td>
              <td>{hpCoolCov}</td>
              <td>{hpCoolPct}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getBestHP(hpiResult: HPIResult | null, selectedHPTypes: string[]) {
  if (!hpiResult) return null;
  const available = hpiResult.heat_pumps
    .filter((hp) => hp.available)
    .sort((a, b) => (b.cop ?? 0) - (a.cop ?? 0));
  if (selectedHPTypes.length > 0) {
    const sel = available.filter((hp) => selectedHPTypes.includes(hp.name));
    if (sel.length > 0) return sel[0];
  }
  return available[0] ?? null;
}
