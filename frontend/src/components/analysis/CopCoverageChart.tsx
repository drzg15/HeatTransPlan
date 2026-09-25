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
  const theoretical = points.filter((p) => p.theoretical);

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

  const traces: any[] = [
    {
      x: real.map(coverage),
      y: real.map((p) => p.COP),
      mode: 'markers' as const,
      marker: { size: 4, color: isDark ? '#3B5480' : '#A8BFE4' },
      name: t('optimization.cop_coverage_all'),
      hovertemplate:
        `${t('optimization.cop_coverage_x')}: %{x:.0f} %<br>COP: %{y:.2f}<extra></extra>`,
      showlegend: false,
    },
    {
      x: frontier.map(([c]) => c),
      y: frontier.map(([, p]) => p.COP),
      mode: 'lines+markers' as const,
      line: { color: isDark ? '#3B82F6' : '#2563EB', width: 2 },
      marker: { size: 5, color: isDark ? '#3B82F6' : '#2563EB' },
      name: t('optimization.cop_coverage_best'),
      text: frontier.map(([, p]) => p.refrigerant),
      hovertemplate:
        `<b>%{text}</b><br>${t('optimization.cop_coverage_x')}: %{x:.0f} %` +
        `<br>COP: %{y:.2f}<extra></extra>`,
      showlegend: false,
    },
  ];

  if (theoretical.length > 0) {
    traces.push({
      x: theoretical.map(coverage),
      y: theoretical.map((p) => p.COP),
      mode: 'markers' as const,
      marker: {
        size: 6,
        color: isDark ? '#A78BFA' : '#7C3AED',
        symbol: 'diamond-open',
      },
      name: t('optimization.theoretical'),
      text: theoretical.map((p) => p.refrigerant),
      hovertemplate:
        `<b>%{text}</b><br>${t('optimization.cop_coverage_x')}: %{x:.0f} %` +
        `<br>COP: %{y:.2f}<extra></extra>`,
      showlegend: false,
    });
  }

  const layout: any = {
    title: {
      text: t('optimization.cop_coverage_title'),
      font: { size: 14, color: isDark ? '#F8FAFC' : '#1A1C1E' },
    },
    xaxis: {
      title: { text: t('optimization.cop_coverage_x_axis') },
      range: [0, 105],
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
    height: 420,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 70, r: 20, t: 40, b: 70 },
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
