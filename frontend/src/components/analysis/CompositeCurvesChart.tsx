/** CompositeCurvesChart — hot/cold composite curves via Plotly. */

import { useRef } from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import { pairedTempRange } from './pairedTempRange';
import { formatDe } from '../../utils/numberFormat';
import { hAtT, tempUnderMouse, usePinchLink } from '../../store/pinchLinkStore';
import { regionTraces } from './pinchRegions';

export default function CompositeCurvesChart() {
  const { t } = useTranslation();
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const showShifted = useAnalysisStore((s) => s.showShifted);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';
  const gd = useRef<any>(null);
  const { hoverT, region, hidden, setHoverT, setRegion, toggle } = usePinchLink();

  if (!pinchResult) return null;

  const diagram = showShifted
    ? pinchResult.shifted_composite_diagram
    : pinchResult.composite_diagram;
  const titleText = showShifted
    ? t('analysis.charts.shifted_composite_curves')
    : t('analysis.charts.composite_curves');

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
      meta: 'hot',
      legendrank: 1,
      line: { color: 'red', width: 2 },
      marker: { size: 6 },
    },
    {
      x: diagram.cold.H,
      y: diagram.cold.T,
      mode: 'lines+markers' as const,
      name: t('analysis.charts.heat_sinks'),
      meta: 'cold',
      legendrank: 2,
      line: { color: 'blue', width: 2 },
      marker: { size: 6 },
    },
  ].map((tr) => ({
    ...tr,
    // Legend entries switched off here or in the GCC beside it.
    visible: hidden[tr.meta] ? 'legendonly' : true,
    // The area hovered here, on the GCC or on a card stands out.
    ...(tr.meta === region && tr.fillcolor
      ? { fillcolor: tr.fillcolor.replace(/[\d.]+\)$/, '0.35)') }
      : {}),
  }));

  // The temperature hovered in either chart. It is shared on the shifted
  // scale; on real temperatures the hot curve sits ΔTmin/2 above it and the
  // cold curve ΔTmin/2 below, so each gets its own line.
  const half = pinchResult.T_min / 2;
  const hoverLines =
    hoverT === null
      ? []
      : (
          [
            [
              diagram.hot,
              showShifted ? hoverT : hoverT + half,
              '#DC2626',
              t('analysis.charts.cc_hot_at'),
            ],
            [
              diagram.cold,
              showShifted ? hoverT : hoverT - half,
              '#2563EB',
              t('analysis.charts.cc_cold_at'),
            ],
          ] as const
        ).map(([curve, temp, color, label], k) => {
          const h = hAtT(curve.H, curve.T, temp);
          return {
            shape: {
              type: 'line',
              xref: 'paper',
              x0: 0,
              x1: 1,
              y0: temp,
              y1: temp,
              line: { color, width: 1.5, dash: 'dot' },
            },
            note: {
              x: 0,
              xref: 'paper',
              xanchor: 'left',
              y: temp,
              yanchor: k === 0 ? 'bottom' : 'top',
              showarrow: false,
              text: `${formatDe(temp, 1)} °C · ${label}: ${h === null ? '–' : `${formatDe(h, 0)} kW`}`,
              font: { size: 10, color },
              bgcolor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
            },
          };
        });

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
      font: { size: 10, color: isDark ? '#F8FAFC' : '#1A1C1E' },
      itemwidth: 30,
      tracegroupgap: 0,
    },
    hovermode: 'closest' as const,
    shapes: [
      // The pinch line runs on into the right margin, towards the GCC beside
      // it, whose line starts in its left margin: one line across both charts,
      // labelled once on the GCC.
      {
        type: 'line',
        x0: 0,
        x1: 1.2,
        xref: 'paper',
        y0: pinchResult.pinch_temperature,
        y1: pinchResult.pinch_temperature,
        line: { dash: 'dash', color: 'gray', width: 1 },
      },
      ...hoverLines.map((l) => l.shape),
    ],
    annotations: hoverLines.map((l) => l.note),
  };

  return (
    <div
      className="pa-chart"
      style={{ position: 'relative' }}
      onMouseMove={(e) => {
        const temp = tempUnderMouse(gd.current, e.clientY);
        // On real temperatures the mouse is read as a hot-curve temperature.
        setHoverT(temp === null ? null : showShifted ? temp : temp - half);
      }}
      onMouseLeave={() => {
        setHoverT(null);
        setRegion(null);
      }}
    >
      <ChartHelpButton
        title={titleText}
        description={
          <>
            <p>
              {t('optimization.desc_cc_chart_p1a')}
              <strong>{t('optimization.desc_cc_chart_p1b')}</strong>
              {t('optimization.desc_cc_chart_p1c')}
            </p>
            <p>{t('optimization.desc_cc_chart_p2')}</p>
            <p>{t('optimization.desc_cc_chart_p3')}</p>
          </>
        }
      />
      <Plot
        data={traces}
        layout={layout}
        config={{ responsive: true }}
        style={{ width: '100%' }}
        onInitialized={(_, div) => (gd.current = div)}
        onUpdate={(_, div) => (gd.current = div)}
        onHover={(e: any) => {
          const meta = e.points?.[0]?.data?.meta;
          setRegion(['surplus', 'deficit', 'recovery'].includes(meta) ? meta : null);
        }}
        // One legend for both charts: a click switches the entry off in both.
        onLegendClick={(e: any) => {
          toggle(e.data[e.curveNumber].meta);
          return false;
        }}
        onLegendDoubleClick={() => false}
      />
    </div>
  );
}
