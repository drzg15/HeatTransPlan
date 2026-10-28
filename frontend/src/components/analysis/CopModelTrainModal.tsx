/** CopModelTrainModal — train a COP model on the user's own heat pump data.
 *
 *  Upload a table, say which column holds what, train. The backend fits a
 *  neural network on 80 % of the rows and tests it on the rest; the metrics
 *  and a predicted-vs-actual chart show how far to trust it. "Use this model"
 *  puts it into the optimization next to the shipped model. Part of the COP
 *  training module, which the server can switch off. */

import { LoaderCircle, Upload, X } from 'lucide-react';
import { useState } from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { inspectCopData, trainCopModel } from '../../api/copTraining';
import type {
  ModelKind,
  ColumnMapping,
  CopInspectResult,
  CopRole,
  CopTrainResult,
  CustomCopModelSpec,
} from '../../types/copTraining';
import { formatDe } from '../../utils/numberFormat';
import './CopFormulaModal.css';

interface Props {
  initial: CustomCopModelSpec | null;
  onCancel: () => void;
  onApply: (model: CustomCopModelSpec | null) => void;
}

const REQUIRED: CopRole[] = ['T_source_out', 'T_sink_out', 'COP'];
const OPTIONAL: CopRole[] = ['T_source_in', 'T_sink_in', 'medium', 'refrigerant', 'stages'];

// The range the backend offers by default: the data's, the sink capped.
const SINK_CAP = 180;
const capped = (env: Record<string, number>) => ({
  ...env,
  T_sink_min: Math.min(env.T_sink_min, SINK_CAP),
  T_sink_max: Math.min(env.T_sink_max, SINK_CAP),
});
const RANGE_KEYS = ['T_source_min', 'T_source_max', 'T_sink_min', 'T_sink_max'];
const sameRange = (a: Record<string, number>, b: Record<string, number>) =>
  RANGE_KEYS.every((k) => a[k] === b[k]);

const errorText = (e: unknown) => {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : e instanceof Error ? e.message : String(e);
};

export default function CopModelTrainModal({ initial, onCancel, onApply }: Props) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState<CopInspectResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [name, setName] = useState(initial?.name ?? 'My COP model');
  const [busy, setBusy] = useState<'reading' | 'training' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopTrainResult | null>(null);
  const [kind, setKind] = useState<ModelKind>(initial?.kind ?? 'nn');
  const [degree, setDegree] = useState(initial?.metrics.degree ?? 2);
  const [sheet, setSheet] = useState<string | null>(null);
  // null: offer the model over the data's range (sink capped at 180 °C);
  // otherwise the range the user typed.
  const [ownRange, setOwnRange] = useState<Record<string, number> | null>(() =>
    initial && initial.data_envelope && !sameRange(initial.envelope, capped(initial.data_envelope))
      ? { ...initial.envelope }
      : null
  );

  const model = result?.spec ?? initial;
  const envelope = ownRange ?? model?.envelope;
  const data = model?.data_envelope;
  const beyond =
    !!ownRange &&
    !!data &&
    (ownRange.T_source_min < data.T_source_min ||
      ownRange.T_source_max > data.T_source_max ||
      ownRange.T_sink_min < data.T_sink_min ||
      ownRange.T_sink_max > data.T_sink_max);
  const rangeOk =
    !ownRange ||
    (ownRange.T_source_min <= ownRange.T_source_max && ownRange.T_sink_min <= ownRange.T_sink_max);
  const inletsOk = !mapping.T_source_in === !mapping.T_sink_in;
  const canTrain = !!file && REQUIRED.every((r) => mapping[r]) && inletsOk && !busy;

  const choose = async (f: File | undefined, chosenSheet?: string) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setBusy('reading');
    try {
      const info = await inspectCopData(f, chosenSheet);
      setTable(info);
      setSheet(info.sheet);
      setMapping(info.guess);
    } catch (e) {
      setTable(null);
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const train = async () => {
    if (!file) return;
    setBusy('training');
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
      setResult(
        await trainCopModel(file, clean, name.trim() || 'My COP model', kind, degree, sheet)
      );
      setOwnRange(null);
    } catch (e) {
      setResult(null);
      setError(t('optimization.train.error', { msg: errorText(e) }));
    } finally {
      setBusy(null);
    }
  };

  const select = (role: CopRole) => (
    <label key={role} className="cf-field">
      <span>
        {t(`optimization.train.roles.${role}`)}
        {REQUIRED.includes(role) ? ' *' : ''}
      </span>
      <select
        className="cf-input"
        value={mapping[role] ?? ''}
        onChange={(e) => setMapping({ ...mapping, [role]: e.target.value || null })}
      >
        <option value="">{t('optimization.train.none')}</option>
        {table?.columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );

  const m = model?.metrics;
  const fmt = (v: number | undefined, d: number) => (v === undefined ? '–' : formatDe(v, d));

  return (
    <div className="cf-backdrop" role="presentation">
      <div
        className="cf-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('optimization.train.title')}
      >
        <header className="cf-header">
          <h3>{t('optimization.train.title')}</h3>
          <button
            className="cf-close"
            onClick={onCancel}
            aria-label={t('optimization.train.close')}
          >
            <X size={16} />
          </button>
        </header>

        <div className="cf-body">
          <dl className="cm-needs">
            <dt>{t('optimization.train.need_title')}</dt>
            <dd>{t('optimization.train.need')}</dd>
            <dt>{t('optimization.train.optional_title')}</dt>
            <dd>{t('optimization.train.optional')}</dd>
            <dt>{t('optimization.train.limits_title')}</dt>
            <dd>{t('optimization.train.limits')}</dd>
          </dl>

          <label
            className="cf-btn"
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            <Upload size={14} /> {file ? file.name : t('optimization.train.file')}
            <input
              type="file"
              accept=".csv,.txt,.tsv,.xlsx,.xlsm,.parquet"
              style={{ display: 'none' }}
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
          {busy === 'reading' && <LoaderCircle size={16} className="pa-spin" />}

          {table && (
            <>
              <p className="cf-muted">
                {t('optimization.train.rows', { rows: table.rows, cols: table.columns.length })}
                {table.rows > table.max_rows &&
                  ` ${t('optimization.train.too_many', { max: formatDe(table.max_rows, 0) })}`}
              </p>
              {table.sheets.length > 1 && (
                <label className="cf-field" style={{ maxWidth: 260 }}>
                  <span>{t('optimization.train.sheet')}</span>
                  <select
                    className="cf-input"
                    value={sheet ?? ''}
                    onChange={(e) => choose(file ?? undefined, e.target.value)}
                  >
                    {table.sheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="cm-preview">
                <table>
                  <thead>
                    <tr>
                      {table.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.preview.slice(0, 4).map((row, i) => (
                      <tr key={i}>
                        {table.columns.map((c) => (
                          <td key={c}>{row[c]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cf-section-title">{t('optimization.train.mapping')}</div>
              <p className="cf-muted">{t('optimization.train.mapping_hint')}</p>
              <div className="cf-grid">{REQUIRED.map(select)}</div>
              <div className="cf-grid">{OPTIONAL.map(select)}</div>
              <p className={inletsOk ? 'cf-muted' : 'cf-verdict bad'}>
                {t('optimization.train.inlets_hint')}
              </p>
              <div className="cf-section-title">{t('optimization.train.model')}</div>
              <div className="cf-grid">
                <label className="cf-field">
                  <span>{t('optimization.train.model_type')}</span>
                  <select
                    className="cf-input"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as ModelKind)}
                  >
                    {(['nn', 'poly', 'linear'] as const).map((k) => (
                      <option key={k} value={k}>
                        {t(`optimization.train.kinds.${k}`)}
                      </option>
                    ))}
                  </select>
                </label>
                {kind === 'poly' && (
                  <label className="cf-field">
                    <span>{t('optimization.train.degree')}</span>
                    <select
                      className="cf-input"
                      value={degree}
                      onChange={(e) => setDegree(Number(e.target.value))}
                    >
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </label>
                )}
              </div>
              <p className="cf-muted">{t(`optimization.train.kinds_hint.${kind}`)}</p>
              <label className="cf-label" htmlFor="cm-name">
                {t('optimization.train.name')}
              </label>
              <input
                id="cm-name"
                className="cf-input"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}

          {error && <p className="cf-verdict bad">{error}</p>}

          {m && (
            <>
              <div className="cf-section-title">{t('optimization.train.metrics')}</div>
              <div className="cf-grid">
                {(
                  [
                    ['r2', fmt(m.r2, 3)],
                    ['mae', fmt(m.mae, 3)],
                    ['rmse', fmt(m.rmse, 3)],
                    ['mape', `${fmt(m.mape, 1)} %`],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="cf-field">
                    <span>{t(`optimization.train.${k}`)}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <p className="cf-muted">
                {t('optimization.train.metrics_hint', { n: m.n_test })}{' '}
                {result &&
                  t('optimization.train.rows_used', {
                    used: formatDe(result.rows_used, 0),
                    dropped: formatDe(result.rows_dropped, 0),
                  })}
                {result?.sampled_from &&
                  ` (${t('optimization.train.sampled', { n: formatDe(result.sampled_from, 0) })})`}
              </p>
              <p className="cf-muted">
                {t('optimization.train.inputs', {
                  list: [...model.temps, ...model.cats]
                    .map((r) => t(`optimization.train.roles.${r}`))
                    .join(', '),
                })}
                <br />
                {t('optimization.train.pumps', { n: model.combos.length })}
              </p>
              <div className="cf-section-title">{t('optimization.train.range_title')}</div>
              <p className="cf-muted">{t('optimization.train.range_hint')}</p>
              <label className="cf-trigger-toggle">
                <input type="radio" checked={!ownRange} onChange={() => setOwnRange(null)} />
                {t('optimization.train.range_data', {
                  s0: fmt(model.envelope.T_source_min, 0),
                  s1: fmt(model.envelope.T_source_max, 0),
                  k0: fmt(model.envelope.T_sink_min, 0),
                  k1: fmt(model.envelope.T_sink_max, 0),
                })}
              </label>
              <label className="cf-trigger-toggle">
                <input
                  type="radio"
                  checked={!!ownRange}
                  onChange={() => setOwnRange({ ...model.envelope })}
                />
                {t('optimization.train.range_own')}
              </label>
              {ownRange && (
                <div className="cf-grid">
                  {(['T_source_min', 'T_source_max', 'T_sink_min', 'T_sink_max'] as const).map(
                    (k) => (
                      <label key={k} className="cf-field">
                        <span>{t(`cop_modal.envelope.${k.replace('T_', '').toLowerCase()}`)}</span>
                        <input
                          type="number"
                          className="cf-input"
                          value={ownRange[k]}
                          onChange={(e) =>
                            setOwnRange({ ...ownRange, [k]: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </label>
                    )
                  )}
                </div>
              )}
              {!rangeOk && <p className="cf-verdict bad">{t('optimization.train.range_bad')}</p>}
              {beyond && <p className="cf-verdict bad">{t('optimization.train.range_beyond')}</p>}
              {model.formula && (
                <>
                  <div className="cf-section-title">{t('optimization.train.formula')}</div>
                  <pre className="cm-formula">{model.formula}</pre>
                  <p className="cf-muted">{t('optimization.train.formula_hint')}</p>
                </>
              )}
            </>
          )}

          {result && (
            <Plot
              data={[
                {
                  x: result.parity.actual,
                  y: result.parity.predicted,
                  mode: 'markers',
                  type: 'scatter',
                  marker: { size: 5, color: '#7C3AED', opacity: 0.6 },
                  name: t('optimization.train.predicted'),
                },
                (() => {
                  const all = [...result.parity.actual, ...result.parity.predicted];
                  const lo = Math.min(...all);
                  const hi = Math.max(...all);
                  return {
                    x: [lo, hi],
                    y: [lo, hi],
                    mode: 'lines',
                    type: 'scatter',
                    line: { color: 'gray', dash: 'dash', width: 1 },
                    hoverinfo: 'skip',
                    showlegend: false,
                  };
                })(),
              ]}
              layout={{
                title: { text: t('optimization.train.parity_title'), font: { size: 13 } },
                height: 320,
                margin: { l: 50, r: 10, t: 36, b: 44 },
                xaxis: { title: { text: t('optimization.train.actual') } },
                yaxis: { title: { text: t('optimization.train.predicted') } },
                showlegend: false,
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          )}
        </div>

        <footer className="cf-footer">
          {initial && (
            <button className="cf-btn cf-btn-remove" onClick={() => onApply(null)}>
              {t('optimization.train.remove')}
            </button>
          )}
          <span className="cf-spacer" />
          <button className="cf-btn" onClick={onCancel}>
            {t('optimization.train.cancel')}
          </button>
          {table && (
            <button className="cf-btn" disabled={!canTrain} onClick={train}>
              {busy === 'training' ? (
                <>
                  <LoaderCircle size={14} className="pa-spin" /> {t('optimization.train.training')}
                </>
              ) : (
                t('optimization.train.train')
              )}
            </button>
          )}
          <button
            className="cf-btn cf-btn-primary"
            disabled={!model || !rangeOk}
            onClick={() => model && envelope && onApply({ ...model, envelope, enabled: true })}
          >
            {t('optimization.train.apply')}
          </button>
        </footer>
      </div>
    </div>
  );
}
