/** PinchMetrics — four metric cards for pinch analysis results. */

import { useAnalysisStore } from '../../store/analysisStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import { useTranslation } from 'react-i18next';

export default function PinchMetrics() {
  const { t } = useTranslation();
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  if (!pinchResult) return null;

  const totalHotDuty = pinchResult.streams_data
    .filter((s) => s.ts > s.tt)
    .reduce((sum, s) => sum + Math.abs(s.cp * (s.tt - s.ts)), 0);
  const heatRecovery = totalHotDuty - pinchResult.hot_utility;

  const cards = [
    {
      key: 'heating',
      label: t('metrics.min_heating'),
      description: t('metrics.min_heating_desc'),
      value: `${pinchResult.hot_utility.toFixed(2)} kW`,
      cls: 'hot',
    },
    {
      key: 'cooling',
      label: t('metrics.min_cooling'),
      description: t('metrics.min_cooling_desc'),
      value: `${pinchResult.cold_utility.toFixed(2)} kW`,
      cls: 'cold',
    },
    {
      key: 'pinch',
      label: t('metrics.pinch_temp'),
      description: t('metrics.pinch_temp_desc'),
      value: `${pinchResult.pinch_temperature.toFixed(1)} °C`,
      cls: 'pinch',
    },
    {
      key: 'recovery',
      label: t('metrics.heat_recovery'),
      description: t('metrics.heat_recovery_desc'),
      value: `${heatRecovery.toFixed(2)} kW`,
      cls: 'recovery',
    },
  ];

  return (
    <div className="pa-metrics-row">
      {cards.map((c) => (
        <div key={c.key} className={`pa-metric-card pa-metric-${c.cls}`}>
          <div
            className="pa-metric-label"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {c.label}
            <ChartHelpButton inline title={c.label} description={c.description} />
          </div>
          <div className="pa-metric-value">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

