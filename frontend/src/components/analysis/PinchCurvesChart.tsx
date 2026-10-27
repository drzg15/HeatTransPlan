/** PinchCurvesChart — composite curves (left) and grand composite curve (right)
 *  as one figure on one temperature axis: one pinch line across both, one
 *  legend, and the hovered temperature drawn through both. */

import { useRef } from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import { pairedTempRange } from './pairedTempRange';
import { regionTraces } from './pinchRegions';
import { gccPockets } from './gccPockets';
import { formatDe } from '../../utils/numberFormat';
import { hAtT, shiftedRange, tempUnderMouse, usePinchLink } from '../../store/pinchLinkStore';

const LINKED = ['surplus', 'deficit', 'recovery'];
// Darker text versions of the band colours, for the labels on the chart.
const LABEL_INK: Record<string, string> = {
  surplus: '#1D4ED8',
  deficit: '#B91C1C',
  recovery: '#2E7D32',
};

export default function PinchCurvesChart() {
  const { t } = useTranslation();
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const showShifted = useAnalysisStore((s) => s.showShifted);
  // Without heat recovery the heat pump works on all hot and all cold streams,
  // not on what the GCC leaves over: the right plot then shows those profiles.
  const noRecovery = useAnalysisStore((s) => s.profileMode) === 'composite';
  const isDark = useUIStore((s) => s.theme) === 'dark';
  const gd = useRef<any>(null);
  // Set while the mouse is on the pinch line, so a hover on the band under it
  // does not take the highlight away.
  const onPinch = useRef(false);
  const { hoverT, region, hidden, stream, explain, setHoverT, setRegion, toggle } = usePinchLink();

  if (!pinchResult) return null;

  const ink = isDark ? '#F8FAFC' : '#1A1C1E';
  const muted = isDark ? '#CBD5E1' : '#334155';
  const axis = {
    automargin: true,
    gridcolor: isDark ? '#334155' : '#E2E8F0',
    tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
  };
  const kw = (v: number, d = 1) => `${formatDe(v, d)} kW`;
  const half = pinchResult.T_min / 2;
  const yRange = pairedTempRange(pinchResult, showShifted);
  const ccTitle = showShifted
    ? t('analysis.charts.shifted_composite_curves')
    : t('analysis.charts.composite_curves');
  const gccTitle = t('optimization.title_grand_composite_curve');

  // ---- Left: composite curves, with the recovery, surplus and deficit bands.
  const base = showShifted ? pinchResult.shifted_composite_diagram : pinchResult.composite_diagram;
  // Without heat recovery the cold curve starts where the hot one ends: no
  // overlap, so the bands show all hot heat as surplus and all cold as deficit.
  const diagram = noRecovery
    ? {
        ...base,
        cold: {
          ...base.cold,
          H: base.cold.H.map((h) => h + Math.max(...base.hot.H) - Math.min(...base.cold.H)),
        },
      }
    : base;
  const left: any[] = [
    // The explanations switch takes every marking off, leaving the curves.
    ...(!explain
      ? []
      : regionTraces(diagram.hot, diagram.cold, yRange, {
          recovery: t('analysis.charts.cc_recovery'),
          surplus: t('analysis.charts.cc_surplus'),
          deficit: t('analysis.charts.cc_deficit'),
        })),
    {
      x: diagram.hot.H,
      y: diagram.hot.T,
      mode: 'lines+markers',
      name: t('analysis.charts.heat_sources'),
      meta: 'hot',
      legendrank: 1,
      line: { color: 'red', width: 2 },
      marker: { size: 6 },
    },
    {
      x: diagram.cold.H,
      y: diagram.cold.T,
      mode: 'lines+markers',
      name: t('analysis.charts.heat_sinks'),
      meta: 'cold',
      legendrank: 2,
      line: { color: 'blue', width: 2 },
      marker: { size: 6 },
    },
  ];

  // Each band labelled at its top, inside it; narrow bands get upright text.
  const labels: any[] = [];
  const allH = [...diagram.hot.H, ...diagram.cold.H];
  const spanH = Math.max(...allH) - Math.min(...allH) || 1;
  for (const tr of left)
    if (LINKED.includes(tr.meta) && !hidden[tr.meta]) {
      const [a, b] = [tr.x[0], tr.x[2]];
      const narrow = (b - a) / spanH < 0.25;
      labels.push({
        xref: 'x',
        x: (a + b) / 2,
        yref: 'paper',
        y: 0.99,
        yanchor: 'top',
        xanchor: 'center',
        textangle: narrow ? -90 : 0,
        showarrow: false,
        text: tr.name,
        font: { size: 10, color: LABEL_INK[tr.meta] },
      });
    }

  // ---- Right: grand composite curve, segment by segment so each interval
  // shows whether it has heat to spare (red) or needs heat (blue).
  const gccH = pinchResult.grand_composite_curve.H;
  const gccT = pinchResult.grand_composite_curve.T;
  const right: any[] = [];
  const legendShown = { red: false, blue: false };
  for (let i = 0; i < gccH.length - 1; i++) {
    const dh = pinchResult.heat_cascade[i]?.deltaH ?? 0;
    const color = dh > 0 ? 'red' : dh < 0 ? 'blue' : 'gray';
    const keyed = color === 'gray' ? null : (color as 'red' | 'blue');
    // Only the first segment of a colour carries the legend entry.
    const showThis = keyed !== null && !legendShown[keyed];
    if (keyed) legendShown[keyed] = true;
    right.push({
      x: [gccH[i], gccH[i + 1]],
      y: [gccT[i], gccT[i + 1]],
      mode: 'lines+markers',
      line: { color, width: 2 },
      marker: { size: 6, color },
      name: keyed === 'red' ? t('analysis.charts.gcc_surplus') : t('analysis.charts.gcc_deficit'),
      showlegend: showThis,
      // Every segment of a colour shares the key, so its legend entry hides them all.
      meta: keyed ? `gcc_${keyed}` : undefined,
      legendrank: 3,
      hovertemplate: `T: %{y:.1f}°C<br>ΔH: %{x:.1f} kW<extra></extra>`,
    });
  }

  // Pockets: heat exchanged within the temperature ranges where the curve
  // doubles back. Only a part of the total recovery, so neutral and unlinked.
  const pockets = gccPockets(gccH, gccT, pinchResult.pinch_temperature);
  if (explain && !noRecovery && pockets.heat > 0)
    right.unshift({
      x: pockets.x,
      y: pockets.y,
      fill: 'toself',
      fillcolor: 'rgba(100,116,139,0.3)',
      line: { width: 0 },
      mode: 'lines',
      name: `${t('analysis.charts.gcc_pocket')}: ${kw(pockets.heat)}`,
      hoveron: 'fills',
      hoverinfo: 'name',
      meta: 'pockets',
      legendrank: 4,
    });

  // No heat recovery: the source is every hot stream (heat released below the
  // hottest point, mirrored left of zero as in the optimization chart), the
  // sink every cold stream (heat taken up above the coldest point). Both on
  // shifted temperatures, like the GCC, which stays as a faint reference.
  const sd = pinchResult.shifted_composite_diagram;
  const hotTop = Math.max(...sd.hot.H);
  const coldBottom = Math.min(...sd.cold.H);
  const source = { H: sd.hot.H.map((h) => hotTop - h), T: sd.hot.T };
  const sink = { H: sd.cold.H.map((h) => h - coldBottom), T: sd.cold.T };
  if (noRecovery)
    right.splice(
      0,
      right.length,
      {
        x: gccH,
        y: gccT,
        mode: 'lines',
        line: { color: isDark ? '#64748B' : '#94A3B8', width: 1, dash: 'dot' },
        name: gccTitle,
        hoverinfo: 'skip',
        legendrank: 3,
      },
      {
        x: source.H.map((h) => -h),
        y: source.T,
        mode: 'lines+markers',
        line: { color: 'red', width: 2 },
        marker: { size: 6 },
        name: t('analysis.charts.source_profile'),
        legendrank: 3,
        hovertemplate: `T: %{y:.1f}°C<br>Q: %{customdata:.1f} kW<extra></extra>`,
        customdata: source.H,
      },
      {
        x: sink.H,
        y: sink.T,
        mode: 'lines+markers',
        line: { color: 'blue', width: 2 },
        marker: { size: 6 },
        name: t('analysis.charts.sink_profile'),
        legendrank: 3,
        hovertemplate: `T: %{y:.1f}°C<br>Q: %{x:.1f} kW<extra></extra>`,
      }
    );

  // Where the curve ends: minimum heating at the top, minimum cooling at the
  // bottom, as bars from the axis. They share the bands' keys, so the bands'
  // legend entries cover them and they carry none of their own.
  const byT = gccH.map((h, k) => [h, gccT[k]]).sort((a, b) => a[1] - b[1]);
  if (explain && byT.length > 1) {
    // Without recovery: all heating at the top of the sink, all cooling at the
    // bottom of the source (left of zero).
    const [[hBottom, tBottom], [hTop, tTop]] = noRecovery
      ? [
          [-Math.max(...source.H), Math.min(...source.T)],
          [Math.max(...sink.H), Math.max(...sink.T)],
        ]
      : [byT[0], byT[byT.length - 1]];
    for (const [h, tt, color, name, meta] of [
      [hTop, tTop, 'rgba(220,38,38,0.4)', t('analysis.charts.cc_deficit'), 'deficit'],
      [hBottom, tBottom, 'rgba(37,99,235,0.4)', t('analysis.charts.cc_surplus'), 'surplus'],
    ] as const)
      if (h !== 0) {
        // Written above the top bar and below the bottom one.
        if (!hidden[meta])
          labels.push({
            xref: 'x2',
            x: h / 2,
            y: tt,
            yanchor: meta === 'deficit' ? 'bottom' : 'top',
            yshift: meta === 'deficit' ? 6 : -6,
            showarrow: false,
            text: `${name}: ${kw(Math.abs(h))}`,
            font: { size: 10, color: LABEL_INK[meta] },
          });
        right.push({
          // Points all along the bar: Plotly only reports a hover near a data
          // point, so with just the two ends most of the bar would not react.
          x: Array.from({ length: 41 }, (_, k) => (h * k) / 40),
          y: Array(41).fill(tt),
          mode: 'lines',
          line: { color, width: 10 },
          name: `${name}: ${kw(Math.abs(h))}`,
          hoverinfo: 'name',
          showlegend: false,
          meta,
        });
      }
  }

  // A stream hovered in the stream list: its piece of the hot or cold
  // composite curve drawn over thick, and its temperature range shaded on the
  // GCC (always shifted).
  const streamShapes: any[] = [];
  if (explain && stream) {
    const curve = stream.hot ? diagram.hot : diagram.cold;
    const [sLo, sHi] = shiftedRange(stream, half);
    const [lo, hi] = showShifted
      ? [sLo, sHi]
      : [Math.min(stream.tin, stream.tout), Math.max(stream.tin, stream.tout)];
    const seg = [
      ...curve.H.map((h, k) => [h, curve.T[k]]).filter(([, tt]) => tt > lo && tt < hi),
      ...[lo, hi].map((tt) => [hAtT(curve.H, curve.T, tt), tt]).filter(([h]) => h !== null),
    ].sort((a, b) => (a[1] as number) - (b[1] as number)) as number[][];
    const color = stream.hot ? 'rgba(220,38,38,0.45)' : 'rgba(37,99,235,0.45)';
    if (seg.length > 1) {
      left.push({
        x: seg.map(([h]) => h),
        y: seg.map(([, tt]) => tt),
        mode: 'lines',
        line: { color, width: 9 },
        hoverinfo: 'skip',
        showlegend: false,
      });
      const mid = seg[Math.floor(seg.length / 2)];
      labels.push({
        xref: 'x',
        x: mid[0],
        y: mid[1],
        xanchor: stream.hot ? 'right' : 'left',
        xshift: stream.hot ? -10 : 10,
        showarrow: false,
        text: `<b>${stream.name}</b><br>${formatDe(stream.tin, 1)} → ${formatDe(stream.tout, 1)} °C · ${kw(stream.Q, 0)}`,
        font: { size: 10, color: stream.hot ? '#B91C1C' : '#1D4ED8' },
        bgcolor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)',
      });
    }
    streamShapes.push({
      type: 'rect',
      xref: 'x2 domain',
      x0: 0,
      x1: 1,
      y0: sLo,
      y1: sHi,
      fillcolor: stream.hot ? 'rgba(220,38,38,0.1)' : 'rgba(37,99,235,0.1)',
      line: { width: 0 },
      layer: 'below',
    });
  }

  // Legend entries switched off, and the area hovered here or on a card lit up.
  const traces = [
    ...left.map((tr) => ({ ...tr, xaxis: 'x', yaxis: 'y' })),
    ...right.map((tr) => ({ ...tr, xaxis: 'x2', yaxis: 'y' })),
  ].map((tr) => {
    const lit = tr.meta === region;
    return {
      ...tr,
      visible: hidden[tr.meta] ? 'legendonly' : true,
      ...(lit && tr.fill ? { fillcolor: tr.fillcolor.replace(/[\d.]+\)$/, '0.35)') } : {}),
      ...(lit && !tr.fill && tr.line?.width === 10
        ? { line: { ...tr.line, width: 16, color: tr.line.color.replace('0.4)', '0.8)') } }
        : {}),
    };
  });

  // ---- The hovered temperature, kept on the shifted scale. With shifted
  // temperatures it is one line through both plots; with real ones the hot
  // curve sits ΔTmin/2 above it and the cold curve ΔTmin/2 below, so the left
  // plot gets one line for each.
  const shapes: any[] = [];
  const notes: any[] = [];
  if (explain && hoverT !== null) {
    const line = (xref: string, y: number, color: string) =>
      shapes.push({
        type: 'line',
        xref,
        x0: 0,
        x1: 1,
        y0: y,
        y1: y,
        line: { color, width: 1.5, dash: 'dot' },
      });
    const note = (xref: string, x: number, y: number, color: string, text: string, below = false) =>
      notes.push({
        xref,
        x,
        xanchor: x === 0 ? 'left' : 'right',
        y,
        yanchor: below ? 'top' : 'bottom',
        showarrow: false,
        text,
        font: { size: 10, color },
        bgcolor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
      });
    const hAt = (c: { H: number[]; T: number[] }, temp: number) => {
      const h = hAtT(c.H, c.T, temp);
      return h === null ? '–' : kw(h, 0);
    };
    const gccText = noRecovery
      ? `${t('analysis.charts.source_profile')}: ${hAt(source, hoverT)} · ${t('analysis.charts.sink_profile')}: ${hAt(sink, hoverT)}`
      : `ΔH: ${hAt({ H: gccH, T: gccT }, hoverT)}`;
    if (showShifted) {
      line('paper', hoverT, muted);
      note(
        'x domain',
        0,
        hoverT,
        muted,
        `${formatDe(hoverT, 1)} °C · ${t('analysis.charts.cc_hot_at')}: ${hAt(diagram.hot, hoverT)} · ${t('analysis.charts.cc_cold_at')}: ${hAt(diagram.cold, hoverT)}`
      );
    } else {
      const hotT = hoverT + half;
      const coldT = hoverT - half;
      line('x domain', hotT, '#DC2626');
      line('x domain', coldT, '#2563EB');
      line('x2 domain', hoverT, muted);
      note(
        'x domain',
        0,
        hotT,
        '#DC2626',
        `${formatDe(hotT, 1)} °C · ${t('analysis.charts.cc_hot_at')}: ${hAt(diagram.hot, hotT)}`
      );
      note(
        'x domain',
        0,
        coldT,
        '#2563EB',
        `${formatDe(coldT, 1)} °C · ${t('analysis.charts.cc_cold_at')}: ${hAt(diagram.cold, coldT)}`,
        true
      );
    }
    note('x2 domain', 1, hoverT, muted, `${formatDe(hoverT, 1)} °C · ${gccText}`);
  }

  // The pinch in the purple of its card above.
  const pinchInk = isDark ? '#A855F7' : '#7C3AED';

  const layout: any = {
    height: 600,
    separators: ',.',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 80, r: 30, t: 80, b: 110 },
    hovermode: 'closest',
    xaxis: {
      ...axis,
      domain: [0, 0.48],
      anchor: 'y',
      title: { text: t('analysis.charts.enthalpy_flow'), font: { color: ink } },
    },
    xaxis2: {
      ...axis,
      domain: [0.52, 1],
      anchor: 'y',
      title: {
        text: noRecovery ? t('analysis.charts.profiles_axis') : t('analysis.charts.net_enthalpy'),
        font: { color: ink },
      },
    },
    yaxis: {
      ...axis,
      range: yRange,
      title: { text: t('analysis.charts.temp'), font: { color: ink } },
    },
    legend: {
      orientation: 'h',
      x: 0.5,
      y: -0.15,
      xanchor: 'center',
      yanchor: 'top',
      font: { size: 10, color: ink },
      itemwidth: 30,
    },
    shapes: [
      // One pinch line through both plots.
      {
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        y0: pinchResult.pinch_temperature,
        y1: pinchResult.pinch_temperature,
        line: { dash: 'dash', color: pinchInk, width: region === 'pinch' ? 3 : 1.5 },
      },
      // The arrow from one title to the other: the GCC is what the composite
      // curves leave over. Its head is the annotation below.
      ...(!explain || noRecovery
        ? []
        : [
            {
              type: 'line',
              xref: 'paper',
              yref: 'paper',
              x0: 0.36,
              x1: 0.635,
              y0: 1.05,
              y1: 1.05,
              line: { color: muted, width: 1.5 },
            },
          ]),
      // The GCC's zero line: left of it nothing, the curve's distance from it
      // is the heat flowing through that temperature.
      {
        type: 'line',
        xref: 'x2',
        x0: 0,
        x1: 0,
        yref: 'paper',
        y0: 0,
        y1: 1,
        line: { color: isDark ? '#94A3B8' : 'black', width: 1 },
        opacity: 0.3,
      },
      ...shapes,
      ...streamShapes,
    ],
    annotations: [
      // Plot titles. The GCC is always on shifted temperatures; said so when
      // the composite curves beside it are not.
      ...(
        [
          [0.24, ccTitle],
          [
            0.76,
            ((title) =>
              showShifted ? title : `${title} (${t('analysis.charts.shifted_temp_short')})`)(
              noRecovery ? t('analysis.charts.profiles_no_recovery') : gccTitle
            ),
          ],
        ] as const
      ).map(([x, text]) => ({
        xref: 'paper',
        yref: 'paper',
        x,
        y: 1.02,
        xanchor: 'center',
        yanchor: 'bottom',
        showarrow: false,
        text,
        font: { size: 14, color: ink },
      })),
      ...(!explain || noRecovery
        ? []
        : [
            {
              xref: 'paper',
              yref: 'paper',
              x: 0.64,
              y: 1.05,
              ax: -12,
              ay: 0,
              showarrow: true,
              arrowhead: 2,
              arrowsize: 1.2,
              arrowwidth: 1.5,
              arrowcolor: muted,
              text: '',
            },
            {
              xref: 'paper',
              yref: 'paper',
              x: 0.5,
              y: 1.05,
              yanchor: 'bottom',
              yshift: 2,
              showarrow: false,
              text: t('analysis.charts.cc_to_gcc'),
              hovertext: t('analysis.charts.cc_to_gcc_hint'),
              font: { size: 11, color: muted },
            },
          ]),
      // The pinch, labelled once where the two plots meet.
      {
        xref: 'paper',
        x: 0.5,
        xanchor: 'center',
        y: pinchResult.pinch_temperature,
        yanchor: 'bottom',
        showarrow: false,
        text: `${t('analysis.charts.pinch')}${pinchResult.pinch_temperature.toFixed(1)}°C`,
        font: { size: region === 'pinch' ? 13 : 11, color: pinchInk },
        bgcolor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
      },
      ...labels,
      ...notes,
    ],
  };

  return (
    <div
      className="pa-chart"
      style={{ position: 'relative' }}
      onMouseMove={(e) => {
        const temp = tempUnderMouse(gd.current, e.clientY);
        const fl = gd.current?._fullLayout;
        const x = e.clientX - (gd.current?.getBoundingClientRect().left ?? 0);
        // Left of the GCC on real temperatures: read as a hot-curve temperature.
        const onGcc = fl?.xaxis2 && x >= fl.xaxis2._offset;
        setHoverT(temp === null || !explain ? null : showShifted || onGcc ? temp : temp - half);
        // Within 2 % of the axis of the pinch line: the pinch is what is hovered.
        const near =
          temp !== null &&
          Math.abs(temp - pinchResult.pinch_temperature) < 0.02 * (yRange[1] - yRange[0]);
        if (near) setRegion('pinch');
        else if (onPinch.current) setRegion(null);
        onPinch.current = near;
      }}
      onMouseLeave={() => {
        setHoverT(null);
        setRegion(null);
      }}
    >
      <ChartHelpButton
        title={`${ccTitle} · ${gccTitle}`}
        description={
          <>
            <p>
              {t('optimization.desc_cc_chart_p1a')}
              <strong>{t('optimization.desc_cc_chart_p1b')}</strong>
              {t('optimization.desc_cc_chart_p1c')}
            </p>
            <p>{t('optimization.desc_cc_chart_p2')}</p>
            <p>{t('optimization.desc_cc_chart_p3')}</p>
            <p>
              {t('optimization.desc_gcc_chart_p1a')}
              <strong>{t('optimization.desc_gcc_chart_p1b')}</strong>
              {t('optimization.desc_gcc_chart_p1c')}
            </p>
            <p>{t('optimization.desc_gcc_chart_p2')}</p>
            <p>{t('optimization.desc_gcc_chart_p3')}</p>
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
          if (onPinch.current) return;
          const meta = e.points?.[0]?.data?.meta;
          setRegion(LINKED.includes(meta) ? meta : null);
        }}
        // A legend click hides the area everywhere it is drawn (band and bar).
        onLegendClick={(e: any) => {
          const meta = e.data[e.curveNumber].meta;
          if (meta) toggle(meta);
          return false;
        }}
        onLegendDoubleClick={() => false}
      />
    </div>
  );
}
