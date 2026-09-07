/** CompositeCurvesChart — hot/cold composite curves via Plotly. */

import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';

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

  const traces: any[] = [
    {
      x: diagram.hot.H,
      y: diagram.hot.T,
      mode: 'lines+markers' as const,
      name: t('analysis.charts.heat_sources'),
      line: { color: 'red', width: 2 },
      marker: { size: 6 },
    },
    {
      x: diagram.cold.H,
      y: diagram.cold.T,
      mode: 'lines+markers' as const,
      name: t('analysis.charts.heat_sinks'),
      line: { color: 'blue', width: 2 },
      marker: { size: 6 },
    },
  ];

  const layout: any = {
    title: { text: titleText, font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' } },
    xaxis: {
      title: { text: 'Enthalpy flow (kW)' },
      automargin: true,
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    yaxis: {
      title: { text: 'Temperature T (°C)' },
      rangemode: 'tozero',
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    height: 400,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 80, r: 30, t: 40, b: 80 },
    legend: {
      x: 0.01,
      y: 0.99,
      xanchor: 'left',
      yanchor: 'top',
      font: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
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
        text: `Pinch: ${pinchResult.pinch_temperature.toFixed(1)}°C`,
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
              The <strong>horizontal overlap</strong> between the Hot (Red) and Cold (Blue) lines
              represents the maximum heat that can be recovered internally.
            </p>
            <p>
              The remaining gaps on the left and right show the external heating and cooling utility
              we still need to provide.
            </p>
            <p>
              The vertical distance between the curves represents the temperature difference driving
              the heat transfer.
            </p>
          </>
        }
      />
      <Plot data={traces} layout={layout} config={{ responsive: true }} style={{ width: '100%' }} />
    </div>
  );
}
