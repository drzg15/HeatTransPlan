/** The COP model on its own: choose every input it takes (four temperatures,
 *  sink medium, refrigerant, compressor stages) and see what it predicts, live,
 *  next to the 2-temperature model and Carnot. For debugging the model. */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCopPointOptions, rateCopPoint } from '../../api/analysis';
import type { CopPointOption, CopPointResult } from '../../types/analysis';

export interface ModelInputs {
  name: string; // refrigerant with its stage count, e.g. Butane_2
  medium_sink: string;
  T_source_in: number;
  T_source_out: number;
  T_sink_in: number;
  T_sink_out: number;
}

type TempKey = 'T_source_in' | 'T_source_out' | 'T_sink_in' | 'T_sink_out';
// The model's own column names, shown so the row it gets can be checked.
const COLUMN: Record<TempKey, string> = {
  T_source_in: 'T_Vorlauf_Quelle',
  T_source_out: 'T_Rücklauf_Quelle',
  T_sink_in: 'T_Rücklauf_Senke',
  T_sink_out: 'T_Vorlauf_Senke',
};
const TEMPS: TempKey[] = ['T_source_in', 'T_source_out', 'T_sink_in', 'T_sink_out'];

const base = (name: string) => name.replace(/_\d+$/, '');
const stages = (name: string) => name.match(/_(\d+)$/)?.[1] ?? '1';

export default function CopModelDebug({ initial }: { initial: ModelInputs }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<CopPointOption[]>([]);
  const [inputs, setInputs] = useState(initial);
  const [result, setResult] = useState<CopPointResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCopPointOptions()
      .then(setOptions)
      .catch(() => setError(t('hp_view.error')));
  }, [t]);

  const { name, medium_sink, T_source_in, T_source_out, T_sink_in, T_sink_out } = inputs;
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      rateCopPoint({
        refrigerant: name,
        medium_sink,
        T_source_in,
        T_source_out,
        T_sink_in,
        T_sink_out,
      })
        .then((r) => !cancelled && (setResult(r), setError(null)))
        .catch(() => !cancelled && setError(t('hp_view.model.unknown')));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, medium_sink, T_source_in, T_source_out, T_sink_in, T_sink_out, t]);

  // The three choices narrow each other: a refrigerant has its stage counts,
  // a refrigerant and stage count their sink media.
  const refrigerants = [...new Set(options.map((o) => base(o.name)))].sort();
  const stageChoices = [
    ...new Set(options.filter((o) => base(o.name) === base(name)).map((o) => stages(o.name))),
  ].sort();
  const media = [
    ...new Set(options.filter((o) => o.name === name).map((o) => o.medium_sink)),
  ].sort();
  const pick = (refrigerant: string, stage: string, medium: string) => {
    const same = options.filter((o) => base(o.name) === refrigerant);
    const withStage = same.filter((o) => stages(o.name) === stage);
    const choice =
      withStage.find((o) => o.medium_sink === medium) ??
      withStage[0] ??
      same.find((o) => o.medium_sink === medium) ??
      same[0];
    if (choice) setInputs((s) => ({ ...s, name: choice.name, medium_sink: choice.medium_sink }));
  };
  const option = options.find((o) => o.name === name && o.medium_sink === medium_sink);
  const setTemp = (k: TempKey, v: number) =>
    Number.isFinite(v) && setInputs((s) => ({ ...s, [k]: v }));

  const select = (
    label: string,
    value: string,
    choices: string[],
    onChange: (v: string) => void
  ) => (
    <label className="hpv-model-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {choices.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="hpv-model">
      <section className="hpv-search">
        <h4>{t('hp_view.model.inputs')}</h4>
        <div className="hpv-model-grid">
          {select(t('hp_view.model.refrigerant'), base(name), refrigerants, (v) =>
            pick(v, stages(name), medium_sink)
          )}
          {select(t('hp_view.model.stages'), stages(name), stageChoices, (v) =>
            pick(base(name), v, medium_sink)
          )}
          {select(t('hp_view.model.medium'), medium_sink, media, (v) =>
            pick(base(name), stages(name), v)
          )}
        </div>
        {TEMPS.map((k) => (
          <label key={k} className="hpv-slider">
            <span>
              {t(`hp_view.model.${k}`)} <code>{COLUMN[k]}</code>
            </span>
            <span className="hpv-model-temp">
              <input
                type="range"
                min={0}
                max={200}
                step={0.5}
                value={inputs[k]}
                onChange={(e) => setTemp(k, parseFloat(e.target.value))}
              />
              <input
                type="number"
                step={0.5}
                value={inputs[k]}
                onChange={(e) => setTemp(k, parseFloat(e.target.value))}
                aria-label={t(`hp_view.model.${k}`)}
              />
              °C
            </span>
          </label>
        ))}
        {option && (
          <p className="cf-muted">
            {t('hp_view.model.range', {
              src: `${option.T_src_min}–${option.T_src_max}`,
              sink: `${option.T_sink_min}–${option.T_sink_max}`,
            })}
          </p>
        )}
      </section>

      <section className="hpv-calc">
        <h4>{t('hp_view.model.prediction')}</h4>
        <p className="hpv-model-cop">COP {result ? result.cop_4t.toFixed(3) : '–'}</p>
        <table className="hpv-cases">
          <tbody>
            <tr>
              <td>{t('hp_view.case_4t')}</td>
              <td className="hpv-num">{result ? result.cop_4t.toFixed(3) : '–'}</td>
            </tr>
            <tr>
              <td>{t('hp_view.case_2t')}</td>
              <td className="hpv-num">{result ? result.cop_2t.toFixed(3) : '–'}</td>
            </tr>
            <tr>
              <td>{t('hp_view.case_carnot')}</td>
              <td className="hpv-num">
                {result?.carnot_50 != null ? result.carnot_50.toFixed(3) : '–'}
                {result?.carnot_ideal != null && (
                  <span className="cf-muted">
                    {' '}
                    {t('hp_view.ideal', { value: result.carnot_ideal.toFixed(2) })}
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td>{t('hp_view.model.spreads')}</td>
              <td className="hpv-num">
                {(T_source_in - T_source_out).toFixed(1)} K / {(T_sink_out - T_sink_in).toFixed(1)}{' '}
                K
              </td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ marginTop: 12 }}>{t('hp_view.model.row')}</h4>
        <table className="hpv-cases hpv-row">
          <tbody>
            {TEMPS.map((k) => (
              <tr key={k}>
                <td>
                  <code>{COLUMN[k]}</code>
                </td>
                <td className="hpv-num">{inputs[k]}</td>
              </tr>
            ))}
            <tr>
              <td>
                <code>Medium_Senke</code>
              </td>
              <td className="hpv-num">{medium_sink}</td>
            </tr>
            <tr>
              <td>
                <code>Kältemittel_stufen</code>
              </td>
              <td className="hpv-num">{name}</td>
            </tr>
          </tbody>
        </table>

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
      </section>
    </div>
  );
}
