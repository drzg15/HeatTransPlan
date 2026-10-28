/** The economic analysis without the UI: inputs, the pump analysed, the result
 *  table, key results, summary text and chart specs. The panel renders it; the
 *  scenario comparison and the HTML report reuse it, so all three agree.
 *  Formulas live in utils/economics.ts. */

import type { TFunction } from 'i18next';
import {
  breakEvenElPrice,
  evaluate,
  referenceCost,
  vdiSpecificCost,
  PAYBACK_HORIZON,
} from '../../utils/economics';
import { formatDe } from '../../utils/numberFormat';
import type { HPIOptimizationResult, OptimizedIntegrationPoint } from '../../types/analysis';
import {
  BOOL_FIELDS,
  FIELDS,
  GREEN,
  GROUPS,
  KPI_COLORS,
  KPI_ROWS,
  RED,
  RESULT_ROWS_ENERGY,
  RESULT_ROWS_MONEY,
  SIGNED_ROWS,
  pointName,
  toInputs,
  type Form,
  type RefType,
} from './econConfig';
import {
  investmentChart,
  npvChart,
  priceChart,
  sensitivityChart,
  sizeChart,
  type ChartCtx,
} from './econCharts';

/** The one pump analysed, so the analysis stays readable however many are
 *  picked: the best of the selection (real machines before archetypes, then
 *  largest heat output, then highest COP). Nothing picked: the default pump, as
 *  the optimization chart shows. */
export const pickPump = (
  selected: OptimizedIntegrationPoint[],
  opt: HPIOptimizationResult | null | undefined
): OptimizedIntegrationPoint | null =>
  selected.length
    ? [...selected].sort(
        (a, b) =>
          Number(a.theoretical) - Number(b.theoretical) || b.Q_demand - a.Q_demand || b.COP - a.COP
      )[0]
    : (opt?.max_q_point ?? null);

/** The numbers alone, no text or charts: what the scenario comparison needs. */
export function econCore(
  form: Form,
  refType: RefType,
  selected: OptimizedIntegrationPoint[],
  opt: HPIOptimizationResult | null | undefined
) {
  const pump = pickPump(selected, opt);
  if (!pump) return null;
  const points = [pump];
  const inp = toInputs(form, refType);
  // The reference supplies the largest demand (and cools the largest source)
  // among the variants, so every pump is compared against the same Ist-Situation.
  const realFeasible = (opt?.feasible_points ?? []).filter((p) => !p.theoretical && p.COP > 0);
  const refPool = [...points, ...(opt?.max_q_point ? [opt.max_q_point] : []), ...realFeasible];
  const refSys = {
    Q: Math.max(...refPool.map((p) => p.Q_demand_total ?? p.Q_demand)),
    Qsrc: Math.max(...refPool.map((p) => p.Q_source)),
  };
  const ref = referenceCost(inp, refSys);
  // Investment and specific investment are one value seen two ways: I = c_spez · Q.
  // Installed price per kW: the heat pump's own price × planning and
  // installation × integration (VDI 4646 eq. 26 factors).
  const specTotal = form.specCost * form.fPI * form.fPer;
  const capexOf = (p: OptimizedIntegrationPoint) => Math.round(specTotal * p.Q_demand);
  const variants = points.map((p) => ({
    Q: p.Q_demand,
    Qsrc: p.Q_source,
    cop: p.COP,
    capex: capexOf(p),
  }));
  const results = variants.map((v) => evaluate(inp, refSys, v));
  const breakEven = variants.map((v) => breakEvenElPrice(inp, refSys, v, inp.pFuel));
  return {
    pump,
    points,
    inp,
    realFeasible,
    refSys,
    ref,
    specTotal,
    capexOf,
    variants,
    results,
    breakEven,
  };
}

/** Everything the panel and the report show: tables, key results, summary and
 *  chart specs (Plotly data + layout). `sensBase` anchors the heatmap window. */
export function buildEconomics(
  t: TFunction,
  form: Form,
  refType: RefType,
  selected: OptimizedIntegrationPoint[],
  opt: HPIOptimizationResult | null | undefined,
  isDark = false,
  sensBase: { fuel: number; el: number } | null = null
) {
  const core = econCore(form, refType, selected, opt);
  if (!core) return null;
  const { points, inp, realFeasible, refSys, ref, capexOf, variants, results, breakEven } = core;
  const fuel = t(`economics.fuel.${refType}`);
  const refName = t(`economics.ref.${refType}`);

  // Units read out: "a" → "years", "/a" → "/year", where there is room.
  const unitLabel = (u: string) =>
    u === 'a' ? t('economics.years') : u.replace(/\/a$/, `/${t('economics.year')}`);

  const paybackText = (k: number | null) =>
    k === null
      ? t('economics.payback_never', { year: form.year + PAYBACK_HORIZON })
      : `${k} ${t('economics.years')} (${form.year + k})`;

  const rows: Array<[string, string, string, string, string[]]> = [
    ['q', t('economics.rows.q'), 'kW', formatDe(refSys.Q), points.map((p) => formatDe(p.Q_demand))],
    [
      'qsrc',
      t('economics.rows.qsrc'),
      'kW',
      formatDe(refSys.Qsrc),
      points.map((p) => formatDe(p.Q_source)),
    ],
    ['cop', 'COP', '-', '–', points.map((p) => formatDe(p.COP, 2))],
    [
      'fuel',
      t('economics.rows.fuel', { fuel }),
      'kWh/a',
      formatDe(ref.fuel),
      results.map((r) => formatDe(r.fuel)),
    ],
    ['el', t('economics.rows.el'), 'kWh/a', '0', results.map((r) => formatDe(r.el))],
    [
      'elCool',
      t('economics.rows.elCool'),
      'kWh/a',
      formatDe(ref.elCool),
      results.map((r) => formatDe(r.elCool)),
    ],
    [
      'opex1',
      t('economics.rows.opex1'),
      '€/a',
      formatDe(ref.opex1),
      results.map((r) => formatDe(r.opex1)),
    ],
    [
      'energy_saving',
      t('economics.rows.energy_saving'),
      'kWh/a',
      '–',
      results.map((r) => formatDe(r.energySaving)),
    ],
    ['saving1', t('economics.rows.saving1'), '€/a', '–', results.map((r) => formatDe(r.saving1))],
    [
      'co2',
      t('economics.rows.co2'),
      't/a',
      formatDe(ref.co2, 1),
      results.map((r) => formatDe(r.co2, 1)),
    ],
    [
      'co2_saving',
      t('economics.rows.co2_saving'),
      't/a',
      '–',
      results.map((r) => formatDe(r.co2Saving, 1)),
    ],
    ['payback', t('economics.rows.payback'), 'a', '–', results.map((r) => paybackText(r.payback))],
    ['residual', t('economics.rows.residual'), '€', '–', results.map((r) => formatDe(r.residual))],
    ['npv', t('economics.rows.npv'), '€', '–', results.map((r) => formatDe(r.npv))],
    [
      'breakeven',
      t('economics.rows.breakeven'),
      'ct/kWh',
      '–',
      breakEven.map((p) => (p === null ? '–' : formatDe(100 * p, 2))),
    ],
    [
      'payback_static',
      t('economics.rows.payback_static'),
      'a',
      '–',
      results.map((r) =>
        r.paybackStatic === null ? t('economics.never') : formatDe(r.paybackStatic, 1)
      ),
    ],
    [
      'irr',
      t('economics.rows.irr'),
      '%',
      '–',
      results.map((r) => (r.irr === null ? '–' : formatDe(100 * r.irr, 1))),
    ],
    [
      'lcoh_hp',
      t('economics.rows.lcoh_hp'),
      'ct/kWh',
      '–',
      results.map((r) => formatDe(100 * r.lcohHp, 2)),
    ],
    [
      'lcoh_ref',
      t('economics.rows.lcoh_ref', { ref: refName }),
      'ct/kWh',
      results[0] ? formatDe(100 * results[0].lcohRef, 2) : '–',
      results.map(() => '–'),
    ],
    [
      'alpha',
      t('economics.rows.alpha'),
      '-',
      '–',
      results.map(
        (r, k) => `${formatDe(r.alpha, 3)} (COP_α ${formatDe(points[k].COP / r.alpha, 2)})`
      ),
    ],
    [
      'spec_total',
      t('economics.rows.spec_total'),
      '€/kW',
      '–',
      points.map(() => formatDe(core.specTotal)),
    ],
    [
      'capex_vdi',
      t('economics.rows.capex_vdi'),
      '€/kW',
      '–',
      points.map((p) => formatDe(vdiSpecificCost(p.Q_demand))),
    ],
  ];

  // Key results of the pump analysed, ready to draw as cards.
  const kpis = KPI_ROWS.map((key) => {
    const [, label, unit, , vals] = rows.find((r) => r[0] === key)!;
    const v = vals[0] ?? '–';
    const signed = SIGNED_ROWS.has(key) && v !== '–';
    // CO₂: the whole period as the headline, the yearly figure underneath.
    const co2 = key === 'co2_saving' && results[0];
    return {
      key,
      label,
      color: KPI_COLORS[key],
      // A loss still shows in red, whatever the card's colour.
      valueColor: signed && v.startsWith('-') ? RED : KPI_COLORS[key],
      value: co2 ? formatDe(results[0].co2Saving * inp.T) : v,
      // The payback text already carries its unit.
      unit: co2
        ? `t ${t('economics.in_years', { T: inp.T })}`
        : key === 'payback'
          ? ''
          : unitLabel(unit),
      sub: co2 ? `= ${v} ${unitLabel(unit)}` : '',
    };
  });

  // Plain-language summary of the pump analysed.
  const summaries = points.map((p, k) => {
    const v = variants[k];
    const r = results[k];
    const be = breakEven[k];
    const coverage = refSys.Q > 0 ? (100 * p.Q_demand) / refSys.Q : 0;
    const eur = (v: number) => `${formatDe(Math.abs(v))} €`;
    const parts = [
      t('economics.summary.coverage', {
        q: formatDe(p.Q_demand),
        qref: formatDe(refSys.Q),
        pct: formatDe(coverage, 0),
        cop: formatDe(p.COP, 2),
        qsrc: formatDe(p.Q_source),
      }),
      coverage < 99.5 ? t('economics.summary.rest', { ref: refName }) : '',
      t('economics.summary.energy', {
        fuelKwh: formatDe(ref.fuel - r.fuel),
        fuel,
        el: formatDe(r.el),
        saving: formatDe(r.energySaving),
        co2: formatDe(r.co2Saving, 1),
      }),
      inp.coolShare > 0
        ? t('economics.summary.cooling', { kwh: formatDe(ref.elCool - r.elCool) })
        : '',
      t(r.saving1 >= 0 ? 'economics.summary.saving_pos' : 'economics.summary.saving_neg', {
        eur: eur(r.saving1),
      }),
      t('economics.summary.invest', { eur: eur(v.capex), funding: form.funding }),
      r.payback === null
        ? t('economics.summary.payback_never', { years: PAYBACK_HORIZON })
        : t('economics.summary.payback', { years: r.payback, year: form.year + r.payback }),
      t(r.npv >= 0 ? 'economics.summary.npv_pos' : 'economics.summary.npv_neg', {
        T: inp.T,
        eur: eur(r.npv),
        rv: eur(r.residual),
      }),
      t('economics.summary.lcoh', {
        hp: formatDe(100 * r.lcohHp, 2),
        refv: formatDe(100 * r.lcohRef, 2),
        ref: refName,
        pp:
          r.paybackStatic === null
            ? t('economics.never')
            : `${formatDe(r.paybackStatic, 1)} ${t('economics.years')}`,
        irr: r.irr === null ? '–' : `${formatDe(100 * r.irr, 1)} %`,
      }),
      be === null || be <= 0
        ? t('economics.summary.be_never', { ref: refName })
        : t('economics.summary.be', {
            pe: formatDe(100 * be, 2),
            fuel,
            pf: formatDe(form.pFuel, 2),
          }),
    ];
    return {
      name: pointName(p),
      good: r.npv >= 0,
      text: parts.filter(Boolean).join(' '),
    };
  });
  // ---- charts ----
  const istName = t('economics.ist', { ref: refName });
  const ctx: ChartCtx = {
    t,
    form,
    inp,
    refSys,
    ref,
    variants,
    results,
    breakEven,
    points,
    realFeasible,
    capexOf,
    isDark,
    sensBase,
    fuel,
    refName,
    istName,
  };
  const bar = investmentChart(ctx);
  const price = priceChart(ctx);
  const { sens, sensExplain } = sensitivityChart(ctx);
  const { size, sizeExplain, sizes } = sizeChart(ctx);
  const npv = npvChart(ctx);

  return {
    ...core,
    fuel,
    refName,
    istName,
    unitLabel,
    rows,
    kpis,
    summaries,
    sensExplain,
    sizeExplain,
    sizes,
    figures: { bar, price, npv, sens, size },
  };
}

/** The economic analysis of one scenario as plain data for the HTML report:
 *  translated labels, formatted values and the chart specs. */
export function econReportData(
  t: TFunction,
  form: Form,
  refType: RefType,
  selected: OptimizedIntegrationPoint[],
  opt: HPIOptimizationResult | null | undefined
) {
  const e = buildEconomics(t, form, refType, selected, opt);
  if (!e) return null;
  const fmtInput = (key: keyof Form) =>
    BOOL_FIELDS.includes(key)
      ? t(form[key] ? 'economics.yes' : 'economics.no')
      : formatDe(form[key], 4, key !== 'year' && key !== 'reinvestYear');
  return {
    title: t('economics.title'),
    pump: pointName(e.pump),
    labels: {
      key: t('economics.blocks.results'),
      inputs: t('economics.report_inputs'),
      results: t('economics.report_results'),
      charts: t('economics.blocks.charts'),
      sensitivity: t('economics.blocks.sensitivity'),
      size: t('economics.blocks.size'),
      summary: t('economics.blocks.summary'),
    },
    kpis: e.kpis,
    inputs: GROUPS.map((g) => ({
      title: t(`economics.groups.${g}`),
      rows: [
        ...(g === 'reference'
          ? [[t('economics.inputs.refType'), t(`economics.ref.${refType}`), '']]
          : []),
        ...FIELDS.filter((f) => f[2] === g).map(([key, unit]) => [
          t(`economics.inputs.${key}`, { fuel: e.fuel }),
          fmtInput(key),
          e.unitLabel(unit),
        ]),
      ],
    })),
    results: [RESULT_ROWS_ENERGY, RESULT_ROWS_MONEY].map((keys, half) => ({
      headers: [
        t(half === 0 ? 'economics.section_energy' : 'economics.section_money'),
        t('economics.unit'),
        e.istName,
        pointName(e.pump),
      ],
      rows: keys
        .map((k) => e.rows.find((r) => r[0] === k)!)
        .filter(Boolean)
        .map(([key, label, unit, ist, vals]) => ({
          cells: [label, e.unitLabel(unit), ist, vals[0]],
          color:
            SIGNED_ROWS.has(key) && vals[0] !== '–' ? (vals[0].startsWith('-') ? RED : GREEN) : '',
        })),
    })),
    sens_explain: e.sensExplain,
    size_explain: e.sizeExplain,
    summary: e.summaries[0],
    figures: [e.figures.bar, e.figures.price, e.figures.npv, e.figures.sens, e.figures.size],
    // Raw numbers for the comparison page.
    numbers: {
      capex: e.variants[0].capex,
      npv: e.results[0].npv,
      saving1: e.results[0].saving1,
      payback: e.results[0].payback,
      co2_saving: e.results[0].co2Saving,
    },
  };
}
