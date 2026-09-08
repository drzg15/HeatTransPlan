/** CopFormulaModal — type or paste a COP correlation to run alongside the model.
 *
 *  The expression is never evaluated in the browser. It is sent to the backend,
 *  which parses it and whitelists every AST node before anything runs.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateCopFormula } from '../../api/analysis';
import type { CopFormulaSpec, CopFormulaValidateResult } from '../../types/analysis';
import './CopFormulaModal.css';

interface Props {
  initial: CopFormulaSpec | null;
  onCancel: () => void;
  onApply: (formula: CopFormulaSpec | null) => void;
}

const DEFAULT_COP_FORMULA: CopFormulaSpec = {
  name: 'My heat pump',
  expression: '0.5 * (T_sink + 273.15) / (T_sink - T_source)',
  enabled: true,
  T_source_min: 0,
  T_source_max: 200,
  T_sink_min: 0,
  T_sink_max: 250,
  cop_min: 1,
  cop_max: 20,
  medium_sink: 'Custom',
  hp_level: '1',
};



const BUILTIN_FORMULAS: Array<{ label: string; expression: string; T_sink_min: number; T_sink_max: number }> = [
  { label: 'Theoretical Carnot (50 %)', expression: '0.5 * (T_sink + 273.15) / (T_sink - T_source)', T_sink_min: 0, T_sink_max: 250 },
  { label: 'Stirling Engine', expression: '1.28792 * ((T_sink - T_source) + 1.08206)**-0.37606 * (T_sink + 273.54103)**0.35992', T_sink_min: 144, T_sink_max: 212 },
  { label: 'SHP (HFC/HFO)', expression: '1.9118 * ((T_sink - T_source) + 2*0.04419)**(-0.89094) * (T_sink + 273 + 0.04419)**0.67895', T_sink_min: 80, T_sink_max: 160 },
  { label: 'SHP (R717)', expression: '40.789 * ((T_sink - T_source) + 2*1.0305)**(-1.0489) * (T_sink + 273 + 1.0305)**0.29998', T_sink_min: 70, T_sink_max: 85 },
];

export default function CopFormulaModal({ initial, onCancel, onApply }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CopFormulaSpec>(initial ?? DEFAULT_COP_FORMULA);
  const [probeSource, setProbeSource] = useState(60);
  const [probeSink, setProbeSink] = useState(110);
  const [check, setCheck] = useState<CopFormulaValidateResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [showEnvelope, setShowEnvelope] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const set = <K extends keyof CopFormulaSpec>(key: K, value: CopFormulaSpec[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Validate as the user types. Debounced, and stale replies are discarded so a
  // slow response cannot overwrite the verdict for newer text.
  useEffect(() => {
    let cancelled = false;
    if (!draft.expression.trim()) {
      setCheck(null);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await validateCopFormula(draft.expression, probeSource, probeSink);
        if (!cancelled) setCheck(result);
      } catch {
        if (!cancelled) {
          setCheck({
            valid: false,
            error: 'Could not reach the server.',
            variables: {},
            functions: [],
          });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.expression, probeSource, probeSink]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  /** Insert a variable at the cursor rather than making people type it. */
  const insert = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      set('expression', draft.expression + token);
      return;
    }
    const { selectionStart: a, selectionEnd: b } = el;
    const next = draft.expression.slice(0, a) + token + draft.expression.slice(b);
    set('expression', next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = a + token.length;
    });
  };

  const canApply = !!check?.valid && draft.expression.trim().length > 0;

  return (
    <div className="cf-backdrop" onClick={onCancel} role="presentation">
      <div
        className="cf-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('cop_modal.title')}
      >
        <header className="cf-header">
          <h3>{t('cop_modal.title')}</h3>
          <button className="cf-close" onClick={onCancel} aria-label={t('cop_modal.close')}>
            ✕
          </button>
        </header>

        <div className="cf-body">
          <label className="cf-label" htmlFor="cf-name">
            {t('cop_modal.name')}
          </label>
          <input
            id="cf-name"
            className="cf-input"
            value={draft.name}
            maxLength={60}
            onChange={(e) => set('name', e.target.value)}
            placeholder={t('cop_modal.name_placeholder')}
          />

          <label className="cf-label" htmlFor="cf-expr">
            {t('cop_modal.cop_equals')}
          </label>
          <textarea
            id="cf-expr"
            ref={textareaRef}
            className={`cf-expression ${check && !check.valid ? 'cf-invalid' : ''}`}
            value={draft.expression}
            rows={3}
            spellCheck={false}
            maxLength={500}
            onChange={(e) => set('expression', e.target.value)}
            placeholder="0.5 * (T_sink + 273.15) / (T_sink - T_source)"
          />

          <div className={`cf-verdict ${check?.valid ? 'ok' : check ? 'bad' : ''}`}>
            {checking && <span className="cf-muted">{t('cop_modal.checking')}</span>}
            {!checking && check?.valid && (
              <span>
                ✓ COP = <strong>{check.cop?.toFixed(3)}</strong> at {probeSource} °C → {probeSink}{' '}
                °C
              </span>
            )}
            {!checking && check && !check.valid && (
              <span>✕ {check.error === 'Could not reach the server.' ? t('cop_modal.server_error') : check.error}</span>
            )}
            {!checking && !check && <span className="cf-muted">{t('cop_modal.enter_formula')}</span>}
          </div>

          <div className="cf-probe">
            <label>
              {t('cop_modal.preview_source')}
              <input
                type="number"
                value={probeSource}
                onChange={(e) => setProbeSource(parseFloat(e.target.value) || 0)}
              />{' '}
              °C
            </label>
            <label>
              {t('cop_modal.preview_sink')}
              <input
                type="number"
                value={probeSink}
                onChange={(e) => setProbeSink(parseFloat(e.target.value) || 0)}
              />{' '}
              °C
            </label>
          </div>

          <div className="cf-section-title">{t('cop_modal.variables_title')}</div>
          <div className="cf-chips">
            {Object.entries(check?.variables ?? {}).map(([name, description]) => (
              <button
                key={name}
                className="cf-chip"
                title={description}
                onClick={() => insert(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {check?.functions?.length ? (
            <p className="cf-muted cf-funcs">{t('cop_modal.functions')} {check.functions.join(', ')}</p>
          ) : null}

          <div className="cf-section-title">{t('cop_modal.built_in_title')}</div>
          <div className="cf-chips">
            {BUILTIN_FORMULAS.map((b) => (
              <button
                key={b.label}
                className="cf-chip cf-chip-example"
                onClick={() => {
                  set('expression', b.expression);
                  set('T_sink_min', b.T_sink_min);
                  set('T_sink_max', b.T_sink_max);
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          <button className="cf-disclosure" onClick={() => setShowEnvelope((v) => !v)}>
            {showEnvelope ? '▾' : '▸'} {t('cop_modal.validity_range')}
            <span className="cf-muted">{t('cop_modal.validity_sub')}</span>
          </button>
          {showEnvelope && (
            <div className="cf-grid">
              {(
                [
                  [t('cop_modal.envelope.source_min'), 'T_source_min'],
                  [t('cop_modal.envelope.source_max'), 'T_source_max'],
                  [t('cop_modal.envelope.sink_min'), 'T_sink_min'],
                  [t('cop_modal.envelope.sink_max'), 'T_sink_max'],
                  [t('cop_modal.envelope.cop_min'), 'cop_min'],
                  [t('cop_modal.envelope.cop_max'), 'cop_max'],
                ] as Array<[string, keyof CopFormulaSpec]>
              ).map(([label, key]) => (
                <label key={key} className="cf-field">
                  <span>{label}</span>
                  <input
                    type="number"
                    className="cf-input"
                    value={draft[key] as number}
                    onChange={(e) => set(key, (parseFloat(e.target.value) || 0) as never)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <footer className="cf-footer">
          {initial && (
            <button className="cf-btn cf-btn-remove" onClick={() => onApply(null)}>
              {t('cop_modal.remove')}
            </button>
          )}
          <span className="cf-spacer" />
          <button className="cf-btn" onClick={onCancel}>
            {t('cop_modal.cancel')}
          </button>
          <button
            className="cf-btn cf-btn-primary"
            disabled={!canApply}
            title={canApply ? undefined : t('cop_modal.fix_formula_first')}
            onClick={() => onApply({ ...draft, enabled: true })}
          >
            {t('cop_modal.apply')}
          </button>
        </footer>
      </div>
    </div>
  );
}
