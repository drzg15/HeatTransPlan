/** HPIChart — GCC with diamond markers for selected heat pumps. */

import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import ChartHelpButton from '../ui/ChartHelpButton';

const HP_COLORS = [
  '#00CC96',
  '#AB63FA',
  '#FFA15A',
  '#19D3F3',
  '#FF6692',
  '#B6E880',
  '#FF97FF',
  '#FECB52',
];

export default function HPIChart() {
  const hpiResult = useAnalysisStore((s) => s.hpiResult);
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const selectedHPTypes = useAnalysisStore((s) => s.selectedHPTypes);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';
  const isMobile = useIsMobile();

  if (!hpiResult || !pinchResult) return null;

  const gccH = hpiResult.gcc_data.H;
  const gccT = hpiResult.gcc_data.T;

  // GCC segment traces
  const traces: any[] = [];
  const heatCascade = pinchResult.heat_cascade;

  const profileMode = hpiResult.profile_mode ?? 'net_load';
  const usesGCC = profileMode === 'net_load';
  const hasProfiles =
    (hpiResult.source_profile?.H?.length ?? 0) > 0 || (hpiResult.sink_profile?.H?.length ?? 0) > 0;

  // "With heat recovery" keeps the original Grand Composite Curve view. The
  // other modes use the net load profile convention: sink right of zero, source
  // mirrored onto the negative axis, so the heat pump spans the two.
  const mirrored = hasProfiles && !usesGCC;

  // Only the fully cascaded profiles have a pinch.
  const showPinch = usesGCC;

  // In net_load this IS the chart. In the other modes it drops back to a faint
  // reference behind the profiles, with its below-pinch branch mirrored so it
  // follows the same source-left / sink-right convention.
  for (let i = 0; i < gccH.length - 1; i++) {
    let color = 'gray';
    if (i < heatCascade.length) {
      const dh = heatCascade[i].deltaH ?? 0;
      if (dh > 0) color = 'red';
      else if (dh < 0) color = 'blue';
    }
    const sign = (t: number) => (mirrored && t <= pinchResult.pinch_temperature ? -1 : 1);
    traces.push({
      x: [sign(gccT[i]) * gccH[i], sign(gccT[i + 1]) * gccH[i + 1]],
      y: [gccT[i], gccT[i + 1]],
      mode: 'lines+markers' as const,
      line: {
        color: mirrored ? (isDark ? '#475569' : '#CBD5E1') : color,
        width: mirrored ? 1 : 2,
        dash: mirrored ? 'dot' : undefined,
      },
      marker: { size: mirrored ? 3 : 5 },
      showlegend: false,
      customdata: [gccH[i], gccH[i + 1]],
      hovertemplate: mirrored
        ? `GCC (reference)<br>T: %{y:.1f}°C<br>H: %{customdata:.1f} kW<extra></extra>`
        : `T: %{y:.1f}°C<br>H: %{x:.1f} kW<extra></extra>`,
    });
  }

  if (mirrored) {
    const profiles: Array<[{ H: number[]; T: number[] } | undefined, string, string, number]> = [
      [hpiResult.source_profile, 'Source profile', 'red', -1],
      [hpiResult.sink_profile, 'Sink profile', 'blue', 1],
    ];
    for (const [curve, name, color, sign] of profiles) {
      if (!curve || curve.H.length === 0) continue;
      traces.push({
        x: curve.H.map((h) => sign * h),
        y: curve.T,
        mode: 'lines+markers' as const,
        line: { color, width: 2.5 },
        marker: { size: 5 },
        name,
        customdata: curve.H,
        hovertemplate: `${name}<br>T: %{y:.1f}°C<br>Q: %{customdata:.1f} kW<extra></extra>`,
      });
    }
  }

  // Diamond markers for selected HP types
  const feasible = hpiResult.integrations.filter((r) => r.feasible);
  const allHPNames = feasible.map((r) => r.hp_type);
  // An empty selection means every box was unticked, so draw no heat pump —
  // the profiles and the GCC stay. The page auto-selects the first available
  // pump when a result arrives, so an empty selection is always deliberate.
  const displayed = feasible.filter((r) => selectedHPTypes.includes(r.hp_type));

  displayed.forEach((hp) => {
    const globalIdx = allHPNames.indexOf(hp.hp_type);
    const color = HP_COLORS[globalIdx % HP_COLORS.length];
    const hpName = hp.hp_type;

    // Heat pump profile: evaporator on the source side, condenser on the sink
    // side, joined so the lift is readable in one line.
    if (mirrored && hp.source_points.H.length > 0 && hp.sink_points.H.length > 0) {
      traces.push({
        x: [-hp.source_points.H[0], hp.sink_points.H[0]],
        y: [hp.source_points.T[0], hp.sink_points.T[0]],
        mode: 'lines' as const,
        line: { color, width: 2, dash: 'dashdot' },
        name: `${hpName} - HP profile`,
        legendgroup: hpName,
        hoverinfo: 'skip' as const,
      });
    }

    if (hp.source_points.H.length > 0) {
      traces.push({
        x: hp.source_points.H.map((h) => (mirrored ? -h : h)),
        y: hp.source_points.T,
        mode: 'markers' as const,
        marker: {
          size: 12,
          color,
          symbol: 'diamond',
          line: { width: 2, color },
        },
        name: `${hpName} - Source`,
        legendgroup: hpName,
        customdata: hp.source_points.H,
        hovertemplate: `<b>${hpName} - Source</b><br>T: %{y:.1f}°C<br>Q: %{customdata:.1f} kW<br>COP: ${hp.COP?.toFixed(2)}<extra></extra>`,
      });
    }
    if (hp.sink_points.H.length > 0) {
      traces.push({
        x: hp.sink_points.H,
        y: hp.sink_points.T,
        mode: 'markers' as const,
        marker: {
          size: 12,
          color,
          symbol: 'diamond-open',
          line: { width: 2, color },
        },
        name: `${hpName} - Sink`,
        legendgroup: hpName,
        hovertemplate: `<b>${hpName} - Sink</b><br>T: %{y:.1f}°C<br>Q: %{x:.1f} kW<br>COP: ${hp.COP?.toFixed(2)}<extra></extra>`,
      });
    }
  });

  const { t } = useTranslation();

  const titleText = usesGCC
    ? t('analysis.charts.hpi_gcc')
    : profileMode === 'uncascaded'
      ? t('analysis.charts.hpi_partial')
      : t('analysis.charts.hpi_none');

  const layout: any = {
    title: {
      text: titleText,
      font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    xaxis: {
      title: { text: mirrored ? 'Q̇  ← source | sink →  (kW)' : 'Net Enthalpy flow in kW' },
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
    // The desktop layout parks the legend in a 220px gutter left of the plot.
    // A phone is only ~360px wide in total, so that gutter left a 2px plotting
    // area and the curve vanished entirely. Below 900px the legend moves under
    // the plot and the chart grows to make room for it.
    height: isMobile ? 470 : 400,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: isMobile ? { l: 80, r: 15, t: 40, b: 130 } : { l: 220, r: 20, t: 40, b: 80 },
    hovermode: 'closest' as const,
    showlegend: true,
    legend: isMobile
      ? {
          orientation: 'h' as const,
          x: 0,
          y: -0.18,
          xanchor: 'left' as const,
          yanchor: 'top' as const,
          font: { size: 9, color: isDark ? '#F8FAFC' : '#1A1C1E' },
          itemsizing: 'constant' as const,
        }
      : {
          x: -0.15,
          y: 1.0,
          xanchor: 'right' as const,
          yanchor: 'top' as const,
          font: { size: 10, color: isDark ? '#F8FAFC' : '#1A1C1E' },
          itemsizing: 'constant' as const,
        },
    shapes: [
      // The pinch only constrains the integration when the cascade is complete.
      // The uncascaded and composite profiles have no pinch.
      ...(showPinch
        ? [
            {
              type: 'line',
              x0: 0,
              x1: 1,
              xref: 'paper',
              y0: pinchResult.pinch_temperature,
              y1: pinchResult.pinch_temperature,
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
    annotations: showPinch
      ? [
          {
            x: 1,
            xref: 'paper',
            xanchor: 'right',
            y: pinchResult.pinch_temperature,
            text: `Pinch: ${pinchResult.pinch_temperature.toFixed(1)}°C`,
            showarrow: false,
            font: { size: 11, color: isDark ? '#60A5FA' : 'gray' },
          },
        ]
      : [],
  };

  return (
    <div className="pa-chart" style={{ position: 'relative' }}>
      <ChartHelpButton
        title="Heat Pump Integration"
        description={
          <>
            <p>
              Visualizes how a heat pump bridges the temperature gap to lift heat from{' '}
              <strong>below the pinch</strong> (source) to <strong>above the pinch</strong> (sink).
            </p>
            <p>
              The solid diamonds represent the heat pump source, and hollow diamonds represent the
              sink.
            </p>
            <p>Heat pumps reduce both external heating and cooling demands simultaneously.</p>
          </>
        }
      />
      <Plot data={traces} layout={layout} config={{ responsive: true }} style={{ width: '100%' }} />
    </div>
  );
}
