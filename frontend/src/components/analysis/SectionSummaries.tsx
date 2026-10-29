/** Plain-language summaries closing the pinch and heat pump sections: the
 *  numbers above them read out as sentences, like the economic summary. */

import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { formatDe } from '../../utils/numberFormat';
import { gccPockets } from './gccPockets';
import { summaryPoints } from './summaryPoints';

function SummaryBox({ title, sentences }: { title: string; sentences: string[] }) {
  return (
    <div className="pa-summary">
      <h5>{title}</h5>
      <p>{sentences.filter(Boolean).join(' ')}</p>
    </div>
  );
}

export function PinchSummary() {
  const { t } = useTranslation();
  const pinch = useAnalysisStore((s) => s.pinchResult);
  const sq = useAnalysisStore((s) => s.statusQuoResult);
  const recoveryPct = useAnalysisStore((s) => s.recoveryPct);
  if (!pinch) return null;

  // Heat recovered between streams = hot-stream duty minus what is left to cooling.
  const hotDuty = pinch.streams_data
    .filter((s) => s.ts > s.tt)
    .reduce((sum, s) => sum + Math.abs(s.cp * (s.tt - s.ts)), 0);
  const recovery = hotDuty - pinch.cold_utility;
  const T = formatDe(pinch.pinch_temperature, 1);
  const pockets = gccPockets(
    pinch.grand_composite_curve.H,
    pinch.grand_composite_curve.T,
    pinch.pinch_temperature
  ).heat;

  return (
    <SummaryBox
      title={t('summaries.title')}
      sentences={[
        t('summaries.pinch.pinch', {
          dt: formatDe(pinch.T_min, 1),
          T,
          th: formatDe(pinch.pinch_temperature + pinch.T_min / 2, 1),
          tc: formatDe(pinch.pinch_temperature - pinch.T_min / 2, 1),
        }),
        t('summaries.pinch.recovery', {
          hot: formatDe(hotDuty),
          rec: formatDe(Math.max(recovery, 0)),
        }),
        // Each number with the place it shows in the charts above.
        t('summaries.pinch.utilities', {
          qh: formatDe(pinch.hot_utility),
          qc: formatDe(pinch.cold_utility),
        }) + (pockets > 0 ? t('summaries.pinch.pockets', { kw: formatDe(pockets) }) : ''),
        sq
          ? t('summaries.pinch.status_quo', {
              h: formatDe(sq.total_current_heating),
              c: formatDe(sq.total_current_cooling),
              sh: formatDe(sq.heating_savings_kW),
              shp: formatDe(sq.heating_savings_pct, 0),
              sc: formatDe(sq.cooling_savings_kW),
              scp: formatDe(sq.cooling_savings_pct, 0),
            })
          : '',
        // Less than the full recovery chosen: what the cards and charts show then.
        recoveryPct < 100
          ? ((dd) =>
              t('summaries.pinch.partial', {
                p: recoveryPct,
                rec: formatDe(Math.max(recovery - dd, 0)),
                qh: formatDe(pinch.hot_utility + dd),
                qc: formatDe(pinch.cold_utility + dd),
              }))((1 - recoveryPct / 100) * Math.max(recovery, 0))
          : '',
        t('summaries.pinch.rule', { T }),
        t('summaries.pinch.interact'),
      ]}
    />
  );
}

export function HPISummary() {
  const { t } = useTranslation();
  const result = useAnalysisStore((s) => s.hpiOptimizationResult);
  const pinch = useAnalysisStore((s) => s.pinchResult);
  const selected = useAnalysisStore((s) => s.selectedHPPoints);
  if (!result || !pinch) return null;

  const d = result.diagnostics;
  const real = result.feasible_points.filter((p) => !p.theoretical);
  const points = summaryPoints(selected, result.max_q_point);

  const sentences = [
    d
      ? t('summaries.hpi.search', {
          n: formatDe(d.candidates_total),
          m: formatDe(real.length),
          full: formatDe(d.accepted_full),
          src: formatDe(d.accepted_source_limited),
          dem: formatDe(d.accepted_demand_limited ?? 0),
        })
      : t('summaries.hpi.found', { m: formatDe(real.length) }),
    !points.length ? t('summaries.hpi.none') : '',
    ...points.map(({ p, role }) => {
      const pel = p.COP > 0 ? p.Q_demand / p.COP : 0;
      const share = pinch.hot_utility > 0 ? (100 * p.Q_demand) / pinch.hot_utility : 0;
      return [
        t(role === 'selected' ? 'summaries.hpi.point_selected' : 'summaries.hpi.point_default', {
          name: `${p.refrigerant} ${formatDe(p.T_sink, 0)} °C`,
          qsrc: formatDe(p.Q_source),
          ts: formatDe(p.T_source, 1),
          q: formatDe(p.Q_demand),
          tk: formatDe(p.T_sink, 1),
          cop: formatDe(p.COP, 2),
          pel: formatDe(pel),
        }),
        t('summaries.hpi.utilities', {
          pct: formatDe(Math.min(share, 100), 0),
          qh: formatDe(pinch.hot_utility),
          rest: formatDe(Math.max(pinch.hot_utility - p.Q_demand, 0)),
          qsrc: formatDe(p.Q_source),
          qc: formatDe(pinch.cold_utility),
          restc: formatDe(Math.max(pinch.cold_utility - p.Q_source, 0)),
        }),
        p.source_limited ? t('summaries.hpi.source_limited') : '',
        p.demand_limited ? t('summaries.hpi.demand_limited') : '',
      ]
        .filter(Boolean)
        .join(' ');
    }),
    t('summaries.hpi.next'),
  ];

  return <SummaryBox title={t('summaries.title')} sentences={sentences} />;
}
