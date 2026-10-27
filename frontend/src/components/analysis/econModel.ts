/** The economic analysis without the UI: inputs, the pump analysed, the result
 *  table, key results, summary text and chart specs. The panel renders it; the
 *  scenario comparison and the HTML report reuse it, so all three agree.
 *  Formulas live in utils/economics.ts. */

import type { TFunction } from 'i18next';
import {
  breakEvenElPrice,
  elPrice,
  evaluate,
  fuelPrice,
  referenceCost,
  vdiSpecificCost,
  PAYBACK_HORIZON,
  type EconInputs,
} from '../../utils/economics';
import { formatDe } from '../../utils/numberFormat';
import type { HPIOptimizationResult, OptimizedIntegrationPoint } from '../../types/analysis';

// Display units: prices in ct/kWh, rates and shares in %.
// Defaults follow VDI 4646 (2026) and VDI 2067 Blatt 1 (2012), except the
// specific investment of the heat pump. Each value, its source page and why
// it may differ: economic_calculation/economic_analysis_rationale.md.
export const DEFAULTS = {
  year: new Date().getFullYear() + 1,
  hours: 6000, // VDI 4646 Tabelle 8: three-shift operation
  i: 12, // VDI 4646 Tabelle 8; companies use 8–12 % (p. 58)
  T: 20, // VDI 4646 p. 58 / VDI 2067 Tabelle 1: heating 20 years
  // Reference heater (gas condensing boiler, VDI 4646 Tabelle 8: η = 0,87 on
  // Hs). The fuel price is per kWh Hs and excludes CO₂, which is costed on Hi.
  eta: 87,
  hsHi: 1.11, // natural gas H: Hs/Hi ≈ 1,11
  pFuel: 6,
  // ⚠ Not VDI 4646 (p. 57: constant prices): 3 %/a, user decision 2026-10-27.
  rFuel: 3,
  co2Fuel: 0.201, // t/MWh on Hi (UBA); VDI 4646 p. 64 uses 202 g/kWh
  co2Price: 55, // BEHG fixed price 2025
  rCo2: 0,
  boilerInvest: 0, // efficiency case: the boiler exists (VDI 4646 Tabelle 8)
  fMaintRef: 3, // VDI 4646 Tabelle 8: f_k gas boiler 3 %
  // Electricity and heat pump.
  pEl: 13,
  rEl: 3, // ⚠ as rFuel
  co2El: 0.352, // UBA 2025, location-based
  co2ElPriced: 0, // 1 = add CO₂ cost on electricity (lecture slide 19); VDI: check if in the price
  pDemand: 0, // only if not already in the electricity price
  // Price of the heat pump itself per kW (equipment). × planning and
  // installation × integration (VDI 4646 Tabelle 6: 1,25 × 1,8) ≈ 855 €/kW,
  // the midpoint of the 200–1.500 €/kW literature range for installed
  // industrial high-temperature heat pumps.
  specCost: 380,
  fPI: 1.25, // VDI 4646 Tabelle 6, p. 59: planning and installation
  fPer: 1.8, // VDI 4646 Tabelle 6, p. 59: system integration (periphery)
  fMaint: 2.5, // VDI 2067 Tabelle A2: f_Inst 1 % + f_W+Insp 1,5 %
  opHours: 5, // VDI 2067 Tabelle A2: 5 h/a operation
  wage: 100, // lecture slide 18: 100 €/h
  reinvestShare: 0,
  reinvestYear: 10,
  life: 20, // VDI 2067 Tabelle A2: water/water heat pump 20 years
  rInv: 0, // constant prices, as the energy prices
  funding: 0,
  // Operating funding (e.g. BEW Modul 4): none by default.
  opFunding: 0,
  opFundingYears: 10,
  // Cooling the pump takes over. 0 % = the source is not actively cooled today
  // (e.g. exhaust air going up the stack), so there is nothing to save.
  coolShare: 0,
  eer: 4,
};
export type Form = typeof DEFAULTS;

// Reference heaters: picking one loads its efficiency, price and CO₂ factor,
// all editable afterwards. The electric boiler's CO₂ is in its electricity
// price, so no CO₂ cost is added on top.
export type RefType = 'gas' | 'oil' | 'eboiler';
// Efficiencies and prices on Hs, CO₂ factors on Hi (see the rationale file).
export const PRESETS: Record<RefType, Pick<Form, 'eta' | 'hsHi' | 'pFuel' | 'co2Fuel'>> = {
  gas: { eta: 87, hsHi: 1.11, pFuel: 6, co2Fuel: 0.201 },
  oil: { eta: 85, hsHi: 1.06, pFuel: 8, co2Fuel: 0.266 },
  eboiler: { eta: 99, hsHi: 1, pFuel: 13, co2Fuel: 0.352 },
};

export type Group =
  'general' | 'reference' | 'electricity' | 'hp' | 'funding' | 'cooling' | 'replace';
export const GROUPS: Group[] = [
  'general',
  'reference',
  'electricity',
  'hp',
  'funding',
  'cooling',
  'replace',
];
// Yes/no inputs, shown as a checkbox and stored as 0 / 1.
export const BOOL_FIELDS: Array<keyof Form> = ['co2ElPriced'];

export type Range = { step: number; min: number; max: number; open?: boolean };

// Inputs: key, unit, the block it sits in, and the step and range of the −/+
// buttons and slider.
// "open" ranges have no natural upper bound: releasing the slider at its end
// doubles the range, so dragging again goes further. Typed values beyond the
// range stretch it too. Physical limits (efficiency, hours, shares) stay closed.
export const FIELDS: Array<[keyof Form, string, Group, Range]> = [
  ['year', 'a', 'general', { step: 1, min: 2025, max: 2045 }],
  ['hours', 'h/a', 'general', { step: 100, min: 0, max: 8760 }],
  ['i', '%', 'general', { step: 0.5, min: 0, max: 15, open: true }],
  ['T', 'a', 'general', { step: 1, min: 1, max: 40, open: true }],
  ['eta', '%', 'reference', { step: 1, min: 50, max: 100 }],
  ['hsHi', '-', 'reference', { step: 0.01, min: 1, max: 1.2 }],
  ['pFuel', 'ct/kWh', 'reference', { step: 0.5, min: 0, max: 30, open: true }],
  ['rFuel', '%/a', 'reference', { step: 0.5, min: -5, max: 10, open: true }],
  ['co2Fuel', 't/MWh', 'reference', { step: 0.001, min: 0, max: 0.4 }],
  ['co2Price', '€/t', 'reference', { step: 5, min: 0, max: 300, open: true }],
  ['rCo2', '%/a', 'reference', { step: 0.5, min: -5, max: 15, open: true }],
  ['pEl', 'ct/kWh', 'electricity', { step: 0.5, min: 0, max: 40, open: true }],
  ['rEl', '%/a', 'electricity', { step: 0.5, min: -5, max: 10, open: true }],
  ['co2El', 't/MWh', 'electricity', { step: 0.01, min: 0, max: 1 }],
  ['co2ElPriced', '-', 'electricity', { step: 1, min: 0, max: 1 }],
  ['pDemand', '€/kW/a', 'hp', { step: 10, min: 0, max: 300, open: true }],
  ['specCost', '€/kW', 'hp', { step: 10, min: 0, max: 1500, open: true }],
  ['fPI', '-', 'hp', { step: 0.05, min: 1, max: 3, open: true }],
  ['fPer', '-', 'hp', { step: 0.05, min: 1, max: 3, open: true }],
  ['fMaint', '%/a', 'hp', { step: 0.5, min: 0, max: 10, open: true }],
  ['opHours', 'h/a', 'hp', { step: 1, min: 0, max: 100, open: true }],
  ['wage', '€/h', 'hp', { step: 5, min: 0, max: 200, open: true }],
  ['reinvestShare', '%', 'hp', { step: 5, min: 0, max: 100 }],
  ['reinvestYear', 'a', 'hp', { step: 1, min: 1, max: 40, open: true }],
  ['life', 'a', 'hp', { step: 1, min: 0, max: 50, open: true }],
  ['rInv', '%/a', 'hp', { step: 0.5, min: -5, max: 10, open: true }],
  ['funding', '%', 'hp', { step: 5, min: 0, max: 100 }],
  ['opFunding', '€/MWh', 'funding', { step: 5, min: 0, max: 100, open: true }],
  ['opFundingYears', 'a', 'funding', { step: 1, min: 0, max: 20, open: true }],
  ['coolShare', '%', 'cooling', { step: 5, min: 0, max: 100 }],
  ['eer', '-', 'cooling', { step: 0.5, min: 1, max: 40, open: true }],
  ['boilerInvest', '€/kW', 'replace', { step: 10, min: 0, max: 500, open: true }],
  ['fMaintRef', '%/a', 'replace', { step: 0.5, min: 0, max: 10, open: true }],
];

export const toInputs = (f: Form, refType: RefType): EconInputs => ({
  hours: f.hours,
  eta: f.eta / 100,
  hsHi: f.hsHi || 1,
  pFuel: f.pFuel / 100,
  rFuel: f.rFuel / 100,
  co2Fuel: f.co2Fuel,
  // The electric boiler's CO₂ cost follows the electricity setting.
  co2Priced: refType !== 'eboiler' || Boolean(f.co2ElPriced),
  co2Price: f.co2Price,
  rCo2: f.rCo2 / 100,
  pEl: f.pEl / 100,
  rEl: f.rEl / 100,
  co2El: f.co2El,
  co2ElPriced: Boolean(f.co2ElPriced),
  i: f.i / 100,
  T: Math.max(1, Math.round(f.T)),
  fMaint: f.fMaint / 100,
  opHours: f.opHours,
  wage: f.wage,
  funding: f.funding / 100,
  pDemand: f.pDemand,
  coolShare: f.coolShare / 100,
  eer: f.eer,
  reinvestShare: f.reinvestShare / 100,
  reinvestYear: Math.round(f.reinvestYear),
  life: Math.round(f.life),
  rInv: f.rInv / 100,
  boilerInvest: f.boilerInvest,
  fMaintRef: f.fMaintRef / 100,
  opFunding: f.opFunding / 1000,
  opFundingYears: Math.round(f.opFundingYears),
});

export const pointKey = (p: OptimizedIntegrationPoint) =>
  `${p.refrigerant}|${p.T_source}|${p.T_sink}`;
export const pointName = (p: OptimizedIntegrationPoint) =>
  `${p.refrigerant} ${p.T_sink.toFixed(0)} °C`;

// The results shown up front, one line per pump.
export const KPI_ROWS = ['payback', 'npv', 'saving1', 'co2_saving', 'breakeven'];
// One colour per key result, none of them the pinch cards' red, blue, violet
// or green, so the two rows of cards read as different things.
export const KPI_COLORS: Record<string, string> = {
  saving1: '#B45309', // amber
  payback: '#0F766E', // teal
  npv: '#A21CAF', // fuchsia
  co2_saving: '#475569', // slate
  breakeven: '#7C2D12', // brown
};

// Which result rows go in which of the two result tables.
export const RESULT_ROWS_ENERGY = [
  'q',
  'qsrc',
  'cop',
  'fuel',
  'el',
  'elCool',
  'energy_saving',
  'co2',
  'co2_saving',
  'alpha',
];
export const RESULT_ROWS_MONEY = [
  'opex1',
  'saving1',
  'payback',
  'payback_static',
  'residual',
  'npv',
  'irr',
  'lcoh_hp',
  'lcoh_ref',
  'breakeven',
  'spec_total',
  'capex_vdi',
];

// Loss / gain, used wherever a value's sign matters.
export const RED = '#C62828';
export const GREEN = '#2E7D32';
// Rows whose cells are coloured by sign.
export const SIGNED_ROWS = new Set(['saving1', 'energy_saving', 'co2_saving', 'npv', 'irr']);

const COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];

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

type Fig = { data: any[]; layout: any };

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
  const text = isDark ? '#F8FAFC' : '#1A1C1E';
  const surface = isDark ? '#1e293b' : '#ffffff';
  const axis = {
    automargin: true,
    gridcolor: isDark ? '#334155' : '#E2E8F0',
    tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
  };
  const layout = (title: string, extra: any = {}): any => ({
    title: { text: title, font: { size: 14, color: text } },
    height: 300,
    separators: ',.', // decimal ",", thousands "."
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 64, r: 10, t: 32, b: 40 },
    legend: { orientation: 'h', y: -0.2, font: { color: text } },
    ...extra,
    xaxis: { ...axis, ...extra.xaxis },
    yaxis: { ...axis, ...extra.yaxis },
  });

  const istName = t('economics.ist', { ref: refName });
  const names = [istName, ...points.map(pointName)];
  const years = Array.from({ length: inp.T + 1 }, (_, k) => form.year + k);

  const bar: Fig = {
    data: [
      {
        type: 'bar',
        name: t('economics.charts.invest'),
        x: names,
        y: [0, ...variants.map((v) => v.capex)],
        // Gold / plum: hues no other chart here uses (blue and orange are the
        // electricity and gas lines next to it) that stay apart for colour-blind
        // readers. The surface-coloured outline leaves a gap between the parts.
        marker: { color: isDark ? '#C98500' : '#E0A100', line: { color: surface, width: 2 } },
      },
      {
        type: 'bar',
        name: t('economics.charts.cum_cost'),
        x: names,
        y: [ref.cumCost, ...results.map((r) => r.cumCost)],
        marker: { color: isDark ? '#B0558C' : '#8E3B6E', line: { color: surface, width: 2 } },
      },
      // Legend-only line: how much of the pump's total cost is the investment.
      ...variants.map((v, k) => ({
        type: 'scatter',
        mode: 'lines',
        x: [null],
        y: [null],
        line: { width: 0 },
        name: t('economics.charts.invest_share', {
          pct: formatDe((100 * v.capex) / Math.max(v.capex + results[k].cumCost, 1), 0),
          T: inp.T,
        }),
        hoverinfo: 'skip',
      })),
    ],
    layout: layout(t('economics.charts.bar_title', { T: inp.T }), {
      barmode: 'stack',
      yaxis: { title: { text: '€' }, tickformat: ',.0f' },
    }),
  };

  const price: Fig = {
    data: (
      [
        [t('economics.charts.fuel_incl_co2', { fuel }), fuelPrice, '#D97706'],
        [t('economics.charts.el'), elPrice, '#2563EB'],
      ] as const
    ).map(([name, priceAt, color]) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name,
      x: years,
      y: years.map((_, k) => priceAt(inp, k) * 100),
      line: { color, width: 3 },
    })),
    layout: layout(t('economics.charts.price_title'), { yaxis: { title: { text: 'ct/kWh' } } }),
  };

  // Sensitivity window: each price from 0 to twice today's (−100 % … +100 %),
  // so today's prices sit in the middle. The step is picked so each axis has at
  // most ~14 cells and every cell has room for its value.
  const idx = 0;
  const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  const axisCt = (today: number) => {
    const hi = Math.max(2 * today, 1);
    const step = [0.5, 1, 2, 5, 10, 20].find((st) => hi / st <= 14) ?? 50;
    return { step, ct: range(0, Math.ceil(hi / step)).map((k) => Number((k * step).toFixed(2))) };
  };
  const { step: gasStep, ct: gasCt } = axisCt(sensBase?.fuel ?? form.pFuel);
  const { step: elStep, ct: elCt } = axisCt(sensBase?.el ?? form.pEl);
  const z = elCt.map((e) =>
    gasCt.map((g) => evaluate({ ...inp, pFuel: g / 100, pEl: e / 100 }, refSys, variants[idx]).npv)
  );
  // Break-even line: the electricity price at which KW = 0, per gas price.
  // On the cheaper-electricity side of it the heat pump beats the boiler.
  const beX = [gasCt[0] - gasStep / 2, ...gasCt, gasCt[gasCt.length - 1] + gasStep / 2];
  const beY = beX.map((g) => {
    const p = breakEvenElPrice(inp, refSys, variants[idx], g / 100);
    return p === null ? null : 100 * p;
  });
  const fuelAxis = t('economics.charts.fuel_price', { fuel });
  // The sentence above the heatmap, with today's numbers.
  const beNow = breakEven[idx];
  const sensExplain =
    beNow === null || beNow <= 0
      ? t('economics.sens_never', { fuel, pf: formatDe(form.pFuel, 2), ref: refName })
      : t('economics.sens_explain', {
          fuel,
          pf: formatDe(form.pFuel, 2),
          pe: formatDe(100 * beNow, 2),
        });
  // Cells coloured by Kapitalwert in soft tones (light red → near-white at 0 →
  // light green, deeper with the amount), split by the break-even line, today's
  // prices as a dot, the Kapitalwert written in every cell.
  const xLo = gasCt[0] - gasStep / 2;
  const xHi = gasCt[gasCt.length - 1] + gasStep / 2;
  const yLo = elCt[0] - elStep / 2; // cheapest electricity, top of the chart
  const yHi = elCt[elCt.length - 1] + elStep / 2;
  const mid = isDark ? '#2a2f3a' : '#FAFAF8';
  const sensTitle = t('economics.charts.sens_title', { funding: form.funding, fuel });
  const sens: Fig = {
    data: [
      {
        type: 'heatmap',
        x: gasCt,
        y: elCt,
        z,
        zmid: 0,
        colorscale: [
          [0, isDark ? '#c62828' : '#E57373'],
          [0.35, isDark ? '#6d2b2b' : '#FFCDD2'],
          [0.5, mid],
          [0.65, isDark ? '#2e5a31' : '#C8E6C9'],
          [1, isDark ? '#2e7d32' : '#66BB6A'],
        ],
        // Thin gaps in the surface colour draw the cell borders.
        xgap: 1,
        ygap: 1,
        texttemplate: '%{z:,.0f}',
        textfont: { size: 10, color: text },
        colorbar: { title: { text: '€' }, tickformat: ',.0f', thickness: 12 },
        hovertemplate: `${fuelAxis}: %{x} ct/kWh<br>${t('economics.charts.el')}: %{y} ct/kWh<br>${t('economics.rows.npv')}: %{z:,.0f} €<extra></extra>`,
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'lines',
        x: beX,
        y: beY,
        name: t('economics.charts.breakeven'),
        line: { color: text, width: 3, dash: 'dash' },
        hovertemplate: `${t('economics.charts.breakeven')}<br>${fuelAxis}: %{x:,.1f} ct/kWh<br>${t('economics.charts.el')}: %{y:,.2f} ct/kWh<extra></extra>`,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: [form.pFuel],
        y: [form.pEl],
        name: t('economics.charts.today'),
        marker: { size: 14, color: text, line: { color: surface, width: 2 } },
        hovertemplate: `${t('economics.charts.today')}<br>${fuelAxis}: %{x:,.2f} ct/kWh<br>${t('economics.charts.el')}: %{y:,.2f} ct/kWh<extra></extra>`,
      },
      // Legend-only entries explaining the cell colours, in the map's order:
      // the reference wins on the left (cheap fuel), the heat pump on the right.
      ...(
        [
          [isDark ? '#c62828' : '#E57373', t('economics.charts.side_ref', { ref: refName })],
          [isDark ? '#2e7d32' : '#66BB6A', t('economics.charts.side_hp')],
        ] as const
      ).map(([color, name]) => ({
        type: 'scatter',
        mode: 'markers',
        x: [null],
        y: [null],
        name,
        marker: { symbol: 'square', size: 12, color },
        hoverinfo: 'skip',
      })),
    ],
    layout: layout(sensTitle, {
      // Taller when there are more rows, so written values stay readable.
      height: Math.max(460, 150 + 24 * elCt.length),
      // The top axis and its title need room below the chart title.
      margin: { l: 90, r: 20, t: 110, b: 30 },
      title: { text: sensTitle, font: { size: 14, color: text }, y: 0.98 },
      // Fixed ranges so the line is clipped to the price window.
      // Electricity runs top-down, as on the slides.
      xaxis: {
        title: { text: `${fuelAxis} [ct/kWh]`, standoff: 8 },
        side: 'top',
        dtick: gasStep,
        ticksuffix: ' ct',
        range: [xLo, xHi],
        fixedrange: true,
        showgrid: false,
      },
      yaxis: {
        title: { text: `${t('economics.charts.el')} [ct/kWh]` },
        dtick: elStep,
        ticksuffix: ' ct',
        range: [yHi, yLo],
        fixedrange: true,
        showgrid: false,
      },
      legend: { orientation: 'h', y: -0.04, font: { color: text } },
    }),
  };

  // Economic heat pump size: every working pump on the optimisation curve,
  // costed with the same inputs. A smaller pump costs less but leaves more of
  // the demand on the old heater; the Kapitalwert weighs both. Per size (1 %
  // of the demand) the best machine is kept, so the line is the best you can
  // do at each size and its peak is the economic optimum.
  const sizeBest = new Map<number, { p: OptimizedIntegrationPoint; npv: number }>();
  for (const p of realFeasible) {
    const npv = evaluate(inp, refSys, {
      Q: p.Q_demand,
      Qsrc: p.Q_source,
      cop: p.COP,
      capex: capexOf(p),
    }).npv;
    const bucket = Math.round((100 * p.Q_demand) / refSys.Q);
    const cur = sizeBest.get(bucket);
    if (!cur || npv > cur.npv) sizeBest.set(bucket, { p, npv });
  }
  const sizes = [...sizeBest.values()].sort((a, b) => a.p.Q_demand - b.p.Q_demand);
  const optimum = sizes.reduce<(typeof sizes)[number] | null>(
    (best, s) => (!best || s.npv > best.npv ? s : best),
    null
  );
  const analysed = points[0];
  const analysedNpv = results[0]?.npv;
  const sizeHover = (p: OptimizedIntegrationPoint) =>
    [
      pointName(p),
      `${t('economics.charts.size_hp')}: ${formatDe(p.Q_demand)} kW (${formatDe((100 * p.Q_demand) / refSys.Q, 0)} %)`,
      `${t('economics.charts.size_rest', { ref: refName })}: ${formatDe(Math.max(refSys.Q - p.Q_demand, 0))} kW`,
      `COP: ${formatDe(p.COP, 2)}`,
    ].join('<br>');
  const size: Fig = {
    data: [
      {
        type: 'scatter',
        mode: 'lines+markers',
        x: sizes.map((s) => s.p.Q_demand),
        y: sizes.map((s) => s.npv),
        name: t('economics.charts.size_curve'),
        line: { color: isDark ? '#94A3B8' : '#9AA0A6', width: 2 },
        marker: { size: 7, color: sizes.map((s) => (s.npv < 0 ? RED : GREEN)) },
        customdata: sizes.map((s) => sizeHover(s.p)),
        hovertemplate: `%{customdata}<br>${t('economics.rows.npv')}: %{y:,.0f} €<extra></extra>`,
      },
      ...(optimum
        ? [
            {
              type: 'scatter',
              mode: 'markers',
              x: [optimum.p.Q_demand],
              y: [optimum.npv],
              name: t('economics.charts.size_optimum'),
              marker: {
                symbol: 'diamond',
                size: 16,
                color: '#E0A100',
                line: { color: text, width: 1 },
              },
              customdata: [sizeHover(optimum.p)],
              hovertemplate: `<b>${t('economics.charts.size_optimum')}</b><br>%{customdata}<br>${t('economics.rows.npv')}: %{y:,.0f} €<extra></extra>`,
            },
          ]
        : []),
      ...(analysed && analysedNpv !== undefined
        ? [
            {
              type: 'scatter',
              mode: 'markers',
              x: [analysed.Q_demand],
              y: [analysedNpv],
              name: t('economics.charts.size_analysed'),
              marker: { size: 13, color: text, line: { color: surface, width: 2 } },
              customdata: [sizeHover(analysed)],
              hovertemplate: `<b>${t('economics.charts.size_analysed')}</b><br>%{customdata}<br>${t('economics.rows.npv')}: %{y:,.0f} €<extra></extra>`,
            },
          ]
        : []),
    ],
    layout: layout(t('economics.charts.size_title', { ref: refName }), {
      height: 360,
      xaxis: {
        title: { text: t('economics.charts.size_x', { q: formatDe(refSys.Q) }) },
        ticksuffix: ' kW',
        tickformat: ',.0f',
      },
      yaxis: {
        title: { text: `${t('economics.rows.npv')} [€]` },
        tickformat: ',.0f',
        zeroline: true,
        zerolinewidth: 2,
      },
    }),
  };
  const sizeExplain = optimum
    ? t('economics.size_explain', {
        q: formatDe(refSys.Q),
        ref: refName,
        qopt: formatDe(optimum.p.Q_demand),
        pct: formatDe((100 * optimum.p.Q_demand) / refSys.Q, 0),
        name: pointName(optimum.p),
        cop: formatDe(optimum.p.COP, 2),
        npv: formatDe(optimum.npv),
      })
    : t('economics.size_none');

  // Kapitalwert over time for every pump at the selected prices (clicking the
  // heatmap changes them). Run past T up to the payback horizon, so the year a
  // pump turns profitable shows even when that is after T.
  const runs = variants.map((v) => evaluate({ ...inp, T: PAYBACK_HORIZON }, refSys, v));
  // Zero crossing, interpolated between the two years around it.
  const crossings = runs.map(({ npvCurve: c, payback: k }) =>
    k === null ? null : k === 0 ? 0 : k - 1 + -c[k - 1] / (c[k] - c[k - 1])
  );
  const lastCrossing = Math.max(0, ...crossings.map((c) => (c === null ? 0 : Math.ceil(c) + 3)));
  const kMax = Math.min(PAYBACK_HORIZON, Math.max(inp.T, lastCrossing));
  const tYears = Array.from({ length: kMax + 1 }, (_, j) => form.year + j);
  const crossingText = (c: number | null) =>
    c === null
      ? t('economics.charts.never', { years: PAYBACK_HORIZON })
      : t('economics.charts.profitable_from', {
          year: formatDe(form.year + c, 1, false),
          years: formatDe(c, 1),
        });
  const npv: Fig = {
    data: runs
      .map((r, k) => {
        const y = r.npvCurve.slice(0, kMax + 1);
        return {
          type: 'scatter',
          mode: 'lines+markers',
          // The legend says when each pump pays off, so it reads without hovering.
          name: `${pointName(points[k])} – ${crossingText(crossings[k])}`,
          x: tYears,
          y,
          line: { color: COLORS[k % COLORS.length], width: 2 },
          // Red while the investment is not yet paid back, green from then on.
          marker: { size: 7, color: y.map((v) => (v < 0 ? RED : GREEN)) },
          hovertemplate: `${pointName(points[k])}<br>%{x}: %{y:,.0f} €<extra></extra>`,
        } as any;
      })
      .concat(
        // Legend-only entries for the marker colours and the period line.
        [
          {
            type: 'scatter',
            mode: 'markers',
            marker: { size: 9, color: RED },
            name: t('economics.charts.not_paid_back'),
          },
          {
            type: 'scatter',
            mode: 'markers',
            marker: { size: 9, color: GREEN },
            name: t('economics.charts.paid_back'),
          },
          {
            type: 'scatter',
            mode: 'lines',
            line: { color: text, width: 1, dash: 'dot' },
            name: t('economics.charts.period_line', { T: inp.T }),
          },
        ].map((tr) => ({ ...tr, x: [null], y: [null], hoverinfo: 'skip' }))
      ),
    layout: layout(
      t('economics.charts.time_title', {
        fuel,
        gas: formatDe(form.pFuel, 2),
        el: formatDe(form.pEl, 2),
      }),
      {
        showlegend: true,
        yaxis: { title: { text: '€' }, tickformat: ',.0f', zeroline: true, zerolinewidth: 2 },
        // Whole years, spaced by Plotly to fit the width (the report draws it narrower).
        xaxis: { tickformat: 'd' },
        shapes: [
          // End of the Betrachtungszeitraum, named in the legend. A text label
          // here would stretch the axis to fit it.
          {
            type: 'line',
            x0: form.year + inp.T,
            x1: form.year + inp.T,
            yref: 'paper',
            y0: 0,
            y1: 1,
            line: { color: text, width: 1, dash: 'dot' },
          },
        ],
        annotations: [
          // One arrow per pump at its break-even year, staggered so they don't stack.
          ...crossings.flatMap((c, k) =>
            c === null
              ? []
              : [
                  {
                    x: form.year + c,
                    y: 0,
                    text: formatDe(form.year + c, 1, false),
                    showarrow: true,
                    arrowhead: 2,
                    arrowcolor: COLORS[k % COLORS.length],
                    ay: -30 - 22 * k,
                    font: { color: text, size: 11 },
                  },
                ]
          ),
        ],
      }
    ),
  };

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
