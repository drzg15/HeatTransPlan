/** The heat pump drawn as its three circuits, with the four temperatures as
 *  fields to try out: every way the optimization rates a pump (4- and
 *  2-temperature model, Carnot) answers live, the chosen one highlights the
 *  temperatures it reads, and inputs the training data never had are named. */

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rateCopPoint } from '../../api/analysis';
import type {
  CopModel,
  CopPointResult,
  OptimizedIntegrationPoint,
  SearchTemp,
} from '../../types/analysis';
import CopModelDebug from './CopModelDebug';
import { balance, profileAt, type Profile } from './heatPumpBalance';
import './CopFormulaModal.css';
import './HeatPumpView.css';

type Temp = 'sourceIn' | 'sourceOut' | 'sinkIn' | 'sinkOut';
type Side = 'source' | 'sink';
const SIDE: Record<Temp, Side> = {
  sourceIn: 'source',
  sourceOut: 'source',
  sinkIn: 'sink',
  sinkOut: 'sink',
};
// The names the optimization request uses (search_temps).
const API: Record<Temp, SearchTemp> = {
  sourceIn: 'source_in',
  sourceOut: 'source_out',
  sinkIn: 'sink_in',
  sinkOut: 'sink_out',
};
type Case = '4t' | '2t' | 'carnot';

/** Which temperatures each calculation reads. */
const USES: Record<Case, Temp[]> = {
  '4t': ['sourceIn', 'sourceOut', 'sinkIn', 'sinkOut'],
  '2t': ['sourceOut', 'sinkOut'],
  carnot: ['sourceIn', 'sinkOut'],
};
const TEMPS: Temp[] = ['sourceIn', 'sourceOut', 'sinkIn', 'sinkOut'];
const GERMAN: Record<Temp, string> = {
  sourceIn: 'T_vorlauf_Quelle',
  sourceOut: 'T_rücklauf_Quelle',
  sinkIn: 'T_rücklauf_Senke',
  sinkOut: 'T_Vorlauf_Senke',
};

export interface PumpOption {
  refrigerant: string;
  medium_sink: string;
}

interface Props {
  point: OptimizedIntegrationPoint;
  pinchTemperature: number;
  tMin: number;
  pumps: PumpOption[];
  /** The profiles the optimization searched along (shifted scale, ascending T). */
  sourceProfile: Profile;
  sinkProfile: Profile;
  /** The COP model the page's optimization runs with. */
  copModel: CopModel;
  /** Which temperatures the optimization searches; the rest sit at the pinch. */
  searchTemps: SearchTemp[];
  /** Changes the optimization's search (it re-runs). */
  onSearchTemps: (next: SearchTemp[]) => void;
  onClose: () => void;
}

const SOURCE = '#0A75C4';
const SINK = '#C138A0';
const FLUID = '#7E3FA8';

export default function HeatPumpView({
  point,
  pinchTemperature,
  tMin,
  pumps,
  sourceProfile,
  sinkProfile,
  copModel,
  searchTemps,
  onSearchTemps,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const half = tMin / 2;
  // Where the search stands on each profile (shifted scale): a searched
  // temperature follows its side, a fixed one keeps its own value, which starts
  // at the pinch (source side pinch − ΔTmin/2, sink side pinch + ΔTmin/2).
  const pinchAt: Record<Side, number> = {
    source: pinchTemperature - half,
    sink: pinchTemperature + half,
  };
  const startGrid = { source: point.T_source, sink: point.T_sink };
  const startFixed: Record<Temp, number> = {
    sourceIn: pinchAt.source,
    sourceOut: pinchAt.source,
    sinkIn: pinchAt.sink,
    sinkOut: pinchAt.sink,
  };
  const [grid, setGrid] = useState<Record<Side, number>>(startGrid);
  const [fixed, setFixed] = useState(startFixed);
  // The text of the field being typed in, so "6" on the way to "66" stays put.
  const [editing, setEditing] = useState<{ k: Temp; raw: string } | null>(null);
  const searched = (k: Temp) => searchTemps.includes(API[k]);
  const value = (k: Temp) => (searched(k) ? grid[SIDE[k]] : fixed[k]);
  const temps: Record<Temp, number> = {
    sourceIn: value('sourceIn'),
    sourceOut: value('sourceOut'),
    sinkIn: value('sinkIn'),
    sinkOut: value('sinkOut'),
  };

  // The pump shown: the selected one when it is a real machine (the trained
  // models need one), otherwise the first real one in the results.
  const startPump = point.theoretical
    ? pumps[0]
    : (pumps.find(
        (p) => p.refrigerant === point.refrigerant && p.medium_sink === point.medium_sink
      ) ?? pumps[0]);
  const [pump, setPump] = useState<PumpOption | undefined>(startPump);
  const [chosen, setChosen] = useState<Case>(copModel);
  const [result, setResult] = useState<CopPointResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pump' | 'model'>('pump');

  const { sourceIn, sourceOut, sinkIn, sinkOut } = temps;
  useEffect(() => {
    if (!pump) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      rateCopPoint({
        refrigerant: pump.refrigerant,
        medium_sink: pump.medium_sink,
        T_source_in: sourceIn,
        T_source_out: sourceOut,
        T_sink_in: sinkIn,
        T_sink_out: sinkOut,
      })
        .then((r) => !cancelled && (setResult(r), setError(null)))
        .catch(() => !cancelled && setError(t('hp_view.error')));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pump, sourceIn, sourceOut, sinkIn, sinkOut, t]);

  const reset = () => {
    setGrid(startGrid);
    setFixed(startFixed);
    setEditing(null);
    setPump(startPump);
  };
  const edit = (k: Temp, raw: string) => {
    setEditing({ k, raw });
    const v = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(v)) return;
    if (searched(k)) setGrid((g) => ({ ...g, [SIDE[k]]: v }));
    else setFixed((f) => ({ ...f, [k]: v }));
  };
  const toggle = (k: Temp) =>
    onSearchTemps(searched(k) ? searchTemps.filter((s) => s !== API[k]) : [...searchTemps, API[k]]);

  const cop =
    result &&
    (chosen === '4t' ? result.cop_4t : chosen === '2t' ? result.cop_2t : result.carnot_50);
  // The optimization's own steps: the demand above the sink position off the
  // sink profile, the waste heat down to the source position off the source
  // profile, and whether the COP makes them meet.
  const qSink = profileAt(sinkProfile, grid.sink) ?? point.Q_demand;
  const qAvailable = profileAt(sourceProfile, grid.source);
  const bal = cop != null && qAvailable !== null ? balance(qSink, cop, qAvailable) : null;
  const pEl = bal ? bal.pEl : null;
  const qSource = bal ? bal.needed : null;
  const kw = (v: number | null) => (v === null ? '–' : `${v.toFixed(1)} kW`);
  const range = (p: Profile) => [Math.min(...p.T), Math.max(...p.T)] as const;
  type Slider = { side: Side; color: string; r: readonly [number, number] };
  const sliders = (
    [
      { side: 'source', color: SOURCE, r: range(sourceProfile) },
      { side: 'sink', color: SINK, r: range(sinkProfile) },
    ] as Slider[]
  ).filter((s) => Number.isFinite(s.r[0]) && s.r[1] > s.r[0]);
  const used = (k: Temp) => USES[chosen].includes(k);

  const field = (k: Temp, x: number, y: number, color: string) => (
    <foreignObject x={x} y={y} width={200} height={72}>
      <div className={`hpv-temp ${used(k) ? '' : 'hpv-unused'}`} style={{ color }}>
        <div className="hpv-name">
          T<sub>{t(`hp_view.sub.${k}`)}</sub>
          <label
            className={`hpv-badge ${searched(k) ? 'hpv-searched' : ''}`}
            title={t('hp_view.toggle_hint')}
          >
            <input
              type="checkbox"
              checked={searched(k)}
              onChange={() => toggle(k)}
              aria-label={t('hp_view.search_this', { name: `T ${t(`hp_view.sub.${k}`)}` })}
            />
            {searched(k) ? t('hp_view.searched') : t('hp_view.fixed')}
          </label>
        </div>
        <div className="hpv-german">{GERMAN[k]}</div>
        <label className="hpv-value">
          <input
            type="text"
            inputMode="decimal"
            value={editing?.k === k ? editing.raw : value(k).toFixed(1)}
            onChange={(e) => edit(k, e.target.value)}
            onBlur={() => setEditing(null)}
            style={{ color }}
            aria-label={t(`hp_view.name.${k}`)}
          />
          °C
        </label>
      </div>
    </foreignObject>
  );
  const arrow = (id: string, color: string) => (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="12"
      markerHeight="12"
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  );

  const rows: Array<{
    key: Case;
    label: string;
    value: number | null | undefined;
    extra?: string;
  }> = [
    { key: '4t', label: t('hp_view.case_4t'), value: result?.cop_4t },
    { key: '2t', label: t('hp_view.case_2t'), value: result?.cop_2t },
    {
      key: 'carnot',
      label: t('hp_view.case_carnot'),
      value: result?.carnot_50,
      extra: result?.carnot_ideal
        ? t('hp_view.ideal', { value: result.carnot_ideal.toFixed(2) })
        : undefined,
    },
  ];

  return (
    <div className="cf-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cf-modal hpv-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('hp_view.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cf-header">
          <h3>{t('hp_view.title')}</h3>
          <div className="hpv-tabs" role="tablist">
            {(['pump', 'model'] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={tab === k ? 'active' : ''}
                onClick={() => setTab(k)}
              >
                {t(`hp_view.tab_${k}`)}
              </button>
            ))}
          </div>
          <button className="cf-close" onClick={onClose} aria-label={t('cop_modal.close')}>
            <X size={16} />
          </button>
        </header>

        {tab === 'model' ? (
          <div className="cf-body">
            <CopModelDebug
              initial={{
                name: pump?.refrigerant ?? 'Butane_2',
                medium_sink: pump?.medium_sink ?? 'Water',
                T_source_in: Math.round(temps.sourceIn * 10) / 10,
                T_source_out: Math.round(temps.sourceOut * 10) / 10,
                T_sink_in: Math.round(temps.sinkIn * 10) / 10,
                T_sink_out: Math.round(temps.sinkOut * 10) / 10,
              }}
            />
          </div>
        ) : (
          <div className="cf-body">
            <div className="hpv-toolbar">
              <label>
                {t('hp_view.pump')}{' '}
                <select
                  value={pump ? `${pump.refrigerant}|${pump.medium_sink}` : ''}
                  onChange={(e) => {
                    const [refrigerant, medium_sink] = e.target.value.split('|');
                    setPump({ refrigerant, medium_sink });
                  }}
                >
                  {pumps.map((p) => (
                    <option
                      key={`${p.refrigerant}|${p.medium_sink}`}
                      value={`${p.refrigerant}|${p.medium_sink}`}
                    >
                      {p.refrigerant} · {p.medium_sink}
                    </option>
                  ))}
                </select>
              </label>
              <span className="cf-muted">{t('hp_view.scale', { half: half.toFixed(1) })}</span>
            </div>

            <svg
              className="hpv-diagram"
              viewBox="0 0 1000 430"
              role="img"
              aria-label={t('hp_view.title')}
            >
              <defs>
                {arrow('hpv-a-src', SOURCE)}
                {arrow('hpv-a-snk', SINK)}
                {arrow('hpv-a-fl', FLUID)}
              </defs>
              {[
                [10, 330, t('hp_view.circuit1')],
                [345, 310, t('hp_view.circuit2')],
                [670, 320, t('hp_view.circuit3')],
              ].map(([x, w, label]) => (
                <g key={String(label)}>
                  <text
                    x={Number(x) + Number(w) / 2}
                    y={22}
                    textAnchor="middle"
                    className="hpv-circuit"
                  >
                    {label}
                  </text>
                  <rect x={Number(x)} y={36} width={Number(w)} height={384} className="hpv-frame" />
                </g>
              ))}

              {/* waste heat: in at the bottom, out at the top */}
              <polyline
                points="30,330 235,330 235,262"
                className="hpv-pipe"
                stroke={SOURCE}
                markerEnd="url(#hpv-a-src)"
              />
              <polyline
                points="235,168 235,110 30,110"
                className="hpv-pipe"
                stroke={SOURCE}
                markerEnd="url(#hpv-a-src)"
              />
              {/* process heat */}
              <polyline
                points="970,330 765,330 765,262"
                className="hpv-pipe"
                stroke={SINK}
                markerEnd="url(#hpv-a-snk)"
              />
              <polyline
                points="765,168 765,110 970,110"
                className="hpv-pipe"
                stroke={SINK}
                markerEnd="url(#hpv-a-snk)"
              />
              {/* refrigerant: evaporator → compressor → condenser → valve */}
              <polyline points="290,168 290,75 474,75" className="hpv-pipe" stroke={FLUID} />
              <polyline
                points="526,75 712,75 712,166"
                className="hpv-pipe"
                stroke={FLUID}
                markerEnd="url(#hpv-a-fl)"
              />
              <polyline points="712,262 712,370 520,370" className="hpv-pipe" stroke={FLUID} />
              <polyline
                points="480,370 290,370 290,264"
                className="hpv-pipe"
                stroke={FLUID}
                markerEnd="url(#hpv-a-fl)"
              />
              <circle cx={500} cy={75} r={26} className="hpv-box" stroke={FLUID} />
              <text x={500} y={81} textAnchor="middle" className="hpv-c" fill={FLUID}>
                C
              </text>
              <path
                d="M480,358 L500,370 L480,382 Z M520,358 L500,370 L520,382 Z"
                className="hpv-box"
                stroke={FLUID}
              />
              <text x={500} y={402} textAnchor="middle" className="hpv-small" fill={FLUID}>
                {t('hp_view.valve')}
              </text>
              <text x={538} y={104} className="hpv-label" fill={FLUID}>
                {t('hp_view.compressor')}
              </text>
              <text x={538} y={124} className="hpv-label" fill={FLUID}>
                P
                <tspan baselineShift="sub" fontSize="11">
                  el
                </tspan>{' '}
                {kw(pEl)}
              </text>

              <rect x={180} y={168} width={150} height={94} className="hpv-box" stroke="#181C62" />
              <text x={255} y={207} textAnchor="middle" className="hpv-label">
                {t('hp_view.evaporator')}
              </text>
              <text x={255} y={230} textAnchor="middle" className="hpv-label" fill={SOURCE}>
                Q
                <tspan baselineShift="sub" fontSize="11">
                  source
                </tspan>{' '}
                {kw(qSource)}
              </text>
              <rect x={670} y={168} width={150} height={94} className="hpv-box" stroke="#181C62" />
              <text x={745} y={207} textAnchor="middle" className="hpv-label">
                {t('hp_view.condenser')}
              </text>
              <text x={745} y={230} textAnchor="middle" className="hpv-label" fill={SINK}>
                Q
                <tspan baselineShift="sub" fontSize="11">
                  sink
                </tspan>{' '}
                {kw(qSink)}
              </text>

              <text x={500} y={200} textAnchor="middle" className="hpv-cop">
                {cop ? `COP ${cop.toFixed(2)}` : 'COP –'}
              </text>
              <text x={500} y={226} textAnchor="middle" className="hpv-small">
                {rows.find((r) => r.key === chosen)?.label}
              </text>
              {pump && (
                <text x={500} y={248} textAnchor="middle" className="hpv-small">
                  {pump.refrigerant} · {pump.medium_sink}
                </text>
              )}

              {field('sourceOut', 30, 38, SOURCE)}
              {field('sourceIn', 30, 338, SOURCE)}
              {field('sinkOut', 780, 38, SINK)}
              {field('sinkIn', 780, 338, SINK)}
            </svg>

            <div className="hpv-calc-row">
              <section className="hpv-search">
                <h4>{t('hp_view.search_title')}</h4>
                {sliders.map(({ side, color, r }) => {
                  const follow = TEMPS.filter((k) => SIDE[k] === side && searched(k));
                  return (
                    <label key={side} className="hpv-slider" style={{ color }}>
                      <span>
                        {t(`hp_view.search_${side}`)} {grid[side].toFixed(1)} °C
                      </span>
                      <input
                        type="range"
                        min={r[0]}
                        max={r[1]}
                        step={0.1}
                        value={Math.min(r[1], Math.max(r[0], grid[side]))}
                        onChange={(e) => {
                          setEditing(null);
                          setGrid((g) => ({ ...g, [side]: parseFloat(e.target.value) }));
                        }}
                        style={{ accentColor: color }}
                      />
                      <span className="cf-muted">
                        {r[0].toFixed(1)} – {r[1].toFixed(1)} °C {t('hp_view.along_profile')} ·{' '}
                        {follow.length
                          ? t('hp_view.follows', {
                              names: follow.map((k) => `T ${t(`hp_view.sub.${k}`)}`).join(', '),
                            })
                          : t('hp_view.follows_none')}
                      </span>
                    </label>
                  );
                })}
              </section>

              <section className="hpv-calc">
                <h4>{t('hp_view.calc_title')}</h4>
                <ol>
                  <li>
                    {t('hp_view.step_qsink', { t: grid.sink.toFixed(1) })} <b>{kw(qSink)}</b>
                  </li>
                  <li>
                    {t('hp_view.step_cop', { name: rows.find((r) => r.key === chosen)?.label })}{' '}
                    <b>{cop != null ? cop.toFixed(2) : '–'}</b>
                  </li>
                  <li>
                    {t('hp_view.step_needed')} <code>Q_sink · (COP − 1) / COP</code> ={' '}
                    <b>{kw(bal ? bal.needed : null)}</b>
                  </li>
                  <li>
                    {t('hp_view.step_available', { t: grid.source.toFixed(1) })}{' '}
                    <b>{kw(qAvailable)}</b>
                  </li>
                  <li>
                    {t('hp_view.step_pel')} <code>Q_sink / COP</code> = <b>{kw(pEl)}</b>
                  </li>
                </ol>
                {bal && (
                  <p className={`hpv-verdict hpv-${bal.state}`}>
                    {t(`hp_view.state.${bal.state}`, {
                      gap: Math.abs(bal.gap).toFixed(1),
                      possible: bal.qSinkPossible.toFixed(1),
                    })}
                  </p>
                )}
              </section>
            </div>

            <table className="hpv-cases">
              <thead>
                <tr>
                  <th>{t('hp_view.case')}</th>
                  {TEMPS.map((k) => (
                    <th key={k}>
                      T<sub>{t(`hp_view.sub.${k}`)}</sub>
                    </th>
                  ))}
                  <th>COP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className={r.key === chosen ? 'hpv-chosen' : ''}
                    onClick={() => setChosen(r.key)}
                  >
                    <td>
                      <label>
                        <input
                          type="radio"
                          name="hpv-case"
                          checked={r.key === chosen}
                          onChange={() => setChosen(r.key)}
                        />{' '}
                        {r.label}
                      </label>
                    </td>
                    {TEMPS.map((k) => (
                      <td key={k} className="hpv-mark">
                        {USES[r.key].includes(k) ? '✓' : '–'}
                      </td>
                    ))}
                    <td className="hpv-num">
                      {r.value != null ? r.value.toFixed(2) : '–'}
                      {r.extra && <span className="cf-muted"> {r.extra}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="cf-muted hpv-note">{t('hp_view.optimization_note')}</p>

            {error && <p className="hpv-warn">{error}</p>}
            {result && result.checks.length > 0 && (
              <ul className="hpv-warn">
                {result.checks.map((c) => (
                  <li key={c.code}>
                    {t(`hp_view.check.${c.code}`, {
                      value: c.value?.toFixed(1),
                      min: c.min?.toFixed(0),
                      max: c.max?.toFixed(0),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <footer className="cf-footer">
          {tab === 'pump' && (
            <button className="cf-btn" onClick={reset}>
              {t('hp_view.reset')}
            </button>
          )}
          <span className="cf-spacer" />
          <button className="cf-btn cf-btn-primary" onClick={onClose}>
            {t('hp_view.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
