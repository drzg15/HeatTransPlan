import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { CopFormulaSpec, OptimizedIntegrationPoint } from '../../types/analysis';
import ChartHelpButton from '../ui/ChartHelpButton';
import CopFormulaHelp from './CopFormulaHelp';
import FilterDropdown from './FilterDropdown';
import LimitToggle from './LimitToggle';
import { filterLabelStyle, filterSelectStyle } from './hpFilterStyles';

interface Props {
  isDark: boolean;
  // Values the filters offer
  uniqueMediumSinks: string[];
  uniqueRefrigerantTypes: string[];
  uniqueRefrigerants: string[];
  uniqueHpLevels: string[];
  // Filter state
  mediumSinkFilter: string;
  setMediumSinkFilter: (v: string) => void;
  refrigerantTypeFilter: string;
  setRefrigerantTypeFilter: (v: string) => void;
  refrigerantFilter: string[];
  hpLevelFilter: string[];
  toggleRefrigerant: (refName: string) => void;
  toggleHpLevel: (level: string) => void;
  refDropdownRef: RefObject<HTMLDivElement | null>;
  hpDropdownRef: RefObject<HTMLDivElement | null>;
  refDropdownOpen: boolean;
  setRefDropdownOpen: Dispatch<SetStateAction<boolean>>;
  hpDropdownOpen: boolean;
  setHpDropdownOpen: Dispatch<SetStateAction<boolean>>;
  // Row classes that can be shown or hidden
  showTheoretical: boolean;
  setShowTheoretical: (v: boolean) => void;
  showSourceLimited: boolean;
  setShowSourceLimited: (v: boolean) => void;
  showDemandLimited: boolean;
  setShowDemandLimited: (v: boolean) => void;
  theoreticalCount: number;
  sourceLimitedCount: number;
  demandLimitedCount: number;
  // Selection and counts
  filteredPoints: OptimizedIntegrationPoint[];
  setSelectedPoints: (points: OptimizedIntegrationPoint[]) => void;
  feasibleCount: number;
  chartPointsCount: number;
  // Custom COP formula
  copFormula: CopFormulaSpec | null;
  onOpenFormula: () => void;
}

/** The filter column left of the chart: selects, dropdowns, bulk selection and the COP formula entry. */
export default function HPIOptimizationFilters({
  isDark,
  uniqueMediumSinks,
  uniqueRefrigerantTypes,
  uniqueRefrigerants,
  uniqueHpLevels,
  mediumSinkFilter,
  setMediumSinkFilter,
  refrigerantTypeFilter,
  setRefrigerantTypeFilter,
  refrigerantFilter,
  hpLevelFilter,
  toggleRefrigerant,
  toggleHpLevel,
  refDropdownRef,
  hpDropdownRef,
  refDropdownOpen,
  setRefDropdownOpen,
  hpDropdownOpen,
  setHpDropdownOpen,
  showTheoretical,
  setShowTheoretical,
  showSourceLimited,
  setShowSourceLimited,
  showDemandLimited,
  setShowDemandLimited,
  theoreticalCount,
  sourceLimitedCount,
  demandLimitedCount,
  filteredPoints,
  setSelectedPoints,
  feasibleCount,
  chartPointsCount,
  copFormula,
  onOpenFormula,
}: Props) {
  const { t } = useTranslation();
  const selectStyle = filterSelectStyle(isDark);
  const labelStyle = filterLabelStyle(isDark);

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
      <div>
        <label style={labelStyle}>{t('optimization.panel.filters.medium_sink')}</label>
        <select
          value={mediumSinkFilter}
          onChange={(e) => setMediumSinkFilter(e.target.value)}
          style={{ ...selectStyle, width: '100%' }}
        >
          <option value="All">{t('optimization.panel.filters.all')}</option>
          {uniqueMediumSinks.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>{t('optimization.panel.filters.refrigerant_type')}</label>
        <select
          value={refrigerantTypeFilter}
          onChange={(e) => setRefrigerantTypeFilter(e.target.value)}
          style={{ ...selectStyle, width: '100%' }}
        >
          <option value="All">{t('optimization.panel.filters.all')}</option>
          {uniqueRefrigerantTypes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <FilterDropdown
        label={t('optimization.panel.filters.refrigerant')}
        allLabel={t('optimization.panel.filters.all')}
        isDark={isDark}
        containerRef={refDropdownRef}
        open={refDropdownOpen}
        onToggleOpen={() => setRefDropdownOpen(!refDropdownOpen)}
        options={uniqueRefrigerants}
        selected={refrigerantFilter}
        onToggleOption={toggleRefrigerant}
      />
      <FilterDropdown
        label={t('optimization.panel.filters.hp_stages')}
        allLabel={t('optimization.panel.filters.all')}
        isDark={isDark}
        containerRef={hpDropdownRef}
        open={hpDropdownOpen}
        onToggleOpen={() => setHpDropdownOpen(!hpDropdownOpen)}
        options={uniqueHpLevels}
        selected={hpLevelFilter}
        onToggleOption={toggleHpLevel}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: '1rem',
        }}
      >
        <button
          onClick={() => setSelectedPoints([...filteredPoints])}
          style={{
            padding: '0.4rem 0.8rem',
            background: isDark ? '#3B82F6' : '#2563EB',
            color: '#FFF',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
            width: '100%',
          }}
        >
          {t('optimization.panel.filters.select_all')}
        </button>
        <button
          onClick={() => setSelectedPoints([])}
          style={{
            padding: '0.4rem 0.8rem',
            background: isDark ? '#EF4444' : '#DC2626',
            color: '#FFF',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
            width: '100%',
          }}
        >
          {t('optimization.panel.filters.clear')}
        </button>
        {theoreticalCount > 0 && (
          <LimitToggle
            isDark={isDark}
            checked={showTheoretical}
            onChange={setShowTheoretical}
            label={t('optimization.panel.filters.show_theoretical')}
            count={theoreticalCount}
            description={t('optimization.panel.filters.show_theoretical_desc')}
          />
        )}
        {sourceLimitedCount > 0 && (
          <LimitToggle
            isDark={isDark}
            checked={showSourceLimited}
            onChange={setShowSourceLimited}
            label={t('optimization.panel.filters.source_limited')}
            count={sourceLimitedCount}
            description={t('optimization.panel.filters.source_limited_desc')}
          />
        )}
        {demandLimitedCount > 0 && (
          <LimitToggle
            isDark={isDark}
            checked={showDemandLimited}
            onChange={setShowDemandLimited}
            label={t('optimization.panel.filters.demand_limited')}
            count={demandLimitedCount}
            description={t('optimization.panel.filters.demand_limited_desc')}
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
          {t('optimization.panel.filters.feasible')} {feasibleCount}
          {(sourceLimitedCount > 0 || demandLimitedCount > 0) && (
            <>
              <br />
              <span style={{ fontWeight: 400 }}>
                {t('optimization.panel.filters.shown')} {chartPointsCount}
              </span>
            </>
          )}
        </p>
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
        <button className={`cf-trigger ${copFormula ? 'active' : ''}`} onClick={onOpenFormula}>
          {copFormula
            ? `ƒ ${copFormula.name}`
            : `ƒ ${t('optimization.panel.filters.custom_cop_btn')}`}
          <span className="cf-trigger-sub">
            {copFormula ? copFormula.expression : t('optimization.panel.filters.custom_cop_desc')}
          </span>
        </button>
      </div>
    </div>
  );
}
