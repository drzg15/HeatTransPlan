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
  // On a steep stretch of the sink profile, tens of degrees of lift cost only
  // a few kW, so dozens of points stack into a near-vertical line at
  // effectively the same power. They are not distinct options — the extra
  // temperature buys no extra duty — and they crowd out the points that do
  // differ. Thin them by duty, keeping the coolest sink temperature in each
  // step: the cheapest lift that delivers that power.
  //
  // The step is in DUTY, so it only bites where duty is barely changing. A
  // shallow stretch spreads its points across many steps and keeps them all.
  const collapseVerticals = (points: OptimizedIntegrationPoint[]) => {
    const qs = points.map((p) => p.Q_demand);
    const span = qs.length ? Math.max(...qs) - Math.min(...qs) : 0;
    if (span <= 0) return points;
    const step = span * 0.02;

    const perBucket = new Map<string, OptimizedIntegrationPoint>();
    for (const pt of points) {
      const key = `${Math.round(pt.Q_demand / step)}_${pt.refrigerant}`;
      const existing = perBucket.get(key);
      // Lowest sink temperature wins; COP breaks an exact tie.
      if (
        !existing ||
        pt.T_sink < existing.T_sink ||
        (pt.T_sink === existing.T_sink && pt.COP > existing.COP)
      ) {
        perBucket.set(key, pt);
      }
    }
    return Array.from(perBucket.values());
  };

  // Active points are drawn as their own markers regardless of thinning, so if
  // thinning drops one it is left standing alone off the line. Keep whatever is
  // active in the cloud it belongs to.
  const activeKeys = new Set(
    (selectedPoints.length > 0 ? selectedPoints : maxQPoint ? [maxQPoint] : []).map(
      (p) => `${p.refrigerant}_${p.T_sink.toFixed(2)}`
    )
  );
  const keepActive = (points: OptimizedIntegrationPoint[], thinned: OptimizedIntegrationPoint[]) => {
    const have = new Set(thinned.map((p) => `${p.refrigerant}_${p.T_sink.toFixed(2)}`));
    const extra = points.filter((p) => {
      const k = `${p.refrigerant}_${p.T_sink.toFixed(2)}`;
      return activeKeys.has(k) && !have.has(k);
    });
    return extra.length ? [...thinned, ...extra] : thinned;
  };

  const bestPointsList = Array.from(bestPointsMap.values());
  const filteredPoints = keepActive(bestPointsList, collapseVerticals(bestPointsList));

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
  // Archetypes stack on a steep profile exactly as the refrigerants do, so they
  // get the same thinning — otherwise the diamonds keep the vertical alive
  // after the dots have been thinned out of it.
  const theoreticalList = Array.from(theoreticalBest.values());
  const theoreticalPoints = keepActive(theoreticalList, collapseVerticals(theoreticalList));

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
        color: SOURCE_SOFT,
        symbol: pointsForRef.map((p) =>
          p.source_limited || p.demand_limited ? 'circle-open' : 'circle'
        ),
        opacity: pointsForRef.map((p) => (p.source_limited || p.demand_limited ? 0.45 : 1)),
        line: { width: 1.5, color: SOURCE_SOFT },
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
      mode: 'markers' as const,
      name: `${label} - ${t('analysis.charts.source')}`,
      legendgroup: `theo_${techName}`,
      // Source side is red everywhere on this chart.
      marker: { size: 7, color: SOURCE_SOFT, symbol: 'diamond-open' },
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
  // The max-Q point is highlighted before anything is clicked. It used to be
  // REPLACED by the first click, so that marker silently shrank back into the
  // cloud — it now stays highlighted alongside the clicked ones.
  const activePoints = (() => {
    const out = maxQPoint ? [maxQPoint] : [];
    for (const sp of selectedPoints) {
      const dup = out.some(
        (p) =>
          p.refrigerant === sp.refrigerant &&
          Math.abs(p.T_sink - sp.T_sink) < 0.01 &&
          Math.abs(p.T_source - sp.T_source) < 0.01
      );
      if (!dup) out.push(sp);
    }
    return out;
  })();

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
        `<b>Active Sink</b><br>T: ${activePoint.T_sink.toFixed(1)}°C<br>Q_demand: ${activePoint.Q_demand.toFixed(1)} kW<br>COP: ${activePoint.COP.toFixed(2)}`,
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
        `<b>Active Source</b><br>T: ${activePoint.T_source.toFixed(1)}°C<br>Q_source: ${((activePoint.Q_demand * (activePoint.COP - 1)) / activePoint.COP).toFixed(1)} kW<br>COP: ${activePoint.COP.toFixed(2)}`,
      ],
      hoverinfo: 'text',
    });
  }

  // --- Heat pump schematic --------------------------------------------------
  // Source and sink can sit 3 kW apart or 1500 kW apart depending on profile
  // mode, so the box is sized in PIXELS and anchored to a data-space point.
  // That keeps it legible at any zoom without ever outgrowing the gap.
  const hpBoxShapes: typeof traces = [];
  const hpBoxAnnotations: typeof traces = [];

  // Only the most recently clicked pump gets a box. A click appends every
  // machine at that sink temperature to the end of the selection, so the last
  // entry's temperature is the one just clicked; the earlier selections stay
  // on the chart as enlarged markers and in the table.
  const lastTemp = activePoints.length
    ? activePoints[activePoints.length - 1].T_sink
    : null;
  const boxPoints =
    lastTemp === null
      ? []
      : (() => {
          const atTemp = activePoints.filter((p) => Math.abs(p.T_sink - lastTemp) < 0.01);
          // The best machine there represents the temperature.
          const best = atTemp.reduce<OptimizedIntegrationPoint | null>(
            (b, p) =>
              !b || p.Q_demand > b.Q_demand || (p.Q_demand === b.Q_demand && p.COP > b.COP)
                ? p
                : b,
            null
          );
          return best ? [best] : [];
        })();

  for (const boxPoint of boxPoints) {
    const srcX = srcSign * ((boxPoint.Q_demand * (boxPoint.COP - 1)) / boxPoint.COP);
    const srcY = boxPoint.T_source;
    const snkX = boxPoint.Q_demand;
    const snkY = boxPoint.T_sink;

    // The box sits on the sink's x, halfway up the lift: the route is then a
    // clean rise-then-across, with no diagonal anywhere.
    const boxX = snkX;
    const boxY = (srcY + snkY) / 2;

    // The box holds two lines (HP + COP), so it needs the extra height.
    const halfW = 30;
    const halfH = 22;

    hpBoxShapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'y',
      xsizemode: 'pixel',
      ysizemode: 'pixel',
      xanchor: boxX,
      yanchor: boxY,
      x0: -halfW,
      x1: halfW,
      y0: -halfH,
      y1: halfH,
      line: { color: HP_STROKE, width: 2 },
      fillcolor: HP_FILL,
      layer: 'above',
    });

    hpBoxAnnotations.push({
      x: boxX,
      y: boxY,
      xref: 'x',
      yref: 'y',
      // The primary box carries its COP, so the headline number is readable
      // without going to the table or hovering.
      text: `<b>HP</b><br>COP ${boxPoint.COP.toFixed(2)}`,
      showarrow: false,
      align: 'center' as const,
      font: { size: 10, color: HP_STROKE },
    });

    // Help marker beside the box. A DOM help button cannot be positioned at a
    // data coordinate, so this is an annotation carrying the explanation on
    // hover. It is an annotation rather than a trace because only annotations
    // support the pixel shift that keeps it clear of the box.
    hpBoxAnnotations.push({
      x: boxX,
      y: boxY,
      xref: 'x',
      yref: 'y',
      xshift: halfW + 12,
      yshift: halfH + 4,
      text: '💡',
      showarrow: false,
      font: { size: 13 },
      captureevents: true,
      hovertext: [
        `<b>${t('optimization.hp_box_title')}</b>`,
        '',
        t('optimization.hp_box_what'),
        '',
        `<b>${Math.abs(srcX).toFixed(1)} kW · ${srcY.toFixed(1)} °C</b> — ${t('optimization.hp_box_source')}`,
        `<b>P<sub>el</sub> ${(snkX - srcX).toFixed(1)} kW</b> — ${t('optimization.hp_box_el')}`,
        `<b>${snkX.toFixed(1)} kW · ${snkY.toFixed(1)} °C</b> — ${t('optimization.hp_box_sink')}`,
        `<b>COP ${boxPoint.COP.toFixed(2)}</b> — ${t('optimization.hp_box_cop')}`,
        '',
        t('optimization.hp_box_balance'),
      ].join('<br>'),
      hoverlabel: { align: 'left' as const, bgcolor: isDark ? '#1E293B' : '#FFF' },
    });

    // Endpoint readouts — duty and temperature at the source and the sink,
    // placed clear of the legs that meet there.
    hpBoxAnnotations.push({
      x: srcX,
      y: srcY,
      xref: 'x',
      yref: 'y',
      text: `${Math.abs(srcX).toFixed(1)} kW<br>${srcY.toFixed(1)} °C`,
      showarrow: false,
      xanchor: 'right' as const,
      yanchor: 'top' as const,
      align: 'right' as const,
      xshift: -8,
      yshift: -2,
      font: { size: 10, color: SOURCE_SOFT },
    });
    hpBoxAnnotations.push({
      x: snkX,
      y: snkY,
      xref: 'x',
      yref: 'y',
      text: `${snkX.toFixed(1)} kW<br>${snkY.toFixed(1)} °C`,
      showarrow: false,
      xanchor: 'left' as const,
      yanchor: 'bottom' as const,
      align: 'left' as const,
      xshift: 8,
      yshift: 2,
      font: { size: 10, color: SINK_SOFT },
    });

    // Source leg: across at the source temperature, then up into the box.
    traces.push({
    x: [srcX, boxX, boxX],
    y: [srcY, srcY, boxY],
    mode: 'lines' as const,
    line: { color: SOURCE_SOFT, width: 2 },
    showlegend: false,
    hoverinfo: 'skip' as const,
    });

    // Sink leg: straight up from the box to the sink point.
    traces.push({
    x: [boxX, snkX],
    y: [boxY, snkY],
    mode: 'lines' as const,
    line: { color: SINK_SOFT, width: 2 },
    showlegend: false,
    hoverinfo: 'skip' as const,
    });

    hpBoxAnnotations.push({
    x: boxX,
    y: snkY,
    ax: boxX,
    ay: snkY - (snkY - boxY) * 0.25,
    xref: 'x',
    yref: 'y',
    axref: 'x',
    ayref: 'y',
    showarrow: true,
    arrowhead: 3,
    arrowsize: 1.4,
    arrowwidth: 2,
    arrowcolor: SINK_SOFT,
    standoff: 8,
    text: '',
    });
    hpBoxAnnotations.push({
    x: boxX,
    y: boxY,
    ax: boxX,
    ay: boxY - (boxY - srcY) * 0.25,
    xref: 'x',
    yref: 'y',
    axref: 'x',
    ayref: 'y',
    showarrow: true,
    arrowhead: 3,
    arrowsize: 1.4,
    arrowwidth: 2,
    arrowcolor: SOURCE_SOFT,
    standoff: halfH + 1,
    text: '',
    });

    // Electrical input enters from the right, clear of the source leg. Only the
    // primary box is labelled — repeating it on every mini box is noise.
    hpBoxAnnotations.push({
      x: boxX,
      y: boxY,
      ax: 52,
      ay: 0,
      xref: 'x',
      yref: 'y',
      axref: 'pixel',
      ayref: 'pixel',
      showarrow: true,
      arrowhead: 3,
      arrowsize: 1.4,
      arrowwidth: 2,
      arrowcolor: EL_SOFT,
      standoff: halfW + 2,
      text: `<b>P<sub>el</sub> ${(snkX - srcX).toFixed(1)} kW</b>`,
      xanchor: 'left',
      font: { size: 10, color: EL_SOFT },
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
