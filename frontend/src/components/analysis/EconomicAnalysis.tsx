/** EconomicAnalysis — Kapitalwert, payback and sensitivity of the selected heat
 *  pump against the heater (and cooling) it replaces. Layout follows the Hipp
 *  presentation (Randbedingungen table, cost bars, Barwertverlauf, Strom-/
 *  Gaspreis sensitivity); the numbers and charts come from econModel.ts, the
 *  formulas from utils/economics.ts. */

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import ChartHelpButton from '../ui/ChartHelpButton';
import Part from '../ui/Part';
import {
  BOOL_FIELDS,
  buildEconomics,
  DEFAULTS,
  FIELDS,
  GROUPS,
  GREEN,
  PRESETS,
  RED,
  RESULT_ROWS_ENERGY,
  RESULT_ROWS_MONEY,
  SIGNED_ROWS,
  pointKey,
  pointName,
  type Form,
  type Range,
  type RefType,
} from './econModel';
import { formatDe, parseDe } from '../../utils/numberFormat';
import type { OptimizedIntegrationPoint } from '../../types/analysis';

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
  capex: {
    f: ['I = c_spez · F_PI · F_Per · Q'],
    terms: ['I', 'c_spez', 'F_PI', 'F_Per', 'Q'],
  },
  spec_total: {
    f: ['c_inst = c_spez · F_PI · F_Per'],
    terms: ['c_inst', 'c_spez', 'F_PI', 'F_Per'],
  },
  q: { f: ['Ist: Q_ref = max(Q_demand_total)', 'WP: Q = Q_demand'], terms: ['Q_ref', 'Q'] },
  qsrc: {
    f: ['Ist: Q_src,ref = max(Q_source)', 'WP: Q_src = Q_source'],
    terms: ['Q_src,ref', 'Q_src'],
  },
  cop: { f: ['COP = Q / P_el'], terms: ['COP', 'P_el'] },
  fuel: {
    f: ['E_fuel,Ist = Q_ref · h / η', 'E_fuel,WP = (Q_ref − Q) · h / η   [kWh Hs]'],
    terms: ['E_fuel', 'Q_ref', 'Q', 'h', 'η'],
  },
  el: { f: ['E_el = Q · h / COP'], terms: ['E_el', 'Q', 'h', 'COP'] },
  elCool: {
    f: ['E_cool,Ist = Q_src,ref · h · a / EER', 'E_cool,WP = (Q_src,ref − Q_src) · h · a / EER'],
    terms: ['E_cool', 'Q_src,ref', 'Q_src', 'h', 'a', 'EER'],
  },
  opex1: {
    f: [
      'K(t) = E_fuel · p_fuel(t) + (E_el + E_cool) · p_el(t) + f_W · I + t_AB · w + p_L · P_el − f_k,ref · I_ref − F_B(t)',
      'F_B(t) = f_B · Q · h  (t ≤ t_B, else 0)',
      'p_fuel(t) = p_fuel,0 · (1 + r_fuel)^t + c_CO2 / (Hs/Hi) · p_CO2,0 · (1 + r_CO2)^t',
      'p_el(t) = p_el,0 · (1 + r_el)^t  [+ c_CO2,el · p_CO2(t), if CO₂ on electricity]',
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
      't_AB',
      'w',
      'I_ref',
      'f_k,ref',
      'Hs/Hi',
    ],
  },
  energy_saving: {
    f: ['ΔE = (E_fuel + E_cool)_Ist − (E_fuel + E_el + E_cool)_WP'],
    terms: ['E_fuel', 'E_el', 'E_cool'],
  },
  saving1: { f: ['S(1) = K_Ist(1) − K_WP(1)'], terms: ['K'] },
  co2: {
    f: ['CO2 = E_fuel / (Hs/Hi) · c_CO2 + (E_el + E_cool) · c_CO2,el'],
    terms: ['E_fuel', 'Hs/Hi', 'E_el', 'E_cool', 'c_CO2', 'c_CO2,el'],
  },
  co2_saving: { f: ['ΔCO2 = CO2_Ist − CO2_WP'], terms: ['c_CO2', 'c_CO2,el'] },
  payback: {
    f: [
      't_A = min { k : KW(k) ≥ 0 }',
      'KW(k) = −(1 − φ) · I + I_ref + Σ_{t=1..k} (CF(t) − R(t)) / (1 + i)^t',
    ],
    terms: ['t_A', 'k', 'KW', 'φ', 'I', 'I_ref', 'CF', 'R', 'i'],
  },
  residual: {
    f: ['RW = I · (1 + r_inv)^(n·L) · ((n + 1) · L − T) / L', 'n = ⌈T / L⌉ − 1'],
    terms: ['RW', 'I', 'r_inv', 'n', 'T', 'L'],
  },
  npv: {
    f: [
      'KW = −(1 − φ) · I + I_ref + Σ_{t=1..T} (CF(t) − R(t)) / (1 + i)^t + RW / (1 + i)^T',
      'CF(t) = K_Ist(t) − K_WP(t)',
      'R(t) = I · (1 + r_inv)^t at t = L, 2L, … (< T) + manual reinvestment',
    ],
    terms: ['KW', 'φ', 'I', 'I_ref', 'CF', 'K', 'R', 'RW', 'r_inv', 'L', 'i', 'T', 't'],
  },
  payback_static: {
    f: ['PP = ((1 − φ) · I − I_ref) / S(1)'],
    terms: ['PP', 'φ', 'I', 'I_ref', 'K'],
  },
  irr: {
    f: ['IRR: KW(i = IRR) = 0'],
    terms: ['IRR', 'KW'],
  },
  lcoh_hp: {
    f: [
      'LCOH_WP = a_T · PV(capital + f_W · I + t_AB · w + p_L · P_el + α · E_el · p_el(t) − F_B) / (Q · h)',
      'a_T = i / (1 − (1 + i)^−T)',
    ],
    terms: ['LCOH', 'a_T', 'α', 'E_el', 'I', 'Q', 'h', 'i', 'T'],
  },
  lcoh_ref: {
    f: ['LCOH_Ist = a_T · PV(Q · h / η · p_fuel(t) + f_k,ref · I_ref) / (Q · h)'],
    terms: ['LCOH', 'a_T', 'η', 'I_ref', 'f_k,ref'],
  },
  alpha: {
    f: ['α = (COP / η) / (COP / η + a · COP_KA / EER)', 'COP_KA = COP − 1;  COP_α = COP / α'],
    terms: ['α', 'COP', 'η', 'a', 'EER'],
  },
  capex_vdi: {
    f: ['k_Inv = F_WP · Q^E_WP · F_PI · F_Per / Q'],
    terms: ['F_WP', 'E_WP', 'F_PI', 'F_Per', 'Q'],
  },
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
  ({ η: 'eta', φ: 'phi', α: 'alpha', 'p_el*': 'p_el_star', 'Hs/Hi': 'hs_hi' })[sym] ??
  sym.replace(/,/g, '_');

// The inputs shown up front; all others sit under "More assumptions".
const KEY_FIELDS: Array<keyof Form> = ['pFuel', 'pEl', 'specCost', 'funding', 'T', 'i'];
// Each price card also carries its yearly price change, next to the price.
const PRICE_CHANGE: Partial<Record<keyof Form, keyof Form>> = { pFuel: 'rFuel', pEl: 'rEl' };
// Short values that get a narrower card.
const NARROW_KEYS: Array<keyof Form> = ['funding', 'T', 'i'];
// The results shown up front, one line per pump.

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
  const opt = useAnalysisStore((s) => s.hpiOptimizationResult);
  const setSelectedHPPoints = useAnalysisStore((s) => s.setSelectedHPPoints);
  const isDark = useUIStore((s) => s.theme) === 'dark';
  // Inputs live in the store, so they survive navigation and reach the report.
  const form = useAnalysisStore((s) => s.econForm);
  const refType = useAnalysisStore((s) => s.econRefType);
  const setEcon = useAnalysisStore((s) => s.setEcon);
  const setForm = (f: Form) => setEcon(f, refType);
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
    setEcon(DEFAULTS, 'gas');
    setSensBase(null);
    setResetCount((n) => n + 1);
  };

  // The part's banner is the title; it carries the help bulb and reset.
  const header = (
    <>
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
        <RotateCcw size={13} /> {t('economics.reset')}
      </button>
    </>
  );

  const e = buildEconomics(t, form, refType, selected, opt, isDark, sensBase);
  if (!e) {
    return (
      <Part
        n={3}
        title={t('analysis.parts.costs')}
        input={t('analysis.parts.costs_in')}
        actions={header}
      >
        <p style={{ fontSize: '0.85rem' }}>{t('economics.empty')}</p>
      </Part>
    );
  }

  const {
    points,
    inp,
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
    figures,
    capexOf,
  } = e;
  // Editing the investment sets c_spez, so both always agree.
  // The input is the heat pump's own price, so the factors are taken back out.
  const setCapexOf = (p: OptimizedIntegrationPoint, v: number) =>
    p.Q_demand > 0 &&
    setForm({
      ...form,
      specCost: Math.round((100 * v) / (p.Q_demand * form.fPI * form.fPer)) / 100,
    });

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

  const plot = ({ data, layout }: { data: any[]; layout: any }, onClick?: (e: any) => void) => (
    <div className="pa-chart">
      <Plot
        data={data}
        layout={layout}
        config={{ responsive: true }}
        style={{ width: '100%' }}
        onClick={onClick}
      />
    </div>
  );

  const barChart = plot(figures.bar);
  const priceChart = plot(figures.price);
  const npvChart = plot(figures.npv);
  // Clicking a cell adopts its prices, so the table and charts follow it.
  const sensChart = plot(figures.sens, (ev) => {
    const pt = ev.points?.[0];
    if (!pt) return;
    setSensBase((b) => b ?? { fuel: form.pFuel, el: form.pEl });
    setForm({ ...form, pFuel: Number(pt.x), pEl: Number(pt.y) });
  });
  // Clicking a size analyses that pump in everything above.
  const sizeChart = plot(figures.size, (ev) => {
    const x = Number(ev.points?.[0]?.x);
    const hit = sizes.find((s) => s.p.Q_demand === x);
    if (hit) setSelectedHPPoints([hit.p]);
  });

  const refSelect = (
    <select
      value={refType}
      onChange={(ev) => {
        const type = ev.target.value as RefType;
        setEcon({ ...form, ...PRESETS[type] }, type);
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
    <Part
      n={3}
      title={t('analysis.parts.costs')}
      input={t('analysis.parts.costs_in')}
      actions={header}
    >
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
                            × {formatDe(form.fPI, 2)} × {formatDe(form.fPer, 2)} ×{' '}
                            {formatDe(p.Q_demand)} kW = {t('economics.rows.capex')} [€]
                            {points.length > 1 && ` · ${pointName(p)}`}
                          </span>
                          <NumInput
                            width={90}
                            // Starts at 3.000 €/kW installed.
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
                  width={NARROW_KEYS.includes(key) ? 56 : 70}
                  value={form[key]}
                  range={range}
                  onChange={(v) => setForm({ ...form, [key]: v })}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. The other inputs, folded away right under the key ones. */}
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
                        {BOOL_FIELDS.includes(key) ? (
                          <input
                            type="checkbox"
                            checked={Boolean(form[key])}
                            onChange={(e) => setForm({ ...form, [key]: e.target.checked ? 1 : 0 })}
                          />
                        ) : (
                          <NumInput
                            width={64}
                            value={form[key]}
                            range={range}
                            grouping={key !== 'year' && key !== 'reinvestYear'}
                            onChange={(v) => setForm({ ...form, [key]: v })}
                          />
                        )}
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

      {/* 3. The answer: key results as cards, for the pump analysed. */}
      <div className="econ-card">
        <div className="econ-card-title">
          {t('economics.blocks.results')}
          {points[0] && <span className="econ-card-sub"> · {pointName(points[0])}</span>}
        </div>
        <div className="econ-kpis">
          {kpis.map((k) => (
            <div
              key={k.key}
              className="econ-kpi-card"
              style={{ borderLeftColor: k.color, background: `${k.color}0F` }}
            >
              <div className="econ-kpi-label">{rowLabel(k.key, k.label)}</div>
              <div className="econ-kpi-value" style={{ color: k.valueColor }}>
                {k.value} {k.unit && <span className="econ-unit">{k.unit}</span>}
              </div>
              {k.sub && <div className="econ-kpi-sub">{k.sub}</div>}
            </div>
          ))}
        </div>
      </div>

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
                {keys
                  .map((k) => rows.find((r) => r[0] === k)!)
                  .filter(Boolean)
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
    </Part>
  );
}
