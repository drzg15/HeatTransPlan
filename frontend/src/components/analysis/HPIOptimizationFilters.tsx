/** The optimization panel's filter column: what to list and chart, which COP
 *  model to use, and the custom COP formula. */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { CopFormulaSpec, CopModel } from '../../types/analysis';
import ChartHelpButton from '../ui/ChartHelpButton';

interface Props {
  isDark: boolean;
  options: {
    mediumSinks: string[];
    refrigerantTypes: string[];
    refrigerants: string[];
    hpLevels: string[];
  };
  mediumSink: string;
  onMediumSink: (v: string) => void;
  refrigerantType: string;
  onRefrigerantType: (v: string) => void;
  refrigerants: string[];
  onToggleRefrigerant: (v: string) => void;
  hpLevels: string[];
  onToggleHpLevel: (v: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  theoreticalCount: number;
  showTheoretical: boolean;
  onShowTheoretical: (v: boolean) => void;
  sourceLimitedCount: number;
  showSourceLimited: boolean;
  onShowSourceLimited: (v: boolean) => void;
  demandLimitedCount: number;
  showDemandLimited: boolean;
  onShowDemandLimited: (v: boolean) => void;
  feasibleCount: number;
  shownCount: number;
  copModel: CopModel;
  onCopModel: (v: CopModel) => void;
  copFormula: CopFormulaSpec | null;
  onOpenFormula: () => void;
}

/** A dropdown of checkboxes; nothing ticked means all. Closes on a click
 *  anywhere outside it. */
function MultiSelect({
  label,
  values,
  selected,
  onToggle,
  isDark,
  selectStyle,
  labelStyle,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (v: string) => void;
  isDark: boolean;
  selectStyle: CSSProperties;
  labelStyle: CSSProperties;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      <div
        style={{
          ...selectStyle,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.length === 0 ? t('optimization.panel.filters.all') : selected.join(', ')}
        </span>
        <span style={{ fontSize: '0.8em', marginLeft: '8px' }}>▼</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: isDark ? '#1E293B' : '#FFF',
            border: `1px solid ${isDark ? '#475569' : '#CBD5E1'}`,
            borderRadius: '4px',
            zIndex: 10,
            width: '100%',
            padding: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {values.map((v) => (
            <label
              key={v}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0',
                cursor: 'pointer',
                color: isDark ? '#F8FAFC' : '#0F172A',
              }}
            >
              <input type="checkbox" checked={selected.includes(v)} onChange={() => onToggle(v)} />
              {v}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** A single option checkbox with its count and a line of explanation. */
function Toggle({
  checked,
  onChange,
  label,
  count,
  desc,
  isDark,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  count: number;
  desc: string;
  isDark: boolean;
}) {
  return (
    <label
      style={{
        marginTop: '0.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.4rem',
        fontSize: '0.8rem',
        color: isDark ? '#94A3B8' : '#64748B',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: '0.15rem' }}
      />
      <span>
        {label} ({count})
        <br />
        <span style={{ fontSize: '0.75rem' }}>{desc}</span>
      </span>
    </label>
  );
}

/** What a custom COP formula may use, with worked examples. */
function CopFormulaHelp() {
  const { t } = useTranslation();
  return (
    <>
      <p>
        {t('optimization.desc_opt_panel_c1')} <strong>{t('optimization.desc_opt_panel_c2')}</strong>
        {t('optimization.desc_opt_panel_c3')}
      </p>
      <p>{t('optimization.desc_opt_panel_c4')}</p>
      <ul style={{ margin: '4px 0 8px 16px', padding: 0 }}>
        <li>
          <code>T_source</code>, <code>T_sink</code>
          {t('optimization.desc_opt_panel_c5')}
        </li>
        <li>
          <code>T_lift</code>
          {t('optimization.desc_opt_panel_c6')}
        </li>
        <li>
          <code>carnot</code>
          {t('optimization.desc_opt_panel_c7')}
        </li>
      </ul>
      <p>
        {t('optimization.desc_opt_panel_c8')} <code>0.5 * (T_sink + 273.15) / T_lift</code>
        {t('optimization.desc_opt_panel_c9')}
        <code>0.5 * carnot</code>
        {t('optimization.desc_opt_panel_c10')}
      </p>
      <p>
        {t('optimization.desc_opt_panel_c11')}
        <strong>{t('optimization.desc_opt_panel_c12')}</strong>
        {t('optimization.desc_opt_panel_c13')}{' '}
        <code>
          (0.5 * (T_sink + 273.15) / T_lift) if T_sink &lt;= 100 else (0.4 * (T_sink + 273.15) /
          T_lift)
        </code>
        {t('optimization.desc_opt_panel_c14')}
      </p>
      <p>
        {t('optimization.desc_opt_panel_c15')}
        <strong>{t('optimization.desc_opt_panel_c16')}</strong>
        {t('optimization.desc_opt_panel_c17')}
      </p>
    </>
  );
}

export default function HPIOptimizationFilters(p: Props) {
  const { t } = useTranslation();
  const { isDark } = p;

  const selectStyle = {
    padding: '0.4rem',
    borderRadius: '4px',
    border: `1px solid ${isDark ? '#475569' : '#CBD5E1'}`,
    background: isDark ? '#1E293B' : '#FFF',
    color: isDark ? '#F8FAFC' : '#0F172A',
    minWidth: '150px',
  };

  const labelStyle = {
    fontSize: '0.85rem',
    color: isDark ? '#94A3B8' : '#64748B',
    display: 'block',
    marginBottom: '0.25rem',
    fontWeight: 500,
  };

  const single = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    values: string[]
  ) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...selectStyle, width: '100%' }}
      >
        <option value="All">{t('optimization.panel.filters.all')}</option>
        {values.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );

  const button = (label: string, onClick: () => void, bg: string) => (
    <button
      onClick={onClick}
      style={{
        padding: '0.4rem 0.8rem',
        background: bg,
        color: '#FFF',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.85rem',
        width: '100%',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="pa-opt-filters"
      style={{
        gap: '1rem',
        background: isDark ? '#0F172A' : '#F8FAFC',
        padding: '1rem',
        borderRadius: '8px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
      }}
    >
      {single(
        t('optimization.panel.filters.medium_sink'),
        p.mediumSink,
        p.onMediumSink,
        p.options.mediumSinks
      )}
      {single(
        t('optimization.panel.filters.refrigerant_type'),
        p.refrigerantType,
        p.onRefrigerantType,
        p.options.refrigerantTypes
      )}
      <MultiSelect
        label={t('optimization.panel.filters.refrigerant')}
        values={p.options.refrigerants}
        selected={p.refrigerants}
        onToggle={p.onToggleRefrigerant}
        isDark={isDark}
        selectStyle={selectStyle}
        labelStyle={labelStyle}
      />
      <MultiSelect
        label={t('optimization.panel.filters.hp_stages')}
        values={p.options.hpLevels}
        selected={p.hpLevels}
        onToggle={p.onToggleHpLevel}
        isDark={isDark}
        selectStyle={selectStyle}
        labelStyle={labelStyle}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: '1rem',
        }}
      >
        {button(
          t('optimization.panel.filters.select_all'),
          p.onSelectAll,
          isDark ? '#3B82F6' : '#2563EB'
        )}
        {button(t('optimization.panel.filters.clear'), p.onClear, isDark ? '#EF4444' : '#DC2626')}
        {p.theoreticalCount > 0 && (
          <Toggle
            checked={p.showTheoretical}
            onChange={p.onShowTheoretical}
            label={t('optimization.panel.filters.show_theoretical')}
            count={p.theoreticalCount}
            desc={t('optimization.panel.filters.show_theoretical_desc')}
            isDark={isDark}
          />
        )}
        {p.sourceLimitedCount > 0 && (
          <Toggle
            checked={p.showSourceLimited}
            onChange={p.onShowSourceLimited}
            label={t('optimization.panel.filters.source_limited')}
            count={p.sourceLimitedCount}
            desc={t('optimization.panel.filters.source_limited_desc')}
            isDark={isDark}
          />
        )}
        {p.demandLimitedCount > 0 && (
          <Toggle
            checked={p.showDemandLimited}
            onChange={p.onShowDemandLimited}
            label={t('optimization.panel.filters.demand_limited')}
            count={p.demandLimitedCount}
            desc={t('optimization.panel.filters.demand_limited_desc')}
            isDark={isDark}
          />
        )}
        <p
          style={{
            marginTop: '0.5rem',
            fontSize: '0.8rem',
            color: isDark ? '#94A3B8' : '#64748B',
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          {t('optimization.panel.filters.feasible')} {p.feasibleCount}
          {(p.sourceLimitedCount > 0 || p.demandLimitedCount > 0) && (
            <>
              <br />
              <span style={{ fontWeight: 400 }}>
                {t('optimization.panel.filters.shown')} {p.shownCount}
              </span>
            </>
          )}
        </p>
      </div>
      <div>
        <div className="cf-trigger-head">
          <label style={labelStyle}>{t('optimization.panel.filters.cop_model')}</label>
          <ChartHelpButton
            inline
            title={t('optimization.panel.filters.cop_model_help_title')}
            description={
              <>
                <p>{t('optimization.panel.filters.cop_model_help_1')}</p>
                <p>
                  <strong>{t('optimization.panel.filters.cop_model_4t')}</strong>{' '}
                  {t('optimization.panel.filters.cop_model_help_4t')}
                </p>
                <p>
                  <strong>{t('optimization.panel.filters.cop_model_2t')}</strong>{' '}
                  {t('optimization.panel.filters.cop_model_help_2t')}
                </p>
                <p>{t('optimization.panel.filters.cop_model_help_2')}</p>
              </>
            }
          />
        </div>
        <select
          style={selectStyle}
          value={p.copModel}
          onChange={(e) => p.onCopModel(e.target.value as CopModel)}
          title={t('optimization.panel.filters.cop_model_desc')}
        >
          <option value="4t">{t('optimization.panel.filters.cop_model_4t')}</option>
          <option value="2t">{t('optimization.panel.filters.cop_model_2t')}</option>
        </select>
      </div>
      <div className="cf-trigger-block">
        <div className="cf-trigger-head">
          <label style={labelStyle}>{t('optimization.panel.filters.cop_source')}</label>
          <ChartHelpButton
            inline
            title={t('optimization.title_custom_cop_formula')}
            description={<CopFormulaHelp />}
          />
        </div>
        <button className={`cf-trigger ${p.copFormula ? 'active' : ''}`} onClick={p.onOpenFormula}>
          {p.copFormula
            ? `ƒ ${p.copFormula.name}`
            : `ƒ ${t('optimization.panel.filters.custom_cop_btn')}`}
          <span className="cf-trigger-sub">
            {p.copFormula
              ? p.copFormula.expression
              : t('optimization.panel.filters.custom_cop_desc')}
          </span>
        </button>
      </div>
    </div>
  );
}
