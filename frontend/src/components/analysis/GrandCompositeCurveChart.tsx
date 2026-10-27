/** GrandCompositeCurveChart — color-segmented GCC via Plotly. */

import { useRef } from 'react';
import Plot from 'react-plotly.js';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import { pairedTempRange } from './pairedTempRange';
import { gccPockets } from './gccPockets';
import { formatDe } from '../../utils/numberFormat';
import { useTranslation } from 'react-i18next';
import { hAtT, tempUnderMouse, usePinchLink } from '../../store/pinchLinkStore';

export default function GrandCompositeCurveChart() {
  const { t } = useTranslation();
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  // Same toggle the composite chart reads, so the shared range follows it.
  const showShifted = useAnalysisStore((s) => s.showShifted);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';
  const gd = useRef<any>(null);
  const { hoverT, region, hidden, setHoverT, setRegion, toggle } = usePinchLink();

  if (!pinchResult) return null;

  const gccH = pinchResult.grand_composite_curve.H;
  const gccT = pinchResult.grand_composite_curve.T;
  const heatCascade = pinchResult.heat_cascade;

  // Build one trace per segment for color
  const traces: any[] = [];
  // The curve is drawn segment by segment, so each colour would otherwise
  // appear in the legend once per segment. Let the first segment of each
  // colour carry the entry and silence the rest.
  const legendShown = { red: false, blue: false };
  for (let i = 0; i < gccH.length - 1; i++) {
    let color = 'gray';
    if (i < heatCascade.length) {
      const dh = heatCascade[i].deltaH ?? 0;
      if (dh > 0) color = 'red';
      else if (dh < 0) color = 'blue';
    }
    const keyed = color === 'red' || color === 'blue' ? (color as 'red' | 'blue') : null;
    const showThis = keyed !== null && !legendShown[keyed];
    if (keyed && showThis) legendShown[keyed] = true;
    traces.push({
      x: [gccH[i], gccH[i + 1]],
      y: [gccT[i], gccT[i + 1]],
      mode: 'lines+markers' as const,
      line: { color, width: 2 },
      marker: { size: 6, color },
      // The colour tracks the sign of deltaH in that temperature interval, not
      // which side of the pinch it falls on — red segments appear below the
      // pinch too — so it is labelled as surplus and deficit.
      name:
        keyed === 'red'
          ? t('analysis.charts.gcc_surplus')
          : keyed === 'blue'
            ? t('analysis.charts.gcc_deficit')
            : undefined,
      showlegend: showThis,
      // Every segment of a colour shares the key, so its legend entry hides them all.
      meta: keyed ? `gcc_${keyed}` : undefined,
      legendrank: 1,
      hovertemplate: `T: %{y:.1f}°C<br>ΔH: %{x:.1f} kW<extra></extra>`,
    });
  }

  const kw = (v: number) => `${formatDe(v, 1)} kW`;

  // Pockets: heat exchanged within the temperature ranges where the curve
  // doubles back. Only a part of the total heat recovery (the green band on
  // the composite curves), so it gets its own neutral colour and no link.
  const pockets = gccPockets(gccH, gccT, pinchResult.pinch_temperature);
  if (pockets.heat > 0)
    traces.unshift({
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
      legendrank: 2,
    });

  // Where the curve ends: the heat still to buy at the top (minimum heating)
  // and to cool away at the bottom (minimum cooling), as bars from the axis,
  // coloured like the matching bands on the composite curves.
  const byT = gccH.map((h, k) => [h, gccT[k]]).sort((a, b) => a[1] - b[1]);
  if (byT.length > 1) {
    const [[hBottom, tBottom], [hTop, tTop]] = [byT[0], byT[byT.length - 1]];
    for (const [h, tt, color, name, rank, meta] of [
      [hTop, tTop, 'rgba(37,99,235,0.4)', t('analysis.charts.cc_deficit'), 3, 'deficit'],
      [hBottom, tBottom, 'rgba(220,38,38,0.4)', t('analysis.charts.cc_surplus'), 4, 'surplus'],
    ] as const)
      if (h > 0)
        traces.push({
          // Points all along the bar: Plotly only reports a hover near a data
          // point, so with just the two ends most of the bar would not react.
          x: Array.from({ length: 41 }, (_, k) => (h * k) / 40),
          y: Array(41).fill(tt),
          mode: 'lines',
          line: { color, width: 10 },
          name: `${name}: ${kw(h)}`,
          hoverinfo: 'name',
          meta,
          legendrank: rank,
        });
  }

  // Legend entries switched off here or beside, and the area hovered in
  // either chart or on a card made to stand out.
  const shown = traces.map((tr) => {
    const lit = tr.meta === region;
    return {
      ...tr,
      visible: hidden[tr.meta] ? 'legendonly' : true,
      ...(lit && !tr.fill && tr.line?.width === 10
        ? { line: { ...tr.line, width: 16, color: tr.line.color.replace('0.4)', '0.8)') } }
        : {}),
    };
  });

  // The temperature hovered in either chart, with the net heat flow there.
  const hoverH = hoverT === null ? null : hAtT(gccH, gccT, hoverT);
  const hoverLine =
    hoverT === null
      ? null
      : {
          shape: {
            type: 'line',
            xref: 'paper',
            x0: 0,
            x1: 1,
            y0: hoverT,
            y1: hoverT,
            line: { color: isDark ? '#CBD5E1' : '#334155', width: 1.5, dash: 'dot' },
          },
          note: {
            x: 1,
            xref: 'paper',
            xanchor: 'right',
            y: hoverT,
            yanchor: 'bottom',
            showarrow: false,
            text: `${formatDe(hoverT, 1)} °C · ΔH: ${hoverH === null ? '–' : kw(hoverH)}`,
            font: { size: 10, color: isDark ? '#CBD5E1' : '#334155' },
            bgcolor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
          },
        };

  const layout: any = {
    title: {
      text: t('optimization.title_grand_composite_curve'),
      font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    xaxis: {
      title: { text: t('analysis.charts.net_enthalpy') },
      automargin: true,
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    yaxis: {
      title: { text: t('analysis.charts.shifted_temp') },
      automargin: true,
      // Shared with the composite curves beside it so both pinch lines sit at
      // the same height; see pairedTempRange.
      range: pairedTempRange(pinchResult, showShifted),
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    // Paired side by side in .pa-charts-row — both charts carry the same
    // height so the row keeps a straight baseline.
    height: 600,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    // Matches the composite chart beside it: same margins, same legend
    // placement, so the pair reads as one figure.
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
      // Starts in the left margin, continuing the composite chart's pinch line.
      {
        type: 'line',
        x0: -0.25,
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
      ...(hoverLine ? [hoverLine.shape] : []),
    ],
    // One label for the pinch line across both charts, where they meet.
    annotations: [
      {
        x: 0,
        xref: 'paper',
        xanchor: 'left',
        yanchor: 'bottom',
        y: pinchResult.pinch_temperature,
        text: `${t('analysis.charts.pinch')}${pinchResult.pinch_temperature.toFixed(1)}°C`,
        showarrow: false,
        font: { size: 11, color: isDark ? '#60A5FA' : 'gray' },
      },
      ...(hoverLine ? [hoverLine.note] : []),
    ],
  };

  return (
    <div
      className="pa-chart"
      style={{ position: 'relative' }}
      onMouseMove={(e) => setHoverT(tempUnderMouse(gd.current, e.clientY))}
      onMouseLeave={() => {
        setHoverT(null);
        setRegion(null);
      }}
    >
      <ChartHelpButton
        title={t('optimization.title_grand_composite_curve')}
        description={
          <>
            <p>
              {t('optimization.desc_gcc_chart_p1a')}<strong>{t('optimization.desc_gcc_chart_p1b')}</strong>{t('optimization.desc_gcc_chart_p1c')}
            </p>
            <p>{t('optimization.desc_gcc_chart_p2')}</p>
            <p>{t('optimization.desc_gcc_chart_p3')}</p>
          </>
        }
      />
      <Plot
        data={shown}
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
          const meta = e.data[e.curveNumber].meta;
          if (meta) toggle(meta);
          return false;
        }}
        onLegendDoubleClick={() => false}
      />
    </div>
  );
}
