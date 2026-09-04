/** TemperatureIntervalDiagram — shifted temperature interval diagram via Plotly. */

import Plot from 'react-plotly.js';
import { useAnalysisStore } from '../../store/analysisStore';

export default function TemperatureIntervalDiagram() {
  const pinchResult = useAnalysisStore((s) => s.pinchResult);

  if (!pinchResult) return null;

  const temps = pinchResult.temperatures;
  const pinchStreams = pinchResult.streams_data;

  if (!pinchStreams.length || !temps.length) return null;

  const numStreams = pinchStreams.length;
  const xPositions = pinchStreams.map((_, i) => (i + 1) * 1.0);

  const traces: any[] = [];
  const shapes: any[] = [];
  const annotations: any[] = [];

  // Horizontal temperature lines
  temps.forEach((temperature) => {
    shapes.push({
      type: 'line',
      x0: 0,
      x1: numStreams + 1,
      y0: temperature,
      y1: temperature,
      line: { color: 'gray', width: 1, dash: 'dot' },
    });
  });

  // Pinch temperature line
  shapes.push({
    type: 'line',
    x0: 0,
    x1: numStreams + 1,
    y0: pinchResult.pinch_temperature,
    y1: pinchResult.pinch_temperature,
    line: { color: 'black', width: 2, dash: 'dash' },
  });

  annotations.push({
    x: numStreams + 0.5,
    y: pinchResult.pinch_temperature,
    text: `Pinch: ${pinchResult.pinch_temperature.toFixed(1)}°C`,
    showarrow: false,
    font: { size: 10 },
    xanchor: 'left',
  });

  // Stream arrows
  pinchStreams.forEach((stream, i) => {
    const ss = stream.ss ?? 0;
    const st = stream.st ?? 0;
    const streamType = stream.type;
    const color = streamType === 'HOT' ? 'red' : 'blue';
    const xPos = xPositions[i];

    traces.push({
      x: [xPos, xPos],
      y: [ss, st],
      mode: 'lines' as const,
      line: { color, width: 8 },
      hovertemplate: `<b>S${i + 1}</b><br>Type: ${streamType}<br>T_supply: ${ss.toFixed(1)}°C<br>T_target: ${st.toFixed(1)}°C<br>CP: ${stream.cp.toFixed(2)} kW/K<extra></extra>`,
      showlegend: false,
    });

    // Arrowhead
    annotations.push({
      x: xPos,
      y: st,
      ax: xPos,
      ay: ss,
      xref: 'x',
      yref: 'y',
      axref: 'x',
      ayref: 'y',
      showarrow: true,
      arrowhead: 2,
      arrowsize: 1.5,
      arrowwidth: 3,
      arrowcolor: color,
    });

    // Stream label
    const labelY = Math.max(ss, st) + (Math.max(...temps) - Math.min(...temps)) * 0.03;
    annotations.push({
      x: xPos,
      y: labelY,
      text: `<b>S${i + 1}</b>`,
      showarrow: false,
      font: { size: 11, color: 'white' },
      bgcolor: color,
      bordercolor: 'black',
      borderwidth: 1,
      borderpad: 3,
    });

    // CP label in middle
    const midY = (ss + st) / 2;
    annotations.push({
      x: xPos,
      y: midY,
      text: `CP=${stream.cp.toFixed(1)}`,
      showarrow: false,
      font: { size: 9, color: 'white' },
      textangle: -90,
    });
  });

  const layout: any = {
    title: { text: 'Shifted Temperature Interval Diagram', font: { size: 14 } },
    xaxis: {
      title: 'Streams',
      showticklabels: false,
      range: [0, numStreams + 1],
      showgrid: false,
    },
    yaxis: {
      title: 'Shifted Temperature S (°C)',
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.1)',
    },
    height: 400,
    margin: { l: 60, r: 20, t: 40, b: 40 },
    hovermode: 'closest' as const,
    showlegend: false,
    shapes,
    annotations,
  };

  return (
    <div className="pa-chart">
      <Plot data={traces} layout={layout} config={{ responsive: true }} style={{ width: '100%' }} />
    </div>
  );
}
