import { useState, useEffect, useRef } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import {
  chartPointsOf,
  DEFAULT_TABLE_SORT,
  defaultHighlightOf,
  sortRows,
  tableRowsOf,
  type SortConfig,
  type SortKey,
} from './hpRules';
import { useUIStore } from '../../store/uiStore';
import { useTranslation } from 'react-i18next';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import HPIOptimizationChart from './HPIOptimizationChart';
import ChartHelpButton from '../ui/ChartHelpButton';
import CopFormulaModal from './CopFormulaModal';

export default function HPIOptimizationPanel() {
  const hpiOptimizationResult = useAnalysisStore((s) => s.hpiOptimizationResult);
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const tMin = useAnalysisStore((s) => s.tMin);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { t } = useTranslation();

  // In the store, not in this component: the report sends the selection so it
  // can show the pump that was picked rather than the default one.
  const selectedPoints = useAnalysisStore((s) => s.selectedHPPoints);
  const setSelectedPoints = useAnalysisStore((s) => s.setSelectedHPPoints);

  // Custom COP formula. Lives in the store so the page can send it with the
  // optimisation request and re-run when it changes.
  const copFormula = useAnalysisStore((s) => s.copFormula);
  const setCopFormula = useAnalysisStore((s) => s.setCopFormula);
  const [formulaOpen, setFormulaOpen] = useState(false);

  // Filter states
  const [mediumSinkFilter, setMediumSinkFilter] = useState<string>('All');
  const [refrigerantTypeFilter, setRefrigerantTypeFilter] = useState<string>('All');
  const [refrigerantFilter, setRefrigerantFilter] = useState<string[]>([]); // Empty means 'All'
  const [hpLevelFilter, setHpLevelFilter] = useState<string[]>([]); // Empty means 'All'
  // Theoretical reference rows are shown by default: they are the context the
  // real machines are read against, and with them hidden a click on the chart
  // cannot select them either. Untick to get the modelled machines alone.
  const [showTheoretical, setShowTheoretical] = useState(true);
  const [showSourceLimited, setShowSourceLimited] = useState(false);
  const [showDemandLimited, setShowDemandLimited] = useState(false);

  // Sort state (supports multi-column)
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([{ key: 'COP', direction: 'desc' }]);
  const [hpDropdownOpen, setHpDropdownOpen] = useState(false);
  const [refDropdownOpen, setRefDropdownOpen] = useState(false);
  const hpDropdownRef = useRef<HTMLDivElement>(null);
  const refDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hpiOptimizationResult?.max_q_point) {
      setSelectedPoints([]);
      setMediumSinkFilter('All');
      setRefrigerantTypeFilter('All');
      setRefrigerantFilter([]);
      setHpLevelFilter([]);
      setShowSourceLimited(false);
      setShowDemandLimited(false);
      setSortConfigs(DEFAULT_TABLE_SORT);
    }
  }, [hpiOptimizationResult]);

  useEffect(() => {
    setSelectedPoints([]);
  }, [mediumSinkFilter, refrigerantTypeFilter, refrigerantFilter, hpLevelFilter]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (hpDropdownRef.current && !hpDropdownRef.current.contains(event.target as Node)) {
        setHpDropdownOpen(false);
      }
      if (refDropdownRef.current && !refDropdownRef.current.contains(event.target as Node)) {
        setRefDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!hpiOptimizationResult || !pinchResult) return null;

  const { feasible_points, max_q_point, original_gcc } = hpiOptimizationResult;
  const diagnosticMessages = hpiOptimizationResult.diagnostics?.messages ?? [];

  const uniqueMediumSinks = Array.from(new Set(feasible_points.map((p) => p.medium_sink))).sort();
  const uniqueRefrigerantTypes = Array.from(
    new Set(feasible_points.map((p) => p.refrigerant_type))
  ).sort();
  const uniqueRefrigerants = Array.from(
    new Set(
      feasible_points.map((p) =>
        p.refrigerant.includes('_')
          ? p.refrigerant.substring(0, p.refrigerant.lastIndexOf('_'))
          : p.refrigerant
      )
    )
  ).sort();
  const uniqueHpLevels = Array.from(new Set(feasible_points.map((p) => p.hp_level))).sort();

  const filteredPoints = feasible_points.filter((p) => {
    // Hiding the theoretical rows here keeps every downstream count, chart
    // trace and best-point pick consistent with what is on screen.
    if (p.theoretical && !showTheoretical) return false;
    const refName = p.refrigerant.includes('_')
      ? p.refrigerant.substring(0, p.refrigerant.lastIndexOf('_'))
      : p.refrigerant;
    if (mediumSinkFilter !== 'All' && p.medium_sink !== mediumSinkFilter) return false;
    if (refrigerantTypeFilter !== 'All' && p.refrigerant_type !== refrigerantTypeFilter)
      return false;
    if (refrigerantFilter.length > 0 && !refrigerantFilter.includes(refName)) return false;
    if (hpLevelFilter.length > 0 && !hpLevelFilter.includes(p.hp_level)) return false;
    return true;
  });

  // Counted on the raw results, so the checkbox can say how many rows it would
  // bring back while they are hidden.
  const theoreticalCount = new Set(
    feasible_points.filter((p) => p.theoretical).map((p) => p.refrigerant)
  ).size;

  // Which points the chart plots and which pump it highlights by default —
  // see hpRules.ts, which the report shares.
  const sourceLimitedCount = filteredPoints.filter((p) => p.source_limited).length;
  const demandLimitedCount = filteredPoints.filter((p) => p.demand_limited).length;
  const chartPoints = chartPointsOf(filteredPoints, showSourceLimited, showDemandLimited);
  const chartMaxQPoint = defaultHighlightOf(chartPoints, max_q_point);

  // The rows of the table, before the user's column sort — see hpRules.ts.
  const pointsToShow = tableRowsOf(filteredPoints, showTheoretical, selectedPoints);

  // Sorting
  sortRows(pointsToShow, sortConfigs);


  const rowsToRender = pointsToShow;

  const handleSort = (key: SortKey) => {
    setSortConfigs((prev) => {
      const existingIdx = prev.findIndex((c) => c.key === key);
      if (existingIdx === 0) {
        // Toggle direction of primary sort
        const newConfigs = [...prev];
        newConfigs[0] = { key, direction: prev[0].direction === 'desc' ? 'asc' : 'desc' } as any;
        return newConfigs as any;
      } else if (existingIdx > 0) {
        // Move to front and set to ascending
        const newConfigs = prev.filter((c) => c.key !== key);
        newConfigs.unshift({ key, direction: 'asc' });
        return newConfigs as any;
      } else {
        // Add to front as primary sort, keep up to 3 keys
        return [{ key, direction: 'asc' }, ...prev].slice(0, 3) as any;
      }
    });
  };

  const renderSortIcon = (key: SortKey) => {
    const idx = sortConfigs.findIndex((c) => c.key === key);
    if (idx === -1) return null;
    const arrow = sortConfigs[idx].direction === 'asc' ? '↑' : '↓';
    return (
      <span
        style={{
          marginLeft: '4px',
          fontSize: idx === 0 ? '1em' : '0.8em',
          opacity: idx === 0 ? 1 : 0.6,
        }}
      >
        {arrow}
        {idx > 0 && <span style={{ fontSize: '0.7em' }}>({idx + 1})</span>}
      </span>
    );
  };

  const toggleHpLevel = (level: string) => {
    setHpLevelFilter((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const toggleRefrigerant = (refName: string) => {
    setRefrigerantFilter((prev) =>
      prev.includes(refName) ? prev.filter((r) => r !== refName) : [...prev, refName]
    );
  };

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

  const thStyle = {
    cursor: 'pointer',
    userSelect: 'none' as const,
    position: 'sticky' as const,
    top: 0,
    zIndex: 1,
    // Headers carry a label plus a help bulb plus a sort arrow; letting them
    // wrap is what made rows two lines tall.
    whiteSpace: 'nowrap' as const,
  };

  // The type cell holds a badge and a technology name side by side, so it needs
  // more room than the numeric columns or its content wraps onto a second line.
  const typeThStyle = { ...thStyle, minWidth: '190px' };
  // Holds only "Natural"/"Synthetic", so it needs far less room than its
  // header once implied.
  const narrowThStyle = { ...thStyle, width: '1%' };

  // Tints matching the heat pump overlay in the chart, so a column can be read
  // back to the arrow it belongs to. Kept pale: these sit behind black text on
  // alternating row stripes, so anything saturated is hard on the eyes.
  const sinkCell = { backgroundColor: isDark ? 'rgba(59,130,246,0.14)' : 'rgba(143,174,224,0.20)' };
  const sourceCell = { backgroundColor: isDark ? 'rgba(248,113,113,0.14)' : 'rgba(232,139,139,0.20)' };
  const elCell = { backgroundColor: isDark ? 'rgba(110,231,183,0.13)' : 'rgba(95,174,140,0.18)' };
  // COP belongs to the heat pump itself, so it takes the box's lilac.
  const copCell = {
    backgroundColor: isDark ? 'rgba(167,139,250,0.16)' : 'rgba(124,58,237,0.13)',
    fontWeight: 600,
  };

  // Carnot is not a fitted correlation like the other archetypes — it is the
  // thermodynamic relation between the two temperatures — so it gets its own
  // explanation rather than the "published regressions" one.
  const entryHint = (pt: OptimizedIntegrationPoint) =>
    !pt.theoretical
      ? t('optimization.real_hint')
      : pt.refrigerant === 'Carnot'
        ? t('optimization.carnot_hint')
        : t('optimization.theoretical_hint');

  return (
    <div className={`analysis-panel ${isDark ? 'dark-mode' : ''}`} style={{ marginTop: '2rem' }}>
      <div className="pa-split-layout">
        <div className="pa-left-col">
          <div className="pa-hp-table-wrap" style={{ maxHeight: '440px', overflowY: 'auto' }}>
            {rowsToRender.length > 0 ? (
              <>
                <div
                  className="pa-hp-section-label"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    position: 'sticky',
                    top: 0,
                    background: isDark ? '#0F172A' : '#FFF',
                    zIndex: 2,
                    margin: 0,
                    paddingBottom: '0.5rem',
                    color: isDark ? '#60A5FA' : '#2563EB',
                    fontWeight: 600,
                  }}
                >
                  {t('optimization.panel.title')}
                  <span onClick={(e) => e.stopPropagation()}>
                    <ChartHelpButton
                      title={t('optimization.title_model_information')}
                      description={t('optimization.desc_model_information')}
                      inline={true}
                    />
                  </span>
                </div>
                <table className="pa-table pa-hp-table">
                  <thead style={{ position: 'sticky', top: '30px', zIndex: 2 }}>
                    <tr>
                      <th style={typeThStyle} onClick={() => handleSort('theoretical')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.entry_type')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.panel.headers.entry_type')}
                              description={t('optimization.entry_type_hint')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('theoretical')}
                        </div>
                      </th>
                      <th style={narrowThStyle} onClick={() => handleSort('refrigerant_type')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.refrigerant_type')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_refrigerant_type')}
                              description={t('optimization.tooltip_refrigerant_type')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('refrigerant_type')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('medium_sink')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.medium_sink')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_medium_sink')}
                              description={t('optimization.desc_medium_sink')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('medium_sink')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('COP')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span className="notranslate">{t('optimization.panel.headers.cop')}</span>
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_cop')}
                              description={t('optimization.tooltip_cop')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('COP')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('Q_demand')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.q_sink')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_q_sink')}
                              description={t('optimization.tooltip_q_sink')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('Q_demand')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('Q_source')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.q_source')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_q_source')}
                              description={t('optimization.tooltip_q_source')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('Q_source')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('W_el')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.w_el')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_w_el')}
                              description={t('optimization.tooltip_w_el')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('W_el')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('T_sink')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          Actual Sink Temp [°C]
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_actual_sink_temp')}
                              description={t('optimization.desc_actual_sink_temp')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('T_sink')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('T_sink')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          Shifted Sink (T+{tMin/2}K) [°C]
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_shifted_sink_temp')}
                              description={t('optimization.desc_shifted_sink_temp')}
                              inline={true}
                            />
                          </span>
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('T_source')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          Actual Source Temp [°C]
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_actual_source_temp')}
                              description={t('optimization.desc_actual_source_temp')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('T_source')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('T_source')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          Shifted Source (T-{tMin/2}K) [°C]
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_shifted_source_temp')}
                              description={t('optimization.desc_shifted_source_temp')}
                              inline={true}
                            />
                          </span>
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('refrigerant')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.refrigerant')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_refrigerant')}
                              description={t('optimization.tooltip_refrigerant')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('refrigerant')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('hp_level')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.hp_stages')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title={t('optimization.title_hp_stages')}
                              description={t('optimization.tooltip_hp_stages')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('hp_level')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsToRender.map((pt, i) => {
                      const isSelected = selectedPoints.some(
                        (sp) => sp.refrigerant === pt.refrigerant && sp.T_sink === pt.T_sink
                      );
                      const refName = pt.refrigerant.includes('_')
                        ? pt.refrigerant.substring(0, pt.refrigerant.lastIndexOf('_'))
                        : pt.refrigerant;
                      return (
                        <tr
                          key={i}
                          style={
                            isSelected ? { backgroundColor: isDark ? '#334155' : '#E2E8F0' } : {}
                          }
                        >
                          <td>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: pt.theoretical
                                  ? isDark
                                    ? '#065F46'
                                    : '#D1FAE5'
                                  : isDark
                                    ? '#1E3A8A'
                                    : '#DBEAFE',
                                color: pt.theoretical
                                  ? isDark
                                    ? '#A7F3D0'
                                    : '#065F46'
                                  : isDark
                                    ? '#BFDBFE'
                                    : '#1E3A8A',
                              }}
                              title={entryHint(pt)}
                            >
                              {pt.theoretical
                                ? t('optimization.theoretical')
                                : t('optimization.real')}
                            </span>
                            {/* The refrigerant column is blank for archetypes,
                                so the technology name rides here — otherwise
                                Carnot and VHTHP rows look identical. Kept on
                                the same line so every row is one line tall. */}
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: isDark ? '#94A3B8' : '#64748B',
                              }}
                            >
                              {/* The Carnot entry is 50 % of the ceiling, not
                                  the ceiling, so it says so on the row. */}
                              {pt.theoretical
                                ? pt.refrigerant === 'Carnot'
                                  ? t('optimization.carnot_50')
                                  : pt.refrigerant
                                : ''}
                            </span>
                            {pt.calculation_details && (
                                <ChartHelpButton
                                  inline
                                  title={
                                    pt.theoretical
                                      ? `${pt.refrigerant} — ${t('optimization.calculation')}`
                                      : t('optimization.calculation')
                                  }
                                  description={
                                    <>
                                      <p>
                                        {entryHint(pt)}
                                      </p>
                                      <pre
                                        style={{
                                          margin: 0,
                                          whiteSpace: 'pre-wrap',
                                          fontFamily: 'monospace',
                                          fontSize: '0.9em',
                                        }}
                                      >
                                        {pt.calculation_details}
                                      </pre>
                                    </>
                                  }
                                />
                              )}
                            </div>
                          </td>
                          {/* Refrigerant type, medium and stage count describe a
                              trained machine; an archetype has none of them. */}
                          <td>{pt.theoretical ? '' : pt.refrigerant_type}</td>
                          <td>{pt.theoretical ? '' : pt.medium_sink}</td>
                          <td style={copCell}>{pt.COP.toFixed(2)}</td>
                          <td
                            style={sinkCell}
                            title={
                              pt.source_limited && pt.Q_demand_total
                                ? `Source-limited: the available waste heat only covers ${((100 * pt.Q_demand) / pt.Q_demand_total).toFixed(0)} % of the ${pt.Q_demand_total.toFixed(1)} kW required above this sink temperature.`
                                : undefined
                            }
                          >
                            {pt.Q_demand.toFixed(1)}
                            {pt.source_limited && pt.Q_demand_total ? (
                              <span
                                style={{
                                  color: isDark ? '#FBBF24' : '#B45309',
                                  marginLeft: '0.25rem',
                                }}
                              >
                                * / {pt.Q_demand_total.toFixed(1)}
                              </span>
                            ) : null}
                          </td>
                          <td style={sourceCell}>
                            {((pt.Q_demand * (pt.COP - 1)) / pt.COP).toFixed(1)}
                          </td>
                          <td style={elCell}>{(pt.Q_demand / pt.COP).toFixed(1)}</td>
                          <td style={sinkCell}>{pt.T_sink.toFixed(1)}</td>
                          <td style={sinkCell}>{(pt.T_sink + tMin / 2).toFixed(1)}</td>
                          <td style={sourceCell}>{pt.T_source.toFixed(1)}</td>
                          <td style={sourceCell}>{(pt.T_source - tMin / 2).toFixed(1)}</td>
                          <td>{pt.theoretical ? '' : refName}</td>
                          <td>{pt.theoretical ? '' : pt.hp_level}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            ) : (
              <div style={{ marginTop: '1rem', color: isDark ? '#94A3B8' : '#64748B' }}>
                <p>
                  {feasible_points.length === 0
                    ? 'No heat pump can be integrated with this stream selection.'
                    : 'No feasible optimizations found for these filters.'}
                </p>
                {feasible_points.length === 0 &&
                  diagnosticMessages.map((m, i) => (
                    <p key={i} style={{ marginTop: '0.5rem' }}>
                      {m}
                    </p>
                  ))}
              </div>
            )}
            {pointsToShow.some((p) => p.source_limited) && (
              <p
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.85rem',
                  color: isDark ? '#FBBF24' : '#B45309',
                }}
              >
                * Source-limited: the available waste heat covers only part of the demand above
                T_sink. The second figure is the full requirement; the rest still has to come from a
                utility.
              </p>
            )}
            <p
              style={{
                marginTop: '1rem',
                fontSize: '0.85rem',
                color: isDark ? '#94A3B8' : '#64748B',
              }}
            >
              {t('optimization.panel.instruction')}
            </p>
          </div>
        </div>

        <div className="pa-right-col">
          {/* Direction and widths come from CSS (pa-opt-*) so they can stack
              on narrow screens — inline values would win over the media query. */}
          <div className="pa-card pa-opt-row" style={{ gap: '1.5rem', alignItems: 'flex-start' }}>
            {/* Filters on the left of the visual */}
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
              <div ref={refDropdownRef} style={{ position: 'relative' }}>
                <label style={labelStyle}>{t('optimization.panel.filters.refrigerant')}</label>
                <div
                  style={{
                    ...selectStyle,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                  }}
                  onClick={() => setRefDropdownOpen(!refDropdownOpen)}
                >
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {refrigerantFilter.length === 0 ? t('optimization.panel.filters.all') : refrigerantFilter.join(', ')}
                  </span>
                  <span style={{ fontSize: '0.8em', marginLeft: '8px' }}>▼</span>
                </div>
                {refDropdownOpen && (
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
                    {uniqueRefrigerants.map((ref) => (
                      <label
                        key={ref}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.25rem 0',
                          cursor: 'pointer',
                          color: isDark ? '#F8FAFC' : '#0F172A',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={refrigerantFilter.includes(ref)}
                          onChange={() => toggleRefrigerant(ref)}
                        />
                        {ref}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div ref={hpDropdownRef} style={{ position: 'relative' }}>
                <label style={labelStyle}>{t('optimization.panel.filters.hp_stages')}</label>
                <div
                  style={{
                    ...selectStyle,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                  }}
                  onClick={() => setHpDropdownOpen(!hpDropdownOpen)}
                >
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {hpLevelFilter.length === 0 ? t('optimization.panel.filters.all') : hpLevelFilter.join(', ')}
                  </span>
                  <span style={{ fontSize: '0.8em', marginLeft: '8px' }}>▼</span>
                </div>
                {hpDropdownOpen && (
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
                    {uniqueHpLevels.map((level) => (
                      <label
                        key={level}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.25rem 0',
                          cursor: 'pointer',
                          color: isDark ? '#F8FAFC' : '#0F172A',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={hpLevelFilter.includes(level)}
                          onChange={() => toggleHpLevel(level)}
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                )}
              </div>
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
                      checked={showTheoretical}
                      onChange={(e) => setShowTheoretical(e.target.checked)}
                      style={{ marginTop: '0.15rem' }}
                    />
                    <span>
                      {t('optimization.panel.filters.show_theoretical')} ({theoreticalCount})
                      <br />
                      <span style={{ fontSize: '0.75rem' }}>
                        {t('optimization.panel.filters.show_theoretical_desc')}
                      </span>
                    </span>
                  </label>
                )}
                {sourceLimitedCount > 0 && (
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
                      checked={showSourceLimited}
                      onChange={(e) => setShowSourceLimited(e.target.checked)}
                      style={{ marginTop: '0.15rem' }}
                    />
                    <span>
                      {t('optimization.panel.filters.source_limited')} ({sourceLimitedCount})
                      <br />
                      <span style={{ fontSize: '0.75rem' }}>
                        {t('optimization.panel.filters.source_limited_desc')}
                      </span>
                    </span>
                  </label>
                )}
                {demandLimitedCount > 0 && (
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
                      checked={showDemandLimited}
                      onChange={(e) => setShowDemandLimited(e.target.checked)}
                      style={{ marginTop: '0.15rem' }}
                    />
                    <span>
                      {t('optimization.panel.filters.demand_limited')} ({demandLimitedCount})
                      <br />
                      <span style={{ fontSize: '0.75rem' }}>
                        {t('optimization.panel.filters.demand_limited_desc')}
                      </span>
                    </span>
                  </label>
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
                  {t('optimization.panel.filters.feasible')} {feasible_points.length}
                  {(sourceLimitedCount > 0 || demandLimitedCount > 0) && (
                    <>
                      <br />
                      <span style={{ fontWeight: 400 }}>{t('optimization.panel.filters.shown')} {chartPoints.length}</span>
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
                    description={
          <>
            <p>
              {t('optimization.desc_opt_panel_c1')}{' '}
              <strong>{t('optimization.desc_opt_panel_c2')}</strong>{t('optimization.desc_opt_panel_c3')}
            </p>
            <p>
              {t('optimization.desc_opt_panel_c4')}
            </p>
            <ul style={{ margin: '4px 0 8px 16px', padding: 0 }}>
              <li>
                <code>T_source</code>, <code>T_sink</code>{t('optimization.desc_opt_panel_c5')}
              </li>
              <li>
                <code>T_lift</code>{t('optimization.desc_opt_panel_c6')}
              </li>
              <li>
                <code>carnot</code>{t('optimization.desc_opt_panel_c7')}
              </li>
            </ul>
            <p>
              {t('optimization.desc_opt_panel_c8')}{' '}
              <code>0.5 * (T_sink + 273.15) / T_lift</code>{t('optimization.desc_opt_panel_c9')}<code>0.5 * carnot</code>{t('optimization.desc_opt_panel_c10')}
            </p>
            <p>
              {t('optimization.desc_opt_panel_c11')}<strong>{t('optimization.desc_opt_panel_c12')}</strong>{t('optimization.desc_opt_panel_c13')}{' '}
              <code>(0.5 * (T_sink + 273.15) / T_lift) if T_sink &lt;= 100 else (0.4 * (T_sink + 273.15) / T_lift)</code>{t('optimization.desc_opt_panel_c14')}
            </p>
            <p>
              {t('optimization.desc_opt_panel_c15')}<strong>{t('optimization.desc_opt_panel_c16')}</strong>{t('optimization.desc_opt_panel_c17')}
            </p>
          </>
        }
                  />
                </div>
                <button
                  className={`cf-trigger ${copFormula ? 'active' : ''}`}
                  onClick={() => setFormulaOpen(true)}
                >
                  {copFormula ? `ƒ ${copFormula.name}` : `ƒ ${t('optimization.panel.filters.custom_cop_btn')}`}
                  <span className="cf-trigger-sub">
                    {copFormula
                      ? copFormula.expression
                      : t('optimization.panel.filters.custom_cop_desc')}
                  </span>
                </button>
              </div>
            </div>

            {/* Visual on the right */}
            <div
              className="pa-opt-chart"
              style={{ display: 'flex', minWidth: 0, overflow: 'hidden' }}
            >
              <HPIOptimizationChart
                originalGCC={original_gcc}
                pocketlessSource={hpiOptimizationResult.pocketless_source}
                pocketlessSink={hpiOptimizationResult.pocketless_sink}
                heatCascade={pinchResult.heat_cascade}
                feasiblePoints={chartPoints}
                maxQPoint={chartMaxQPoint}
                selectedPoints={selectedPoints}
                onSelectPoints={setSelectedPoints}
                pinchTemperature={pinchResult.pinch_temperature}
                profileMode={hpiOptimizationResult.profile_mode}
              />
            </div>
          </div>
        </div>
      </div>

      {formulaOpen && (
        <CopFormulaModal
          initial={copFormula}
          onCancel={() => setFormulaOpen(false)}
          onApply={(formula) => {
            setCopFormula(formula);
            setFormulaOpen(false);
          }}
        />
      )}
    </div>
  );
}
