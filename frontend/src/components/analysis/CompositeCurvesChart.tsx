/** CompositeCurvesChart — hot/cold composite curves via Plotly. */

import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import { pairedTempRange } from './pairedTempRange';
import { formatDe } from '../../utils/numberFormat';

type Curve = { H: number[]; T: number[] };

/** The three regions of the composite curves as full-height bands: where hot
 *  and cold overlap is internal heat recovery; where only the hot curve runs
 *  is heat surplus that needs cooling; where only the cold curve runs is heat
 *  deficit that needs heating. The amount is each band's width on the H axis
 *  (recovery and the minimum utilities), so all three read the same way. */
function regionTraces(
  hot: Curve,
  cold: Curve,
  yRange: [number, number],
  names: { recovery: string; surplus: string; deficit: string }
) {
  if (hot.H.length < 2 || cold.H.length < 2) return [];
  const span = (c: Curve) => [Math.min(...c.H), Math.max(...c.H)];
  const [hotLo, hotHi] = span(hot);
  const [coldLo, coldHi] = span(cold);
  const lo = Math.max(hotLo, coldLo);
  const hi = Math.min(hotHi, coldHi);
  const RECOVERY = 'rgba(46,125,50,0.14)';
  const SURPLUS = 'rgba(220,38,38,0.12)';
  const DEFICIT = 'rgba(37,99,235,0.12)';

  const band = (a: number, b: number, color: string, name: string) =>
    b > a + 1e-9 && {
      x: [a, a, b, b, a],
      y: [yRange[0], yRange[1], yRange[1], yRange[0], yRange[0]],
      fill: 'toself',
      fillcolor: color,
      line: { width: 0 },
      mode: 'lines',
      name: `${name}: ${formatDe(b - a, 1)} kW`,
      hoveron: 'fills',
      hoverinfo: 'name',
    };
  // Each end belongs to whichever curve runs on alone there.
  const end = (hotAlone: boolean) =>
    hotAlone ? ([SURPLUS, names.surplus] as const) : ([DEFICIT, names.deficit] as const);
  return [
    band(Math.min(hotLo, coldLo), lo, ...end(hotLo < coldLo)),
    band(lo, hi, RECOVERY, names.recovery),
    band(hi, Math.max(hotHi, coldHi), ...end(hotHi > coldHi)),
  ].filter(Boolean);
}

export default function CompositeCurvesChart() {
  const { t } = useTranslation();
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const showShifted = useAnalysisStore((s) => s.showShifted);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  if (!pinchResult) return null;

  const diagram = showShifted
    ? pinchResult.shifted_composite_diagram
    : pinchResult.composite_diagram;
  const titleText = showShifted ? t('analysis.charts.shifted_composite_curves') : t('analysis.charts.composite_curves');

  const yRange = pairedTempRange(pinchResult, showShifted);
  const traces: any[] = [
    ...regionTraces(diagram.hot, diagram.cold, yRange, {
      recovery: t('analysis.charts.cc_recovery'),
      surplus: t('analysis.charts.cc_surplus'),
      deficit: t('analysis.charts.cc_deficit'),
    }),
    {
      x: diagram.hot.H,
      y: diagram.hot.T,
      mode: 'lines+markers' as const,
      name: t('analysis.charts.heat_sources'),
      legendrank: 1,
      line: { color: 'red', width: 2 },
      marker: { size: 6 },
    },
    {
      x: diagram.cold.H,
      y: diagram.cold.T,
      mode: 'lines+markers' as const,
      name: t('analysis.charts.heat_sinks'),
      legendrank: 2,
      line: { color: 'blue', width: 2 },
      marker: { size: 6 },
    },
  ];

  const layout: any = {
    title: {
      text: titleText,
      x: 0,
      y: 1.15,
      xanchor: 'left' as const,
      yanchor: 'bottom' as const,
      font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    xaxis: {
      title: { text: t('analysis.charts.enthalpy_flow') },
      automargin: true,
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    yaxis: {
      title: { text: t('analysis.charts.temp') },
      // Shared with the GCC beside it so both pinch lines sit at the same
      // height; see pairedTempRange.
      range: yRange,
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    // Paired side by side in .pa-charts-row — both charts carry the same
    // height so the row keeps a straight baseline.
    height: 600,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 80, r: 30, t: 60, b: 160 },
    // Legend under the x-axis title. The bottom margin is fixed and the same
    // in both charts, so the plot areas and the pinch lines stay level.
    legend: {
      orientation: 'h' as const,
      x: 0.5,
      y: -0.2,
      xanchor: 'center' as const,
      yanchor: 'top' as const,
      font: { size: 11, color: isDark ? '#F8FAFC' : '#1A1C1E' },
      itemwidth: 30,
    },
    hovermode: 'closest' as const,
    shapes: [
      {
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: pinchResult.pinch_temperature,
        y1: pinchResult.pinch_temperature,
        line: { dash: 'dash', color: 'gray', width: 1 },
      },
    ],
    annotations: [
      {
        x: 1,
        xref: 'paper',
        xanchor: 'right',
        y: pinchResult.pinch_temperature,
        text: `${t('analysis.charts.pinch')}${pinchResult.pinch_temperature.toFixed(1)}°C`,
        showarrow: false,
        font: { size: 11, color: isDark ? '#60A5FA' : 'gray' },
      },
    ],
  };

  return (
    <div className="pa-chart" style={{ position: 'relative' }}>
      <ChartHelpButton
        title={titleText}
        description={
          <>
            <p>
              {t('optimization.desc_cc_chart_p1a')}<strong>{t('optimization.desc_cc_chart_p1b')}</strong>{t('optimization.desc_cc_chart_p1c')}
            </p>
            <p>{t('optimization.desc_cc_chart_p2')}</p>
            <p>{t('optimization.desc_cc_chart_p3')}</p>
          </>
        }
      />
      <Plot data={traces} layout={layout} config={{ responsive: true }} style={{ width: '100%' }} />
    </div>
  );
}
