import { useTranslation } from 'react-i18next';
import Plot from './Plot';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import HPIOptimizationChartHelp from './HPIOptimizationChartHelp';
import { heatPumpSchematic } from './hpSchematic';
import {
  activePointsOf,
  boxPointsOf,
  stackedHoverText,
  thinnedPoints,
} from './optimizationChartPoints';

interface Props {
  originalGCC: { H: number[]; T: number[] };
  pocketlessSource: { H: number[]; T: number[] };
  pocketlessSink: { H: number[]; T: number[] };
  heatCascade: any[];
  feasiblePoints: OptimizedIntegrationPoint[];
  maxQPoint: OptimizedIntegrationPoint | null;
  selectedPoints: OptimizedIntegrationPoint[];
  onSelectPoints: (points: OptimizedIntegrationPoint[]) => void;
  pinchTemperature: number;
  profileMode?: string;
  /** Clicking the heat pump's 💡 opens the heat pump view. */
  onOpenHeatPump?: () => void;
}

export default function HPIOptimizationChart({
  originalGCC,
  pocketlessSource,
  pocketlessSink,
  feasiblePoints,
  maxQPoint,
  selectedPoints,
  onSelectPoints,
  pinchTemperature,
  profileMode = 'net_load',
  onOpenHeatPump,
}: Props) {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  // The profile curves use full-strength red and blue. The heat pump overlay
  // sits on top of them, so it uses muted versions of the same two hues plus a
  // green for electricity — strong enough to read, quiet enough not to fight
  // the curves underneath.
  // The heat pump schematic is the thing being read, so it carries the strong
  // colours; the profiles and the solution cloud underneath are muted so they
  // read as background rather than competing with it.
  // Plain red and blue, the same two the composite and GCC charts use, so a
  // source curve reads as the same thing in every chart on the page.
  const SOURCE_SOFT = 'red';
  const SINK_SOFT = 'blue';
  const EL_SOFT = isDark ? '#10B981' : '#059669';
  const HP_STROKE = isDark ? '#A78BFA' : '#7C3AED';
  const HP_FILL = isDark ? 'rgba(49,46,129,0.75)' : 'rgba(237,233,254,0.95)';

  // Muted versions for the two profile CURVES only — the data points keep the
  // strong colours, since they are what the chart is read for.
  const SOURCE_BG = isDark ? '#7F3F3F' : '#E9A8A8';
  const SINK_BG = isDark ? '#3B5480' : '#A8BFE4';

  const gccH = originalGCC.H || [];
  const gccT = originalGCC.T || [];

  // "With heat recovery" keeps the original view; the other modes mirror the
  // source onto the negative axis (net load profile convention).
  const mirrored = profileMode !== 'net_load';
  const srcSign = mirrored ? -1 : 1;

  const { filteredPoints, theoreticalPoints } = thinnedPoints(
    feasiblePoints,
    selectedPoints,
    maxQPoint
  );
  const stackedHover = stackedHoverText([...filteredPoints, ...theoreticalPoints], t);

  const traces: any[] = [];

  // Trace 1: Original GCC, drawn only where it differs from the profiles below.
  // In net_load the profiles are the pocket-free GCC, so it would just double
  // every line. Its below-pinch branch is mirrored to match the convention.
  for (let i = 0; i < gccH.length - 1; i++) {
    const sign = (t: number) => (mirrored && t <= pinchTemperature ? -1 : 1);
    traces.push({
      x: [sign(gccT[i]) * gccH[i], sign(gccT[i + 1]) * gccH[i + 1]],
      y: [gccT[i], gccT[i + 1]],
      mode: 'lines+markers' as const,
      line: {
        color: isDark ? '#475569' : '#CBD5E1',
        width: mirrored ? 1 : 2,
        dash: mirrored ? 'dot' : undefined,
      },
      marker: { size: 3, color: isDark ? '#475569' : '#CBD5E1' },
      showlegend: false,
      hoverinfo: 'skip',
    });
  }

  // Trace 2: Source profile (red), mirrored onto the negative axis
  if (pocketlessSource?.H?.length > 0) {
    traces.push({
      x: pocketlessSource.H.map((h) => srcSign * h),
      y: pocketlessSource.T,
      mode: 'lines' as const,
      line: { color: SOURCE_BG, width: 3 },
      name: t('analysis.charts.source_profile'),
      // The two profile curves carry the legend; the solution cloud and the
      // heat pump schematic stay out of it to keep the key to two entries.
      showlegend: true,
      hoverinfo: 'skip',
    });
  }

  // Trace 3: Pocketless Sink Curve (blue)
  if (pocketlessSink?.H?.length > 0) {
    traces.push({
      x: pocketlessSink.H,
      y: pocketlessSink.T,
      mode: 'lines' as const,
      line: { color: SINK_BG, width: 3 },
      name: t('analysis.charts.sink_profile'),
      showlegend: true,
      hoverinfo: 'skip',
    });
  }

  // Unique refrigerants to assign colors
  const allRefrigerants = Array.from(new Set(filteredPoints.map((p) => p.refrigerant)));

  allRefrigerants.forEach((refName) => {
    const pointsForRef = filteredPoints.filter((p) => p.refrigerant === refName);

    // Sink Points (plotted exactly mathematically)
    traces.push({
      x: pointsForRef.map((p) => p.Q_demand),
      y: pointsForRef.map((p) => p.T_sink),
      mode: 'markers' as const,
      name: `${refName} - ${t('analysis.charts.sink')}`,
      legendgroup: refName,
      marker: {
        size: 5,
        color: SINK_SOFT,
        // Source-limited points sit off the sink profile and demand-limited ones
        // off the source profile; hollow markers keep both readable as the
        // partial solutions they are.
        symbol: pointsForRef.map((p) =>
          p.source_limited || p.demand_limited ? 'circle-open' : 'circle'
        ),
        opacity: pointsForRef.map((p) => (p.source_limited || p.demand_limited ? 0.45 : 1)),
        line: { width: 1.5, color: SINK_SOFT },
      },
      showlegend: false, // Don't show legend for each refrigerant if colors are the same
      text: pointsForRef.map((p) => stackedHover(p, 'sink')),
      hoverinfo: 'text',
      customdata: pointsForRef, // store original points for onClick
    });

    // Source Points (mirrored onto the negative axis)
    traces.push({
      x: pointsForRef.map((p) => srcSign * ((p.Q_demand * (p.COP - 1)) / p.COP)),
      y: pointsForRef.map((p) => p.T_source),
      mode: 'markers' as const,
      name: `${refName} - ${t('analysis.charts.source')}`,
      legendgroup: refName,
      marker: {
        size: 5,
        color: SOURCE_SOFT,
        symbol: pointsForRef.map((p) =>
          p.source_limited || p.demand_limited ? 'circle-open' : 'circle'
        ),
        opacity: pointsForRef.map((p) => (p.source_limited || p.demand_limited ? 0.45 : 1)),
        line: { width: 1.5, color: SOURCE_SOFT },
      },
      showlegend: false, // Don't duplicate legend
      text: pointsForRef.map((p) => stackedHover(p, 'source')),
      hoverinfo: 'text',
      customdata: pointsForRef,
    });
  });

  // Technology archetypes (Carnot, VHTHP, ...): the same correlations the HPI
  // panel above shows at a single sink temperature, swept across the full grid.
  // Diamonds and a connecting line keep them apart from the refrigerant dots.
  const theoreticalNames = Array.from(new Set(theoreticalPoints.map((p) => p.refrigerant)));

  theoreticalNames.forEach((techName) => {
    const pts = theoreticalPoints
      .filter((p) => p.refrigerant === techName)
      .sort((a, b) => a.T_sink - b.T_sink);
    if (pts.length === 0) return;

    const label = `${techName} (${t('optimization.theoretical')})`;

    // Sink side
    traces.push({
      x: pts.map((p) => p.Q_demand),
      y: pts.map((p) => p.T_sink),
      // Markers only. Joining consecutive archetype points drew a straight
      // line between them, which cut across the pocket the curve goes around —
      // a segment no heat pump operates on. The diamonds are the data.
      mode: 'markers' as const,
      name: `${label} - ${t('analysis.charts.sink')}`,
      legendgroup: `theo_${techName}`,
      // Sink side is blue everywhere on this chart; the diamond, not a third
      // colour, is what marks it as an archetype.
      marker: { size: 7, color: SINK_SOFT, symbol: 'diamond' },
      showlegend: false,
      text: pts.map((p) => stackedHover(p, 'sink')),
      hoverinfo: 'text',
      customdata: pts,
    });

    // Source side, mirrored with the same duty relation the refrigerants use
    traces.push({
      x: pts.map((p) => srcSign * ((p.Q_demand * (p.COP - 1)) / p.COP)),
      y: pts.map((p) => p.T_source),
      mode: 'markers' as const,
      name: `${label} - ${t('analysis.charts.source')}`,
      legendgroup: `theo_${techName}`,
      // Source side is red everywhere on this chart.
      marker: { size: 7, color: SOURCE_SOFT, symbol: 'diamond-open' },
      showlegend: false,
      text: pts.map((p) => stackedHover(p, 'source')),
      hoverinfo: 'text',
      customdata: pts,
    });
  });

  // Trace 3: Selected Points (if any, otherwise maxQ point)
  const activePoints = activePointsOf(maxQPoint, selectedPoints);

  for (const activePoint of activePoints) {
    // Highlight Active Sink
    traces.push({
      x: [activePoint.Q_demand],
      y: [activePoint.T_sink],
      mode: 'markers' as const,
      name: t('analysis.charts.active_sink'),
      showlegend: false,
      marker: {
        size: 9,
        color: SINK_SOFT,
        symbol: 'circle',
        line: { width: 2, color: isDark ? '#FFF' : '#000' },
      },
      text: [
        `<b>${t('ui.active_sink')}</b><br>T: ${activePoint.T_sink.toFixed(1)}°C<br>Q_demand: ${activePoint.Q_demand.toFixed(1)} kW<br>COP: ${activePoint.COP.toFixed(2)}`,
      ],
      hoverinfo: 'text',
    });

    // The old evaporator-to-condenser connector was a single diagonal. The HP
    // box below draws the same link as a right-angled route, so it is gone.

    // Highlight Active Source
    traces.push({
      x: [srcSign * ((activePoint.Q_demand * (activePoint.COP - 1)) / activePoint.COP)],
      y: [activePoint.T_source],
      mode: 'markers' as const,
      name: t('analysis.charts.active_source'),
      showlegend: false,
      marker: {
        size: 9,
        color: SOURCE_SOFT,
        symbol: 'circle',
        line: { width: 2, color: isDark ? '#FFF' : '#000' },
      },
      text: [
        `<b>${t('ui.active_source')}</b><br>T: ${activePoint.T_source.toFixed(1)}°C<br>Q_source: ${((activePoint.Q_demand * (activePoint.COP - 1)) / activePoint.COP).toFixed(1)} kW<br>COP: ${activePoint.COP.toFixed(2)}`,
      ],
      hoverinfo: 'text',
    });
  }
  // --- Heat pump schematic --------------------------------------------------
  const hpBoxShapes: typeof traces = [];
  const hpBoxAnnotations: typeof traces = [];
  const colors = { SOURCE_SOFT, SINK_SOFT, EL_SOFT, HP_STROKE, HP_FILL };
  for (const boxPoint of boxPointsOf(activePoints)) {
    const s = heatPumpSchematic(boxPoint, srcSign, colors, isDark, t);
    hpBoxShapes.push(...s.shapes);
    hpBoxAnnotations.push(...s.annotations);
    traces.push(...s.traces);
  }

  const layout: any = {
    title: {
      text: t('analysis.charts.hpi_optimization'),
      font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    xaxis: {
      title: {
        text: mirrored ? t('analysis.charts.q_source_sink') : t('analysis.charts.net_enthalpy'),
      },
      automargin: true,
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    yaxis: {
      title: { text: t('analysis.charts.shifted_temp') },
      automargin: true,
      rangemode: 'tozero',
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    // Taller than the HPI chart above: this one carries the whole solution
    // cloud plus the archetype curves, which need the vertical room.
    height: 700,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    // Plain axis margin.
    margin: { l: 80, r: 20, t: 40, b: 80 },
    hovermode: 'closest' as const,
    // Same placement as the composite and GCC charts above.
    showlegend: true,
    legend: {
      orientation: 'h' as const,
      x: 1,
      y: 1.02,
      xanchor: 'right' as const,
      yanchor: 'bottom' as const,
      font: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    shapes: [
      // Only the fully cascaded profiles have a pinch.
      ...(profileMode === 'net_load'
        ? [
            {
              type: 'line',
              x0: 0,
              x1: 1,
              xref: 'paper',
              y0: pinchTemperature,
              y1: pinchTemperature,
              line: { dash: 'dash', color: 'gray', width: 1 },
            },
          ]
        : []),
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
      ...hpBoxShapes,
    ],
    annotations:
      profileMode === 'net_load'
        ? [
            {
              x: 1,
              xref: 'paper',
              xanchor: 'right',
              y: pinchTemperature,
              text: `${t('analysis.charts.pinch')}${pinchTemperature.toFixed(1)}°C`,
              showarrow: false,
              font: { size: 11, color: isDark ? '#60A5FA' : 'gray' },
            },
            ...hpBoxAnnotations,
          ]
        : [...hpBoxAnnotations],
  };

  return (
    <div
      className="pa-chart"
      style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end' }}
    >
      <ChartHelpButton
        title={t('ui.opt_solutions')}
        size="large"
        description={<HPIOptimizationChartHelp />}
      />
      <Plot
        data={traces}
        layout={layout}
        config={{ responsive: true }}
        style={{ width: '100%' }}
        onClickAnnotation={(e) => {
          if (e.annotation?.text === '💡') onOpenHeatPump?.();
        }}
        onClick={(data) => {
          if (data.points && data.points.length > 0) {
            const pt = data.points[0];
            const matched = pt.customdata as OptimizedIntegrationPoint | undefined;
            if (matched && matched.refrigerant) {
              // Everything at this sink temperature, archetypes and real
              // machines together — clicking a point is asking "what can run
              // here?", and answering with only one kind hides half of it.
              const pointsAtTemp = [...filteredPoints, ...theoreticalPoints].filter(
                (p) => Math.abs(p.T_sink - matched.T_sink) < 0.01
              );

              // Check if we are toggling off or accumulating
              const isAlreadySelected = selectedPoints.some((sp) => sp.T_sink === matched.T_sink);

              if (isAlreadySelected) {
                // Remove points at this temp
                onSelectPoints(
                  selectedPoints.filter((sp) => Math.abs(sp.T_sink - matched.T_sink) >= 0.01)
                );
              } else {
                // Accumulate points at this temp
                onSelectPoints([...selectedPoints, ...pointsAtTemp]);
              }
            }
          }
        }}
      />
    </div>
  );
}
