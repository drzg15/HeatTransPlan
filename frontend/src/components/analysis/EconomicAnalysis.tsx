/** EconomicAnalysis — Kapitalwert, payback and sensitivity of the selected heat
 *  pumps against the heater (and cooling) they replace. Layout follows the Hipp
 *  presentation (Randbedingungen table, cost bars, Barwertverlauf, Strom-/
 *  Gaspreis sensitivity); formulas live in utils/economics.ts. */

import { useState } from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import Section from '../ui/Section';
import {
  breakEvenElPrice,
  elPrice,
  evaluate,
  fuelPrice,
  referenceCost,
  PAYBACK_HORIZON,
  type EconInputs,
} from '../../utils/economics';
import { formatDe, parseDe } from '../../utils/numberFormat';
import type { OptimizedIntegrationPoint } from '../../types/analysis';

// Display units: prices in ct/kWh, rates and shares in %.
const DEFAULTS = {
  year: new Date().getFullYear() + 1,
  hours: 8760, // 100 % of the year until a load profile drives it
  i: 6,
  T: 15,
  // Reference heater (gas boiler preset). The fuel price excludes CO₂, which
  // is costed separately: 6 ct + 0,201 t/MWh × 55 €/t ≈ the slides' 7 ct.
  eta: 90,
  pFuel: 6,
  rFuel: 3,
  co2Fuel: 0.201,
  co2Price: 55,
  rCo2: 5,
  // Electricity and heat pump.
  pEl: 13,
  rEl: 3,
  co2El: 0.352, // UBA 2025, location-based, as on slide 29
  pDemand: 0, // only if not already in the electricity price
  // Midpoint of the 200–1,500 €/kW literature range cited in the help bulb.
  specCost: 850,
  fMaint: 5,
  reinvestShare: 0,
  reinvestYear: 10,
  life: 20, // VDI 2067 order of magnitude for heat pumps
  funding: 0,
  // Operating funding (e.g. BEW Modul 4): none by default.
  opFunding: 0,
  opFundingYears: 10,
  // Cooling the pump takes over. 0 % = the source is not actively cooled today
  // (e.g. exhaust air going up the stack), so there is nothing to save.
  coolShare: 0,
  eer: 4,
};
type Form = typeof DEFAULTS;

// Reference heaters: picking one loads its efficiency, price and CO₂ factor,
// all editable afterwards. The electric boiler's CO₂ is in its electricity
// price, so no CO₂ cost is added on top.
type RefType = 'gas' | 'oil' | 'eboiler';
const PRESETS: Record<RefType, Pick<Form, 'eta' | 'pFuel' | 'co2Fuel'>> = {
  gas: { eta: 90, pFuel: 6, co2Fuel: 0.201 },
  oil: { eta: 88, pFuel: 8, co2Fuel: 0.266 },
  eboiler: { eta: 99, pFuel: 13, co2Fuel: 0.352 },
};

type Group = 'general' | 'reference' | 'electricity' | 'hp' | 'funding' | 'cooling';
const GROUPS: Group[] = ['general', 'reference', 'electricity', 'hp', 'funding', 'cooling'];

// Inputs: key, unit, the block it sits in, and the step and range of the −/+
// buttons and slider.
// "open" ranges have no natural upper bound: releasing the slider at its end
// doubles the range, so dragging again goes further. Typed values beyond the
// range stretch it too. Physical limits (efficiency, hours, shares) stay closed.
const FIELDS: Array<[keyof Form, string, Group, Range]> = [
  ['year', 'a', 'general', { step: 1, min: 2025, max: 2045 }],
  ['hours', 'h/a', 'general', { step: 100, min: 0, max: 8760 }],
  ['i', '%', 'general', { step: 0.5, min: 0, max: 15, open: true }],
  ['T', 'a', 'general', { step: 1, min: 1, max: 40, open: true }],
  ['eta', '%', 'reference', { step: 1, min: 50, max: 100 }],
  ['pFuel', 'ct/kWh', 'reference', { step: 0.5, min: 0, max: 30, open: true }],
  ['rFuel', '%/a', 'reference', { step: 0.5, min: -5, max: 10, open: true }],
  ['co2Fuel', 't/MWh', 'reference', { step: 0.001, min: 0, max: 0.4 }],
  ['co2Price', '€/t', 'reference', { step: 5, min: 0, max: 300, open: true }],
  ['rCo2', '%/a', 'reference', { step: 0.5, min: -5, max: 15, open: true }],
  ['pEl', 'ct/kWh', 'electricity', { step: 0.5, min: 0, max: 40, open: true }],
  ['rEl', '%/a', 'electricity', { step: 0.5, min: -5, max: 10, open: true }],
  ['co2El', 't/MWh', 'electricity', { step: 0.01, min: 0, max: 1 }],
  ['pDemand', '€/kW/a', 'hp', { step: 10, min: 0, max: 300, open: true }],
  ['specCost', '€/kW', 'hp', { step: 50, min: 0, max: 3000, open: true }],
  ['fMaint', '%/a', 'hp', { step: 0.5, min: 0, max: 10, open: true }],
  ['reinvestShare', '%', 'hp', { step: 5, min: 0, max: 100 }],
  ['reinvestYear', 'a', 'hp', { step: 1, min: 1, max: 40, open: true }],
  ['life', 'a', 'hp', { step: 1, min: 0, max: 50, open: true }],
  ['funding', '%', 'hp', { step: 5, min: 0, max: 100 }],
  ['opFunding', '€/MWh', 'funding', { step: 5, min: 0, max: 100, open: true }],
  ['opFundingYears', 'a', 'funding', { step: 1, min: 0, max: 20, open: true }],
  ['coolShare', '%', 'cooling', { step: 5, min: 0, max: 100 }],
  ['eer', '-', 'cooling', { step: 0.5, min: 1, max: 40, open: true }],
];

type Range = { step: number; min: number; max: number; open?: boolean };

const toInputs = (f: Form, refType: RefType): EconInputs => ({
  hours: f.hours,
  eta: f.eta / 100,
  pFuel: f.pFuel / 100,
  rFuel: f.rFuel / 100,
  co2Fuel: f.co2Fuel,
  co2Priced: refType !== 'eboiler',
  co2Price: f.co2Price,
  rCo2: f.rCo2 / 100,
  pEl: f.pEl / 100,
  rEl: f.rEl / 100,
  co2El: f.co2El,
  i: f.i / 100,
  T: Math.max(1, Math.round(f.T)),
  fMaint: f.fMaint / 100,
  funding: f.funding / 100,
  pDemand: f.pDemand,
  coolShare: f.coolShare / 100,
  eer: f.eer,
  reinvestShare: f.reinvestShare / 100,
  reinvestYear: Math.round(f.reinvestYear),
  life: f.life,
  opFunding: f.opFunding / 1000,
  opFundingYears: Math.round(f.opFundingYears),
});

const pointKey = (p: OptimizedIntegrationPoint) => `${p.refrigerant}|${p.T_source}|${p.T_sink}`;
const pointName = (p: OptimizedIntegrationPoint) => `${p.refrigerant} ${p.T_sink.toFixed(0)} °C`;

// Specific investment cost references for industrial high-temperature heat
// pumps, shown in the help bulb. Citations, so not translated.
const CAPEX_SOURCES = [
  {
    label: 'Danish Energy Agency (2026): Technology Data – Industrial Process Heat, v0006',
    note: '1,400 €/kW ≤125 °C, 1,750 €/kW ≤150 °C (steam HP, 2025 prices, equipment + installation)',
    url: 'https://ens.dk/media/7757/download',
  },
  {
    label:
      'Energy (2024): Economic and environmental considerations for VHTHPs in European markets',
    note: '~200–1,500 €/kW, ≥600 €/kW for lifts >100 K',
    url: 'https://www.sciencedirect.com/science/article/pii/S0360544224029220',
  },
  {
    label: 'Högnabba et al. (2023), 14th IEA Heat Pump Conference',
    note: 'VHTHP economics in European markets',
    url: 'https://research.abo.fi/en/publications/economic-and-environmental-considerations-for-the-deployment-of-v/',
  },
  {
    label: 'TNO / energy.nl: Industrial high-temperature heat pump factsheet',
    note: '300–900 €/kW up to 160 °C; ~50 % equipment / 50 % installation',
    url: 'https://energy.nl/wp-content/uploads/industrial-high-temperature-heat-pump-2-7.pdf',
  },
];

const formulaStyle = {
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  lineHeight: 1.6,
  margin: '0.25rem 0 0.5rem',
};

// Per-row formulas as computed in utils/economics.ts, and the symbols each one
// uses. Symbols are language-neutral; their explanations come from the locale.
const FORMULAS: Record<string, { f: string[]; terms: string[] }> = {
  capex: { f: ['I = c_spez · Q'], terms: ['I', 'c_spez', 'Q'] },
  q: { f: ['Ist: Q_ref = max(Q_demand_total)', 'WP: Q = Q_demand'], terms: ['Q_ref', 'Q'] },
  qsrc: {
    f: ['Ist: Q_src,ref = max(Q_source)', 'WP: Q_src = Q_source'],
    terms: ['Q_src,ref', 'Q_src'],
  },
  cop: { f: ['COP = Q / P_el'], terms: ['COP', 'P_el'] },
  fuel: {
    f: ['E_fuel,Ist = Q_ref · h / η', 'E_fuel,WP = (Q_ref − Q) · h / η'],
    terms: ['E_fuel', 'Q_ref', 'Q', 'h', 'η'],
  },
  el: { f: ['E_el = Q · h / COP'], terms: ['E_el', 'Q', 'h', 'COP'] },
  elCool: {
    f: ['E_cool,Ist = Q_src,ref · h · a / EER', 'E_cool,WP = (Q_src,ref − Q_src) · h · a / EER'],
    terms: ['E_cool', 'Q_src,ref', 'Q_src', 'h', 'a', 'EER'],
  },
  opex1: {
    f: [
      'K(t) = E_fuel · p_fuel(t) + (E_el + E_cool) · p_el(t) + f_W · I + p_L · P_el − F_B(t)',
      'F_B(t) = f_B · Q · h  (t ≤ t_B, else 0)',
      'p_fuel(t) = p_fuel,0 · (1 + r_fuel)^t + c_CO2 · p_CO2,0 · (1 + r_CO2)^t',
      'p_el(t) = p_el,0 · (1 + r_el)^t',
    ],
    terms: [
      'K',
      'E_fuel',
      'E_el',
      'E_cool',
      'p_0',
      'r',
      'c_CO2',
      'p_CO2',
      'f_W',
      'I',
      'p_L',
      'P_el',
      'f_B',
      't_B',
    ],
  },
  energy_saving: {
    f: ['ΔE = (E_fuel + E_cool)_Ist − (E_fuel + E_el + E_cool)_WP'],
    terms: ['E_fuel', 'E_el', 'E_cool'],
  },
  saving1: { f: ['S(1) = K_Ist(1) − K_WP(1)'], terms: ['K'] },
  co2: {
    f: ['CO2 = E_fuel · c_CO2 + (E_el + E_cool) · c_CO2,el'],
    terms: ['E_fuel', 'E_el', 'E_cool', 'c_CO2', 'c_CO2,el'],
  },
  co2_saving: { f: ['ΔCO2 = CO2_Ist − CO2_WP'], terms: ['c_CO2', 'c_CO2,el'] },
  payback: {
    f: [
      't_A = min { k : KW(k) ≥ 0 }',
      'KW(k) = −(1 − φ) · I + Σ_{t=1..k} (CF(t) − R(t)) / (1 + i)^t',
    ],
    terms: ['t_A', 'k', 'KW', 'φ', 'I', 'CF', 'R', 'i'],
  },
  residual: { f: ['RW = I · max(0, 1 − T / L)'], terms: ['RW', 'I', 'T', 'L'] },
  npv: {
    f: [
      'KW = −(1 − φ) · I + Σ_{t=1..T} (CF(t) − R(t)) / (1 + i)^t + RW / (1 + i)^T',
      'CF(t) = K_Ist(t) − K_WP(t)',
    ],
    terms: ['KW', 'φ', 'I', 'CF', 'K', 'R', 'RW', 'i', 'T', 't'],
  },
  roi: { f: ['ROI = KW / ((1 − φ) · I)'], terms: ['KW', 'φ', 'I'] },
  breakeven: { f: ['p_el* : KW(p_fuel, p_el*) = 0'], terms: ['p_el*', 'KW'] },
};
// Formula symbols are German abbreviations (KW = Kapitalwert, WP = Wärmepumpe,
// …); the English UI shows their English counterparts instead.
const SYMBOLS_EN: Array<[RegExp, string]> = [
  [/(?<![A-Za-z_])KW(?![A-Za-z])/g, 'NPV'],
  [/(?<![A-Za-z_])RW(?![A-Za-z])/g, 'RV'],
  [/(?<![A-Za-z])Ist(?![A-Za-z])/g, 'ref'],
  [/(?<![A-Za-z])WP(?![A-Za-z])/g, 'HP'],
  [/c_spez/g, 'c_spec'],
  [/f_W(?![A-Za-z])/g, 'f_M'],
  [/t_A(?![A-Za-z])/g, 't_P'],
  [/F_B(?![A-Za-z])/g, 'F_op'],
  [/f_B(?![A-Za-z])/g, 'f_op'],
  [/t_B(?![A-Za-z])/g, 't_op'],
  [/p_L(?![A-Za-z])/g, 'p_C'],
];
const symbolsEn = (text: string) => SYMBOLS_EN.reduce((acc, [re, to]) => acc.replace(re, to), text);
// Locale keys for symbols: Greek letters spelled out, commas and stars dropped.
const termKey = (sym: string) =>
  ({ η: 'eta', φ: 'phi', 'p_el*': 'p_el_star' })[sym] ?? sym.replace(/,/g, '_');

// The inputs shown up front; all others sit under "More assumptions".
const KEY_FIELDS: Array<keyof Form> = ['pFuel', 'pEl', 'specCost', 'funding', 'T', 'i'];
// Each price card also carries its yearly price change, next to the price.
const PRICE_CHANGE: Partial<Record<keyof Form, keyof Form>> = { pFuel: 'rFuel', pEl: 'rEl' };
// Short values that get a narrower card.
const NARROW_KEYS: Array<keyof Form> = ['funding', 'T', 'i'];
// The results shown up front, one line per pump.
const KPI_ROWS = ['payback', 'npv', 'saving1', 'co2_saving', 'breakeven'];
// One colour per key result, none of them the pinch cards' red, blue, violet
// or green, so the two rows of cards read as different things.
const KPI_COLORS: Record<string, string> = {
  saving1: '#B45309', // amber
  payback: '#0F766E', // teal
  npv: '#A21CAF', // fuchsia
  co2_saving: '#475569', // slate
  breakeven: '#7C2D12', // brown
};

// Which result rows go in which of the two result tables.
const RESULT_ROWS_ENERGY = [
  'q',
  'qsrc',
  'cop',
  'fuel',
  'el',
  'elCool',
  'energy_saving',
  'co2',
  'co2_saving',
];
const RESULT_ROWS_MONEY = ['opex1', 'saving1', 'payback', 'residual', 'npv', 'breakeven', 'roi'];

// Loss / gain, used wherever a value's sign matters.
const RED = '#C62828';
const GREEN = '#2E7D32';
// Rows whose cells are coloured by sign.
const SIGNED_ROWS = new Set(['saving1', 'energy_saving', 'co2_saving', 'npv', 'roi']);

const COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];

/** Text input showing the value German-style (3.222.575 / 0,07). The typed
 *  text is kept while editing so the cursor does not jump; it is reformatted
 *  on blur. A number input cannot show thousands separators. */
function NumInput({
  value,
  onChange,
  range,
  width = 80,
  grouping = true,
}: {
  value: number;
  onChange: (v: number) => void;
  range: Range;
  width?: number;
  grouping?: boolean;
}) {
  const { step } = range;
  const [draft, setDraft] = useState<string | null>(null);
  const [grown, setGrown] = useState(range.max);
  const max = range.open ? Math.max(grown, range.max, value) : range.max;
  // toFixed drops float noise, so 0,07 + 0,01 stays 0,08.
  const nudge = (dir: number) => onChange(Number((value + dir * step).toFixed(6)));
  return (
    <span className="econ-num">
      <button type="button" onClick={() => nudge(-1)} aria-label="−">
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        className="pa-number-input"
        style={{ width }}
        value={draft ?? formatDe(value, 4, grouping)}
        onFocus={() => setDraft(formatDe(value, 4, grouping))}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseDe(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        onBlur={() => setDraft(null)}
      />
      <button type="button" onClick={() => nudge(1)} aria-label="+">
        +
      </button>
      <input
        type="range"
        min={range.min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={() => range.open && value >= max && setGrown(max * 2)}
      />
    </span>
  );
}

export default function EconomicAnalysis() {
  const { t, i18n } = useTranslation();
  const sym = (text: string) => (i18n.language.startsWith('en') ? symbolsEn(text) : text);
  const selected = useAnalysisStore((s) => s.selectedHPPoints);
  const maxQPoint = useAnalysisStore((s) => s.hpiOptimizationResult?.max_q_point);
  const feasible = useAnalysisStore((s) => s.hpiOptimizationResult?.feasible_points);
  const setSelectedHPPoints = useAnalysisStore((s) => s.setSelectedHPPoints);
  // One pump only, so the analysis stays readable however many are picked: the
  // best of the selection (real machines before archetypes, then largest heat
  // output, then highest COP). Nothing picked: the default pump, as the
  // optimization chart shows.
  const best = selected.length
    ? [...selected].sort(
        (a, b) =>
          Number(a.theoretical) - Number(b.theoretical) || b.Q_demand - a.Q_demand || b.COP - a.COP
      )[0]
    : maxQPoint;
  const points = best ? [best] : [];
  const isDark = useUIStore((s) => s.theme) === 'dark';
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [refType, setRefType] = useState<RefType>('gas');
  // ponytail: component state, lost on navigation; move to the store when it has to be saved with the project
  // Bumped by the reset button; remounts the inputs so stretched slider ranges reset too.
  const [resetCount, setResetCount] = useState(0);
  // Prices the heatmap window is centred on. Set on the first click and kept,
  // so clicking only moves the dot; typing or sliding a price clears it.
  const [sensBase, setSensBase] = useState<{ fuel: number; el: number } | null>(null);
  const setPrice = (patch: Partial<Form>) => {
    setForm({ ...form, ...patch });
    setSensBase(null);
  };
  const reset = () => {
    setForm(DEFAULTS);
    setRefType('gas');
    setSensBase(null);
    setResetCount((n) => n + 1);
  };

  const header = (
    <h3 className="pa-section-title" style={{ flex: 1 }}>
      {t('economics.title')}
      <ChartHelpButton
        title={t('economics.title')}
        inline
        description={
          <>
            <p>{t('economics.help_1')}</p>
            <p>{t('economics.help_2')}</p>
            <p>{t('economics.help_3')}</p>
            <p>{t('economics.help_4')}</p>
            <p>{t('economics.help_4_source')}</p>
            <ul>
              {CAPEX_SOURCES.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>{' '}
                  — {s.note}
                </li>
              ))}
            </ul>
          </>
        }
      />
      <button
        type="button"
        className="econ-reset"
        onClick={reset}
        title={t('economics.reset_hint')}
      >
        ↺ {t('economics.reset')}
      </button>
    </h3>
  );

  if (!points.length) {
    return (
      <Section title={header}>
        <p style={{ fontSize: '0.85rem' }}>{t('economics.empty')}</p>
      </Section>
    );
  }

  const inp = toInputs(form, refType);
  const fuel = t(`economics.fuel.${refType}`);
  const refName = t(`economics.ref.${refType}`);
  // The reference supplies the largest demand (and cools the largest source)
  // among the variants, so every pump is compared against the same Ist-Situation.
  const realFeasible = (feasible ?? []).filter((p) => !p.theoretical && p.COP > 0);
  const refPool = [...points, ...(maxQPoint ? [maxQPoint] : []), ...realFeasible];
  const refSys = {
    Q: Math.max(...refPool.map((p) => p.Q_demand_total ?? p.Q_demand)),
    Qsrc: Math.max(...refPool.map((p) => p.Q_source)),
  };
  const ref = referenceCost(inp, refSys);
  // Investment defaults to specific cost × heat output until typed in.
  // Investment and specific investment are one value seen two ways: I = c_spez · Q.
  // Editing the investment sets c_spez, so both always agree.
  const capexOf = (p: OptimizedIntegrationPoint) => Math.round(form.specCost * p.Q_demand);
  const setCapexOf = (p: OptimizedIntegrationPoint, v: number) =>
    p.Q_demand > 0 && setForm({ ...form, specCost: Math.round((100 * v) / p.Q_demand) / 100 });
  const variants = points.map((p) => ({
    Q: p.Q_demand,
    Qsrc: p.Q_source,
    cop: p.COP,
    capex: capexOf(p),
  }));
  const results = variants.map((v) => evaluate(inp, refSys, v));

  // Units read out: "a" → "years", "/a" → "/year", where there is room.
  const unitLabel = (u: string) =>
    u === 'a' ? t('economics.years') : u.replace(/\/a$/, `/${t('economics.year')}`);

  const paybackText = (k: number | null) =>
    k === null
      ? t('economics.payback_never', { year: form.year + PAYBACK_HORIZON })
      : `${k} ${t('economics.years')} (${form.year + k})`;

  // Row label with a bulb showing the row's formula and what each term means.
  const rowLabel = (key: string, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      {label}
      <ChartHelpButton
        title={label}
        inline
        description={
          <>
            <div style={formulaStyle}>
              {FORMULAS[key].f.map((line) => (
                <div key={line}>{sym(line)}</div>
              ))}
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {FORMULAS[key].terms.map((s) => (
                <li key={s}>
                  <code>{sym(s)}</code> — {t(`economics.terms.${termKey(s)}`)}
                </li>
              ))}
            </ul>
            {key === 'roi' && <p>{t('economics.roi_assumption')}</p>}
          </>
        }
      />
    </span>
  );

  // Input label with a bulb explaining the value, typical numbers and how it
  // enters the calculation. One paragraph per line of the locale text.
  const inputLabel = (key: string, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      {label}
      <ChartHelpButton
        title={label}
        inline
        description={
          <>
            {t(`economics.input_help.${key}`, { fuel })
              .split('\n')
              .map((line) => (
                <p key={line}>{line}</p>
              ))}
          </>
        }
      />
    </span>
  );

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
      variants.map((v) => {
        const p = breakEvenElPrice(inp, refSys, v, inp.pFuel);
        return p === null ? '–' : formatDe(100 * p, 2);
      }),
    ],
    [
      'roi',
      t('economics.rows.roi'),
      '%',
      '–',
      results.map((r) => (r.roi === null ? '–' : formatDe(100 * r.roi, 2))),
    ],
  ];

  // Plain-language summary of the pump analysed.
  const summaries = points.map((p) => {
    const v = { Q: p.Q_demand, Qsrc: p.Q_source, cop: p.COP, capex: capexOf(p) };
    const r = evaluate(inp, refSys, v);
    const be = breakEvenElPrice(inp, refSys, v, inp.pFuel);
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
  const plot = (data: any[], l: any, onClick?: (e: any) => void) => (
    <div className="pa-chart">
      <Plot
        data={data}
        layout={l}
        config={{ responsive: true }}
        style={{ width: '100%' }}
        onClick={onClick}
      />
    </div>
  );

  const istName = t('economics.ist', { ref: t(`economics.ref.${refType}`) });
  const names = [istName, ...points.map(pointName)];
  const years = Array.from({ length: inp.T + 1 }, (_, k) => form.year + k);

  const barChart = plot(
    [
      {
        type: 'bar',
        name: t('economics.charts.invest'),
        x: names,
        y: [0, ...variants.map((v) => v.capex)],
        // Gold / plum: hues no other chart here uses (blue and orange are the
        // electricity and gas lines next to it) that stay apart for colour-blind
        // readers. The surface-coloured outline leaves a gap between the parts.
        marker: {
          color: isDark ? '#C98500' : '#E0A100',
          line: { color: isDark ? '#1e293b' : '#ffffff', width: 2 },
        },
      },
      {
        type: 'bar',
        name: t('economics.charts.cum_cost'),
        x: names,
        y: [ref.cumCost, ...results.map((r) => r.cumCost)],
        marker: {
          color: isDark ? '#B0558C' : '#8E3B6E',
          line: { color: isDark ? '#1e293b' : '#ffffff', width: 2 },
        },
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
    layout(t('economics.charts.bar_title', { T: inp.T }), {
      barmode: 'stack',
      yaxis: { title: { text: '€' }, tickformat: ',.0f' },
    })
  );

  const priceChart = plot(
    (
      [
        [t('economics.charts.fuel_incl_co2', { fuel }), fuelPrice, '#D97706'],
        [t('economics.charts.el'), elPrice, '#2563EB'],
      ] as const
    ).map(([name, price, color]) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name,
      x: years,
      y: years.map((_, k) => price(inp, k) * 100),
      line: { color, width: 3 },
    })),
    layout(t('economics.charts.price_title'), { yaxis: { title: { text: 'ct/kWh' } } })
  );

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
  const beNow = breakEvenElPrice(inp, refSys, variants[idx], inp.pFuel);
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
  const sensChart = plot(
    [
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
        marker: {
          size: 14,
          color: text,
          line: { color: isDark ? '#1e293b' : '#ffffff', width: 2 },
        },
        hovertemplate: `${t('economics.charts.today')}<br>${fuelAxis}: %{x:,.2f} ct/kWh<br>${t('economics.charts.el')}: %{y:,.2f} ct/kWh<extra></extra>`,
      },
      // Legend-only entries explaining the cell colours, in the map's order:
      // the reference wins on the left (cheap fuel), the heat pump on the right.
      ...(
        [
          [
            'square',
            isDark ? '#c62828' : '#E57373',
            t('economics.charts.side_ref', { ref: refName }),
          ],
          ['square', isDark ? '#2e7d32' : '#66BB6A', t('economics.charts.side_hp')],
        ] as const
      ).map(([symbol, color, name]) => ({
        type: 'scatter',
        mode: 'markers',
        x: [null],
        y: [null],
        name,
        marker: { symbol, size: 12, color },
        hoverinfo: 'skip',
      })),
    ],
    layout(t('economics.charts.sens_title', { funding: form.funding, fuel }), {
      // Taller when there are more rows, so written values stay readable.
      height: Math.max(460, 150 + 24 * elCt.length),
      // The top axis and its title need room below the chart title.
      margin: { l: 90, r: 20, t: 110, b: 30 },
      title: {
        text: t('economics.charts.sens_title', { funding: form.funding, fuel }),
        font: { size: 14, color: text },
        y: 0.98,
      },
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
    // Clicking a cell adopts its prices, so the table and charts follow it.
    (e) => {
      const pt = e.points?.[0];
      if (!pt) return;
      setSensBase((b) => b ?? { fuel: form.pFuel, el: form.pEl });
      setForm({ ...form, pFuel: Number(pt.x), pEl: Number(pt.y) });
    }
  );

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
  const sizeChart = plot(
    [
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
              marker: {
                size: 13,
                color: text,
                line: { color: isDark ? '#1e293b' : '#ffffff', width: 2 },
              },
              customdata: [sizeHover(analysed)],
              hovertemplate: `<b>${t('economics.charts.size_analysed')}</b><br>%{customdata}<br>${t('economics.rows.npv')}: %{y:,.0f} €<extra></extra>`,
            },
          ]
        : []),
    ],
    layout(t('economics.charts.size_title', { ref: refName }), {
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
    // Clicking a size analyses that pump in everything above.
    (e) => {
      const x = Number(e.points?.[0]?.x);
      const hit = sizes.find((s) => s.p.Q_demand === x);
      if (hit) setSelectedHPPoints([hit.p]);
    }
  );
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
  const npvChart = plot(
    runs
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
        };
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
        ].map((tr) => ({ ...tr, x: [null], y: [null], hoverinfo: 'skip' })) as any[]
      ),
    layout(
      t('economics.charts.time_title', {
        fuel,
        gas: formatDe(form.pFuel, 2),
        el: formatDe(form.pEl, 2),
      }),
      {
        showlegend: true,
        yaxis: { title: { text: '€' }, tickformat: ',.0f', zeroline: true, zerolinewidth: 2 },
        xaxis: { dtick: kMax > 20 ? 2 : 1 },
        shapes: [
          // End of the Betrachtungszeitraum.
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
          {
            x: form.year + inp.T,
            yref: 'paper',
            y: 1,
            text: t('economics.charts.period_end', { T: inp.T }),
            showarrow: false,
            xanchor: 'left',
            font: { color: text, size: 11 },
          },
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
    )
  );

  const refSelect = (
    <select
      value={refType}
      onChange={(e) => {
        const type = e.target.value as RefType;
        setRefType(type);
        setForm({ ...form, ...PRESETS[type] });
      }}
    >
      {(Object.keys(PRESETS) as RefType[]).map((type) => (
        <option key={type} value={type}>
          {t(`economics.ref.${type}`)}
        </option>
      ))}
    </select>
  );

  return (
    <Section title={header}>
      {/* 1. The few inputs people actually change, as cards in one row. */}
      <div className="econ-card">
        <div className="econ-card-title">{t('economics.blocks.inputs')}</div>
        <div className="econ-key" key={`key-${resetCount}`}>
          <div className="econ-key-card econ-ref">
            {inputLabel('refType', t('economics.inputs.refType'))}
            {refSelect}
          </div>
          {KEY_FIELDS.map((key) => {
            const [, unit, , range] = FIELDS.find((f) => f[0] === key)!;
            // Specific investment and investment share one card: € per kW × kW = €.
            if (key === 'specCost')
              return (
                <div key={key} className="econ-key-card econ-invest">
                  {rowLabel('capex', t('economics.invest_card'))}
                  <div className="econ-invest-row">
                    <div>
                      <span className="econ-capex-name">
                        {inputLabel('specCost', `${t('economics.inputs.specCost')} [€/kW]`)}
                      </span>
                      <NumInput
                        width={70}
                        value={form.specCost}
                        range={range}
                        onChange={(v) => setForm({ ...form, specCost: v })}
                      />
                    </div>
                    <div className="econ-invest-pumps">
                      {points.map((p) => (
                        <div key={pointKey(p)}>
                          <span className="econ-capex-name">
                            × {formatDe(p.Q_demand)} kW = {t('economics.rows.capex')} [€]
                            {points.length > 1 && ` · ${pointName(p)}`}
                          </span>
                          <NumInput
                            width={90}
                            // Starts at 3.000 €/kW, the top of the specific-cost slider.
                            range={{
                              step: 10000,
                              min: 0,
                              max: Math.round(3000 * p.Q_demand),
                              open: true,
                            }}
                            value={capexOf(p)}
                            onChange={(v) => setCapexOf(p, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            // Price cards: the price and its yearly change side by side.
            const rKey = PRICE_CHANGE[key];
            if (rKey) {
              const [, rUnit, , rRange] = FIELDS.find((f) => f[0] === rKey)!;
              return (
                <div key={key} className="econ-key-card econ-pair">
                  <div className="econ-invest-row">
                    <div>
                      {inputLabel(
                        key,
                        `${t(`economics.inputs.${key}`, { fuel })} [${unitLabel(unit)}]`
                      )}
                      <NumInput
                        width={70}
                        value={form[key]}
                        range={range}
                        onChange={(v) => setPrice({ [key]: v })}
                      />
                    </div>
                    <div>
                      {inputLabel(
                        rKey,
                        `${t('economics.inputs.change_short')} [${unitLabel(rUnit)}]`
                      )}
                      <NumInput
                        width={60}
                        value={form[rKey]}
                        range={rRange}
                        onChange={(v) => setForm({ ...form, [rKey]: v })}
                      />
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={key}
                className={`econ-key-card${NARROW_KEYS.includes(key) ? ' narrow' : ''}`}
              >
                {inputLabel(key, `${t(`economics.inputs.${key}`, { fuel })} [${unitLabel(unit)}]`)}
                <NumInput
                  width={70}
                  value={form[key]}
                  range={range}
                  onChange={(v) => setForm({ ...form, [key]: v })}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. The answer: key results as cards, for the pump analysed. */}
      <div className="econ-card">
        <div className="econ-card-title">
          {t('economics.blocks.results')}
          {points[0] && <span className="econ-card-sub"> · {pointName(points[0])}</span>}
        </div>
        <div className="econ-kpis">
          {KPI_ROWS.map((key) => {
            const [, label, unit, , vals] = rows.find((r) => r[0] === key)!;
            const v = vals[0] ?? '–';
            const signed = SIGNED_ROWS.has(key) && v !== '–';
            return (
              <div
                key={key}
                className="econ-kpi-card"
                style={{ borderLeftColor: KPI_COLORS[key], background: `${KPI_COLORS[key]}0F` }}
              >
                <div className="econ-kpi-label">{rowLabel(key, label)}</div>
                <div
                  className="econ-kpi-value"
                  // A loss still shows in red, whatever the card's colour.
                  style={{ color: signed && v.startsWith('-') ? RED : KPI_COLORS[key] }}
                >
                  {key === 'co2_saving' && results[0] ? (
                    <>
                      {formatDe(results[0].co2Saving * inp.T)}{' '}
                      <span className="econ-unit">t {t('economics.in_years', { T: inp.T })}</span>
                    </>
                  ) : (
                    <>
                      {v} {/* The payback text already carries its unit. */}
                      {key !== 'payback' && <span className="econ-unit">{unitLabel(unit)}</span>}
                    </>
                  )}
                </div>
                {key === 'co2_saving' && (
                  <div className="econ-kpi-sub">
                    = {v} {unitLabel(unit)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Everything else, folded away until needed. */}
      <details className="econ-card econ-more">
        <summary>
          {t('economics.more_inputs')}
          <span className="econ-more-hint">{t('economics.click_to_open')}</span>
        </summary>
        <div className="econ-blocks econ-assumptions" key={`in-${resetCount}`}>
          {GROUPS.map((g) => {
            const fields = FIELDS.filter(
              (f) =>
                f[2] === g &&
                !KEY_FIELDS.includes(f[0]) &&
                !Object.values(PRICE_CHANGE).includes(f[0])
            );
            if (!fields.length) return null;
            return (
              <table key={g} className="pa-table econ-table">
                <thead>
                  <tr>
                    <th colSpan={3}>{t(`economics.groups.${g}`)}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(([key, unit, , range]) => (
                    <tr key={key} className="econ-input-row">
                      <td>{inputLabel(key, t(`economics.inputs.${key}`, { fuel }))}</td>
                      <td>
                        <NumInput
                          width={64}
                          value={form[key]}
                          range={range}
                          grouping={key !== 'year' && key !== 'reinvestYear'}
                          onChange={(v) => setForm({ ...form, [key]: v })}
                        />
                      </td>
                      <td className="econ-unit-cell">{unitLabel(unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })}
        </div>
      </details>

      <details className="econ-card econ-more">
        <summary>
          {t('economics.more_results')}
          <span className="econ-more-hint">{t('economics.click_to_open')}</span>
        </summary>
        <div className="econ-blocks econ-results" key={`out-${resetCount}`}>
          {[RESULT_ROWS_ENERGY, RESULT_ROWS_MONEY].map((keys, half) => (
            <table key={half} className="pa-table econ-table">
              <thead>
                <tr>
                  <th>{t(half === 0 ? 'economics.section_energy' : 'economics.section_money')}</th>
                  <th>{t('economics.unit')}</th>
                  <th>{istName}</th>
                  {points.map((p) => (
                    <th key={pointKey(p)}>{pointName(p)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter(([key]) => keys.includes(key))
                  .map(([key, label, unit, ist, vals]) => (
                    <tr key={key}>
                      <td>{rowLabel(key, label)}</td>
                      <td>{unitLabel(unit)}</td>
                      <td>{ist}</td>
                      {vals.map((v, k) => (
                        <td
                          key={k}
                          style={
                            SIGNED_ROWS.has(key) && v !== '–'
                              ? { color: v.startsWith('-') ? RED : GREEN, fontWeight: 600 }
                              : undefined
                          }
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
        </div>
      </details>

      {/* One row: narrow cost bars, prices, and the wider Kapitalwert chart,
          tight together so the heatmap is in view right below. */}
      <div className="econ-card">
        <div className="econ-card-title">{t('economics.blocks.charts')}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 1fr) minmax(260px, 1.4fr) minmax(360px, 2.6fr)',
            gap: '0.25rem',
            overflowX: 'auto',
          }}
        >
          {barChart}
          {priceChart}
          {npvChart}
        </div>
      </div>

      <div className="econ-card">
        <div className="econ-card-title">{t('economics.blocks.sensitivity')}</div>

        <p
          style={{
            fontSize: '0.85rem',
            margin: '0.25rem 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span>{sensExplain}</span>
          <ChartHelpButton
            title={t('economics.sens_help_title')}
            inline
            description={
              <>
                {t('economics.sens_help', { fuel, ref: refName, T: inp.T })
                  .split('\n')
                  .map((line) => (
                    <p key={line}>{line}</p>
                  ))}
              </>
            }
          />
        </p>
        <p style={{ fontSize: '0.75rem', opacity: 0.75, margin: '0.1rem 0 0' }}>
          {t('economics.sens_click')}
        </p>
        {sensChart}
      </div>

      <div className="econ-card">
        <div className="econ-card-title">{t('economics.blocks.size')}</div>
        <p
          style={{
            fontSize: '0.85rem',
            margin: '0.25rem 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span>{sizeExplain}</span>
          <ChartHelpButton
            title={t('economics.blocks.size')}
            inline
            description={
              <>
                {t('economics.size_help', { ref: refName })
                  .split('\n')
                  .map((line) => (
                    <p key={line}>{line}</p>
                  ))}
              </>
            }
          />
        </p>
        <p style={{ fontSize: '0.75rem', opacity: 0.75, margin: '0.1rem 0 0' }}>
          {t('economics.size_click')}
        </p>
        {sizeChart}
      </div>

      <div className="econ-card">
        <div className="econ-card-title">{t('economics.blocks.summary')}</div>

        {summaries.map((sm) => (
          <p
            key={sm.name}
            style={{
              fontSize: '0.85rem',
              lineHeight: 1.5,
              margin: '0 0 0.5rem',
              paddingLeft: '0.6rem',
              borderLeft: `4px solid ${sm.good ? GREEN : RED}`,
            }}
          >
            <b>{sm.name}:</b> {sm.text}
          </p>
        ))}
      </div>
    </Section>
  );
}
