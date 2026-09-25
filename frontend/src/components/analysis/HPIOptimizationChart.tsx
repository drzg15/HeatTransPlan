import { useTranslation } from 'react-i18next';
import Plot from 'react-plotly.js';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import type { OptimizedIntegrationPoint } from '../../types/analysis';

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
}: Props) {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  const gccH = originalGCC.H || [];
  const gccT = originalGCC.T || [];

  // "With heat recovery" keeps the original view; the other modes mirror the
  // source onto the negative axis (net load profile convention).
  const mirrored = profileMode !== 'net_load';
  const srcSign = mirrored ? -1 : 1;

  // Filter feasible points: For each T_sink temperature level and each refrigerant type, keep only the single point with the highest COP
  const bestPointsMap = new Map<string, OptimizedIntegrationPoint>();
  for (const pt of feasiblePoints) {
    if (pt.theoretical) continue;
    // Group by T_sink and refrigerant_type (Natural/Synthetic)
    const key = `${pt.T_sink.toFixed(2)}_${pt.refrigerant_type}`;
    const existing = bestPointsMap.get(key);
    if (!existing || pt.COP > existing.COP) {
      bestPointsMap.set(key, pt);
    }
  }
  const filteredPoints = Array.from(bestPointsMap.values());

  // The technology archetypes are grouped per technology instead, so each keeps
  // its own curve rather than competing with the refrigerants for a T_sink slot.
  const theoreticalBest = new Map<string, OptimizedIntegrationPoint>();
  for (const pt of feasiblePoints) {
    if (!pt.theoretical) continue;
    const key = `${pt.T_sink.toFixed(2)}_${pt.refrigerant}`;
    const existing = theoreticalBest.get(key);
    if (!existing || pt.COP > existing.COP) {
      theoreticalBest.set(key, pt);
    }
  }
  const theoreticalPoints = Array.from(theoreticalBest.values());

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
      line: { color: 'red', width: 3 },
      name: t('analysis.charts.source_profile'),
      showlegend: false,
      hoverinfo: 'skip',
    });
  }

  // Trace 3: Pocketless Sink Curve (blue)
  if (pocketlessSink?.H?.length > 0) {
    traces.push({
      x: pocketlessSink.H,
      y: pocketlessSink.T,
      mode: 'lines' as const,
      line: { color: 'blue', width: 3 },
      name: t('analysis.charts.sink_profile'),
      showlegend: false,
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
        color: 'blue',
        // Source-limited points sit off the sink profile and demand-limited ones
        // off the source profile; hollow markers keep both readable as the
        // partial solutions they are.
        symbol: pointsForRef.map((p) =>
          p.source_limited || p.demand_limited ? 'circle-open' : 'circle'
        ),
        opacity: pointsForRef.map((p) => (p.source_limited || p.demand_limited ? 0.45 : 1)),
        line: { width: 1.5, color: 'blue' },
      },
      showlegend: false, // Don't show legend for each refrigerant if colors are the same
      text: pointsForRef.map(
        (p) =>
          `<b>${refName} - Sink</b><br>T: ${p.T_sink.toFixed(1)}°C<br>Q_demand: ${p.Q_demand.toFixed(1)} kW${p.source_limited && p.Q_demand_total ? ` of ${p.Q_demand_total.toFixed(1)} kW (source-limited)` : ''}<br>COP: ${p.COP.toFixed(2)}`
      ),
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
        color: 'red',
        symbol: pointsForRef.map((p) =>
          p.source_limited || p.demand_limited ? 'circle-open' : 'circle'
        ),
        opacity: pointsForRef.map((p) => (p.source_limited || p.demand_limited ? 0.45 : 1)),
        line: { width: 1.5, color: 'red' },
      },
      showlegend: false, // Don't duplicate legend
      text: pointsForRef.map(
        (p) =>
          `<b>${refName} - Source</b><br>T: ${p.T_source.toFixed(1)}°C<br>Q_source: ${((p.Q_demand * (p.COP - 1)) / p.COP).toFixed(1)} kW<br>COP: ${p.COP.toFixed(2)}${p.demand_limited ? '<br>demand-limited: waste heat left unused at this temperature' : ''}`
      ),
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
      mode: 'lines+markers' as const,
      name: `${label} - ${t('analysis.charts.sink')}`,
      legendgroup: `theo_${techName}`,
      line: { color: isDark ? '#34D399' : '#059669', width: 1, dash: 'dot' as const },
      marker: { size: 7, color: isDark ? '#34D399' : '#059669', symbol: 'diamond' },
      showlegend: false,
      text: pts.map(
        (p) =>
          `<b>${techName} — ${t('optimization.theoretical')}</b><br>T_sink: ${p.T_sink.toFixed(1)}°C<br>Q_sink: ${p.Q_demand.toFixed(1)} kW<br>COP: ${p.COP.toFixed(2)}`
      ),
      hoverinfo: 'text',
      customdata: pts,
    });

    // Source side, mirrored with the same duty relation the refrigerants use
    traces.push({
      x: pts.map((p) => srcSign * ((p.Q_demand * (p.COP - 1)) / p.COP)),
      y: pts.map((p) => p.T_source),
      mode: 'lines+markers' as const,
      name: `${label} - ${t('analysis.charts.source')}`,
      legendgroup: `theo_${techName}`,
      line: { color: isDark ? '#FBBF24' : '#D97706', width: 1, dash: 'dot' as const },
      marker: { size: 7, color: isDark ? '#FBBF24' : '#D97706', symbol: 'diamond-open' },
      showlegend: false,
      text: pts.map(
        (p) =>
          `<b>${techName} — ${t('optimization.theoretical')}</b><br>T_source: ${p.T_source.toFixed(1)}°C<br>Q_source: ${((p.Q_demand * (p.COP - 1)) / p.COP).toFixed(1)} kW<br>COP: ${p.COP.toFixed(2)}`
      ),
      hoverinfo: 'text',
      customdata: pts,
    });
  });

  // Trace 3: Selected Points (if any, otherwise maxQ point)
  const activePoints = selectedPoints.length > 0 ? selectedPoints : maxQPoint ? [maxQPoint] : [];

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
        color: 'blue',
        symbol: 'circle',
        line: { width: 2, color: isDark ? '#FFF' : '#000' },
      },
      text: [
        `<b>Active Sink</b><br>T: ${activePoint.T_sink.toFixed(1)}°C<br>Q_demand: ${activePoint.Q_demand.toFixed(1)} kW<br>COP: ${activePoint.COP.toFixed(2)}`,
      ],
      hoverinfo: 'text',
    });

    // Heat pump profile: evaporator (source side) to condenser (sink side)
    if (mirrored)
      traces.push({
        x: [
          srcSign * ((activePoint.Q_demand * (activePoint.COP - 1)) / activePoint.COP),
          activePoint.Q_demand,
        ],
        y: [activePoint.T_source, activePoint.T_sink],
        mode: 'lines' as const,
        line: { color: isDark ? '#A78BFA' : '#7C3AED', width: 2, dash: 'dashdot' },
        name: t('analysis.charts.hp_profile'),
        showlegend: false,
        hoverinfo: 'skip' as const,
      });

    // Highlight Active Source
    traces.push({
      x: [srcSign * ((activePoint.Q_demand * (activePoint.COP - 1)) / activePoint.COP)],
      y: [activePoint.T_source],
      mode: 'markers' as const,
      name: t('analysis.charts.active_source'),
      showlegend: false,
      marker: {
        size: 9,
        color: 'red',
        symbol: 'circle',
        line: { width: 2, color: isDark ? '#FFF' : '#000' },
      },
      text: [
        `<b>Active Source</b><br>T: ${activePoint.T_source.toFixed(1)}°C<br>Q_source: ${((activePoint.Q_demand * (activePoint.COP - 1)) / activePoint.COP).toFixed(1)} kW<br>COP: ${activePoint.COP.toFixed(2)}`,
      ],
      hoverinfo: 'text',
    });
  }

  const layout: any = {
    title: {
      text: t('analysis.charts.hpi_optimization'),
      font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    xaxis: {
      title: { text: mirrored ? t('analysis.charts.q_source_sink') : t('analysis.charts.net_enthalpy') },
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
    // Matches the HPI chart above so the two plots read as one pair.
    height: 400,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    // Plain axis margin.
    margin: { l: 80, r: 20, t: 40, b: 80 },
    hovermode: 'closest' as const,
    showlegend: false,
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
          ]
        : [],
  };

  return (
    <div
      className="pa-chart"
      style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end' }}
    >
      <ChartHelpButton
        title="Optimization Solutions"
        size="large"
        description={
          <>
            <p>{t('optimization.desc_opt_chart_p1')}</p>
            <p>{t('optimization.desc_opt_chart_p2')}</p>
            <p>{t('optimization.desc_opt_chart_p3')}</p>
            <hr style={{ margin: '8px 0', borderColor: 'var(--border)' }} />
            <p style={{ fontWeight: 600, marginBottom: '4px' }}>{t('optimization.desc_opt_chart_how')}</p>
            <p style={{ fontSize: '0.8rem' }}>
              {t('optimization.desc_opt_chart_blue_1')}<b>{t('optimization.desc_opt_chart_blue_2')}</b>{t('optimization.desc_opt_chart_blue_3')}
              <br/><br/>
              {t('optimization.desc_opt_chart_red_1')}<b>{t('optimization.desc_opt_chart_red_2')}</b>{t('optimization.desc_opt_chart_red_3')}
              <br/><br/>
              {t('optimization.desc_opt_chart_aims_1')}<b>{t('optimization.desc_opt_chart_aims_2')}</b>{t('optimization.desc_opt_chart_aims_3')}
            </p>
            <hr style={{ margin: '8px 0', borderColor: 'var(--border)' }} />
            <p style={{ fontWeight: 600, marginBottom: '4px' }}>{t('optimization.desc_opt_chart_why')}</p>
            <p style={{ fontSize: '0.8rem' }}>
              {t('optimization.desc_opt_chart_off_1')}<b>{t('optimization.desc_opt_chart_off_2')}</b>{t('optimization.desc_opt_chart_off_3')}<i>{t('optimization.desc_opt_chart_off_4')}</i>{t('optimization.desc_opt_chart_off_5')}
              <br/><br/>
              {t('optimization.desc_opt_chart_rest')}
            </p>
          </>
        }
      />
      <Plot
        data={traces}
        layout={layout}
        config={{ responsive: true }}
        style={{ width: '100%' }}
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
