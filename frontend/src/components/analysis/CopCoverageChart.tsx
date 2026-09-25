/** CopCoverageChart — the COP a heat pump achieves against how much of the
 *  sink demand it covers.
 *
 *  A pump placed low on the sink profile serves only the demand above its sink
 *  temperature, so it covers a fraction of the total — but over a small lift,
 *  which is cheap, so its COP is high. Pushing coverage towards 100 % forces
 *  the sink temperature up and the COP down. This chart is that trade-off. */

import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import type { OptimizedIntegrationPoint } from '../../types/analysis';

export default function CopCoverageChart() {
  const { t } = useTranslation();
  const result = useAnalysisStore((s) => s.hpiOptimizationResult);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  if (!result?.feasible_points?.length) return null;

  const points = result.feasible_points;
  // Full coverage is the most any pump on this profile delivers.
  const totalDemand = Math.max(...points.map((p) => p.Q_demand));
  if (!(totalDemand > 0)) return null;

  const coverage = (p: OptimizedIntegrationPoint) => (100 * p.Q_demand) / totalDemand;

  const real = points.filter((p) => !p.theoretical);

  // The frontier: the best COP available at each coverage level. This is the
  // line worth reading — everything below it is dominated.
  const bestAt = new Map<number, OptimizedIntegrationPoint>();
  for (const p of real) {
    // Source- and demand-limited points are partial solutions that sit off the
    // profiles; letting them define the frontier put dips in it where a capped
    // machine was the only thing at that coverage.
    if (p.source_limited || p.demand_limited) continue;
    const bucket = Math.round(coverage(p));
    const existing = bestAt.get(bucket);
    if (!existing || p.COP > existing.COP) bestAt.set(bucket, p);
  }
  const frontier = Array.from(bestAt.entries()).sort((a, b) => a[0] - b[0]);

  // Only the frontier is plotted. The full cloud was thousands of dominated
  // points: for any one of them there is a machine at the same coverage with a
  // better COP, so it says nothing about the trade-off.
  const traces: any[] = [
    {
      x: frontier.map(([c]) => c),
      y: frontier.map(([, p]) => p.COP),
      mode: 'lines+markers' as const,
      line: { color: isDark ? '#3B82F6' : '#2563EB', width: 2 },
      marker: { size: 5, color: isDark ? '#3B82F6' : '#2563EB' },
      name: t('optimization.cop_coverage_best'),
      // Duty and sink temperature ride along so the hover carries all four
      // numbers that describe the point.
      customdata: frontier.map(([, p]) => [p.refrigerant, p.Q_demand, p.T_sink]),
      hovertemplate:
        `<b>%{customdata[0]}</b><br>${t('optimization.cop_coverage_x')}: %{x:.0f} %` +
        `<br>${t('optimization.cop_coverage_q')}: %{customdata[1]:.1f} kW` +
        `<br>${t('optimization.cop_coverage_t')}: %{customdata[2]:.1f} °C` +
        `<br>COP: %{y:.2f}<extra></extra>`,
      showlegend: false,
    },
    // Sink temperature on its own axis: it climbs as coverage grows, and it is
    // the reason the COP falls, so showing both together makes the mechanism
    // visible rather than implied.
    {
      x: frontier.map(([c]) => c),
      y: frontier.map(([, p]) => p.T_sink),
      yaxis: 'y2',
      mode: 'lines' as const,
      line: { color: isDark ? '#F87171' : '#DC2626', width: 1.5, dash: 'dash' as const },
      name: t('optimization.cop_coverage_t'),
      hovertemplate:
        `${t('optimization.cop_coverage_t')}: %{y:.1f} °C<extra></extra>`,
      showlegend: false,
    },
  ];

  // Coverage maps one-to-one onto duty, so the same axis can be labelled in kW
  // underneath the percentage.
  const kwTicks = frontier
    .filter((_, i) => i % Math.max(1, Math.round(frontier.length / 8)) === 0)
    .map(([c, p]) => ({ c, kw: p.Q_demand }));

  const layout: any = {
    title: {
      text: t('optimization.cop_coverage_title'),
      font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    xaxis: {
      title: { text: t('optimization.cop_coverage_x_axis') },
      // Full coverage on the left: reading left to right is then "give up
      // coverage, gain COP", which is the direction of the trade-off.
      range: [105, 0],
      // Each coverage level is a duty, so the tick carries both.
      tickmode: 'array' as const,
      tickvals: kwTicks.map((k) => k.c),
      ticktext: kwTicks.map((k) => `${k.c} %<br>${k.kw.toFixed(0)} kW`),
      automargin: true,
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    yaxis: {
      title: { text: t('optimization.cop_coverage_y_axis') },
      rangemode: 'tozero',
      automargin: true,
      gridcolor: isDark ? '#334155' : '#E2E8F0',
      tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
      titlefont: { color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    yaxis2: {
      title: { text: t('optimization.cop_coverage_t_axis') },
      overlaying: 'y' as const,
      side: 'right' as const,
      automargin: true,
      showgrid: false,
      tickfont: { color: isDark ? '#F87171' : '#DC2626' },
      titlefont: { color: isDark ? '#F87171' : '#DC2626' },
    },
    height: 420,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 70, r: 70, t: 40, b: 80 },
    hovermode: 'closest' as const,
    showlegend: false,
  };

  return (
    <div className="pa-chart" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', right: 0, top: 0, zIndex: 1 }}>
        <ChartHelpButton
          title={t('optimization.cop_coverage_title')}
          size="large"
          description={
            <>
              <p>{t('optimization.cop_coverage_help_1')}</p>
              <p>{t('optimization.cop_coverage_help_2')}</p>
              <p>{t('optimization.cop_coverage_help_3')}</p>
            </>
          }
        />
      </div>
      <Plot data={traces} layout={layout} config={{ responsive: true }} style={{ width: '100%' }} />
    </div>
  );
}
