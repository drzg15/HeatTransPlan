/** PinchMetrics — four metric cards for pinch analysis results. */

import { useAnalysisStore } from '../../store/analysisStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import { useTranslation } from 'react-i18next';
import { usePinchLink, type LinkRegion } from '../../store/pinchLinkStore';

// The chart area each card matches: hovering one lights up the others.
const LINKED: Record<string, LinkRegion> = {
  heating: 'deficit',
  cooling: 'surplus',
  recovery: 'recovery',
  pinch: 'pinch',
};

export default function PinchMetrics() {
  const { t } = useTranslation();
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const noRecovery = useAnalysisStore((s) => s.profileMode) === 'composite';
  const region = usePinchLink((s) => s.region);
  const setRegion = usePinchLink((s) => s.setRegion);
  if (!pinchResult) return null;

  const totalHotDuty = pinchResult.streams_data
    .filter((s) => s.ts > s.tt)
    .reduce((sum, s) => sum + Math.abs(s.cp * (s.tt - s.ts)), 0);
  const totalColdDuty = pinchResult.streams_data
    .filter((s) => s.ts < s.tt)
    .reduce((sum, s) => sum + Math.abs(s.cp * (s.tt - s.ts)), 0);
  // Without heat recovery every cold stream is heated and every hot stream
  // cooled from outside; with it, only what the pinch analysis leaves.
  const heating = noRecovery ? totalColdDuty : pinchResult.hot_utility;
  const cooling = noRecovery ? totalHotDuty : pinchResult.cold_utility;
  // What the hot streams give off, less what still has to be cooled away.
  const heatRecovery = totalHotDuty - cooling;

  const cards = [
    {
      key: 'heating',
      label: t('metrics.min_heating'),
      description: t('metrics.min_heating_desc'),
      value: `${heating.toFixed(2)} kW`,
      cls: 'hot',
    },
    {
      key: 'cooling',
      label: t('metrics.min_cooling'),
      description: t('metrics.min_cooling_desc'),
      value: `${cooling.toFixed(2)} kW`,
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
        <div
          key={c.key}
          className={`pa-metric-card pa-metric-${c.cls}${LINKED[c.key] && LINKED[c.key] === region ? ' pa-metric-linked' : ''}`}
          onMouseEnter={() => setRegion(LINKED[c.key] ?? null)}
          onMouseLeave={() => setRegion(null)}
        >
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
