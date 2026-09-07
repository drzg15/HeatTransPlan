/** GrandCompositeCurveChart — color-segmented GCC via Plotly. */

import Plot from 'react-plotly.js';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';

export default function GrandCompositeCurveChart() {
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  if (!pinchResult) return null;

  const gccH = pinchResult.grand_composite_curve.H;
  const gccT = pinchResult.grand_composite_curve.T;
  const heatCascade = pinchResult.heat_cascade;

  // Build one trace per segment for color
  const traces: any[] = [];
  for (let i = 0; i < gccH.length - 1; i++) {
    let color = 'gray';
    if (i < heatCascade.length) {
      const dh = heatCascade[i].deltaH ?? 0;
      if (dh > 0) color = 'red';
      else if (dh < 0) color = 'blue';
    }
    traces.push({
      x: [gccH[i], gccH[i + 1]],
      y: [gccT[i], gccT[i + 1]],
      mode: 'lines+markers' as const,
      line: { color, width: 2 },
      marker: { size: 6, color },
      showlegend: false,
      hovertemplate: `T: %{y:.1f}°C<br>ΔH: %{x:.1f} kW<extra></extra>`,
    });
  }

  const layout: any = {
    title: {
      text: 'Grand Composite Curve',
      font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    xaxis: {
      title: { text: 'Net Enthalpy flow in kW' },
      automargin: true,
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    yaxis: {
      title: { text: 'Shifted Temperature in °C' },
      automargin: true,
      rangemode: 'tozero',
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    height: 400,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 80, r: 30, t: 40, b: 80 },
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
      {
        type: 'line',
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: isDark ? '#94A3B8' : 'black', width: 1 },
        opacity: 0.3,
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
        title="Grand Composite Curve"
        description={
          <>
            <p>
              Identifies the <strong>Pinch Point</strong> (the bottleneck where the curve touches
              the Y-axis at Enthalpy = 0).
            </p>
            <p>
              Pockets in the curve (where it moves right then left) show where heat can be cascaded
              internally without external utilities.
            </p>
            <p>
              The top-right and bottom-right edges show the remaining external hot and cold utility
              targets.
            </p>
          </>
        }
      />
      <Plot data={traces} layout={layout} config={{ responsive: true }} style={{ width: '100%' }} />
    </div>
  );
}
