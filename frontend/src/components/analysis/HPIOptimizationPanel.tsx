import { useState, useEffect, useRef } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import { useTranslation } from 'react-i18next';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import HPIOptimizationChart from './HPIOptimizationChart';
import ChartHelpButton from '../ui/ChartHelpButton';
import CopFormulaModal from './CopFormulaModal';

type SortKey =
  | 'refrigerant_type'
  | 'medium_sink'
  | 'refrigerant'
  | 'hp_level'
  | 'COP'
  | 'T_source'
  | 'T_sink'
  | 'Q_source'
  | 'Q_demand';

/** An operating point is identified by its refrigerant and the temperature
 *  pair it runs between — the backend sends max_q_point as its own object, so
 *  it never matches a point in the list by reference. */
function isSamePoint(a: OptimizedIntegrationPoint, b: OptimizedIntegrationPoint): boolean {
  return (
    a.refrigerant === b.refrigerant &&
    a.medium_sink === b.medium_sink &&
    a.T_sink === b.T_sink &&
    a.T_source === b.T_source
  );
}

export default function HPIOptimizationPanel() {
  const hpiOptimizationResult = useAnalysisStore((s) => s.hpiOptimizationResult);
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const tMin = useAnalysisStore((s) => s.tMin);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { t } = useTranslation();

  const [selectedPoints, setSelectedPoints] = useState<OptimizedIntegrationPoint[]>([]);

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
  const [showSourceLimited, setShowSourceLimited] = useState(false);
  const [showDemandLimited, setShowDemandLimited] = useState(false);

  // Sort state (supports multi-column)
  const [sortConfigs, setSortConfigs] = useState<
    Array<{ key: SortKey; direction: 'asc' | 'desc' }>
  >([{ key: 'Q_demand', direction: 'desc' }]);
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
      setSortConfigs([{ key: 'Q_demand', direction: 'desc' }]);
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

  // Two kinds of point sit off a profile and turn the chart into a cloud when
  // plotted by default. Source-limited ones deliver less than the demand above
  // T_sink, so they miss the sink profile; demand-limited ones leave waste heat
  // unused at T_source, so they miss the source profile. Both stay in the table
  // and can be switched on explicitly.
  const onProfilePoints = filteredPoints.filter((p) => !p.source_limited && !p.demand_limited);
  const sourceLimitedCount = filteredPoints.filter((p) => p.source_limited).length;
  const demandLimitedCount = filteredPoints.filter((p) => p.demand_limited).length;
  // If nothing sits on the profiles, a chart with no points at all would be
  // worse than a busy one — fall back to showing everything.
  const chartPoints =
    onProfilePoints.length === 0
      ? filteredPoints
      : filteredPoints.filter(
          (p) =>
            (!p.source_limited || showSourceLimited) && (!p.demand_limited || showDemandLimited)
        );

  // The max-Q point is highlighted by default, so it has to follow the same
  // visibility rules as the cloud — otherwise it draws an off-profile marker
  // while the source/demand-limited boxes are unticked, which reads as a bug.
  // An explicitly selected point is left alone: hiding what was just clicked
  // would be worse than showing it off-profile.
  //
  // When the backend's max-Q point is one of the hidden ones, highlight the
  // best point that *is* visible rather than dropping the highlight — the
  // source→sink connector is drawn only for the active point, so leaving it
  // empty loses the link between the two dots. Same rule as the backend: most
  // duty delivered, higher COP breaks a tie.
  const bestVisiblePoint = chartPoints.reduce<OptimizedIntegrationPoint | null>(
    (best, p) =>
      !best || p.Q_demand > best.Q_demand || (p.Q_demand === best.Q_demand && p.COP > best.COP)
        ? p
        : best,
    null
  );
  const chartMaxQPoint =
    max_q_point && chartPoints.some((p) => isSamePoint(p, max_q_point))
      ? max_q_point
      : bestVisiblePoint;

  const bestByType = new Map<string, OptimizedIntegrationPoint>();
  for (const pt of filteredPoints) {
    const existing = bestByType.get(pt.refrigerant_type);
    if (
      !existing ||
      pt.Q_demand > existing.Q_demand ||
      (pt.Q_demand === existing.Q_demand && pt.COP > existing.COP)
    ) {
      bestByType.set(pt.refrigerant_type, pt);
    }
  }
  let tableData = Array.from(bestByType.values());

  const pointsToShow = [...tableData];
  selectedPoints.forEach((sp) => {
    if (!pointsToShow.some((p) => p.refrigerant === sp.refrigerant && p.T_sink === sp.T_sink)) {
      pointsToShow.unshift(sp);
    }
  });

  // Sorting
  pointsToShow.sort((a, b) => {
    for (const config of sortConfigs) {
      let valA: any = a[config.key];
      let valB: any = b[config.key];

      if (config.key === 'Q_source') {
        valA = (a.Q_demand * (a.COP - 1)) / a.COP;
        valB = (b.Q_demand * (b.COP - 1)) / b.COP;
      }

      if (valA < valB) return config.direction === 'asc' ? -1 : 1;
      if (valA > valB) return config.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

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
  };

  return (
    <div className={`analysis-panel ${isDark ? 'dark-mode' : ''}`} style={{ marginTop: '2rem' }}>
      <div className="pa-split-layout">
        <div className="pa-left-col">
          <div className="pa-hp-table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {pointsToShow.length > 0 ? (
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
                      title="Model Information"
                      description="Please note that the Heat Pump model provided by Copeland is based on physical simulations and yields approximations intended for reference purposes only. For precise calculations or project-specific data, please contact Copeland directly."
                      inline={true}
                    />
                  </span>
                </div>
                <table className="pa-table pa-hp-table">
                  <thead style={{ position: 'sticky', top: '30px', zIndex: 2 }}>
                    <tr>
                      <th style={thStyle} onClick={() => handleSort('refrigerant_type')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.refrigerant_type')}
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title="Refrigerant Type"
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
                              title="Medium Sink"
                              description="The sink medium for this integration"
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
                              title="COP"
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
                              title="Q_Sink"
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
                              title="Q_Source"
                              description={t('optimization.tooltip_q_source')}
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('Q_source')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('T_sink')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.t_sink')} [°C]
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title="Shifted Sink Temp"
                              description="The shifted temperature of the heat sink pocket on the GCC."
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('T_sink')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('T_sink')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                          Actual Sink (T*-{tMin/2}K) [°C]
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title="Actual Sink Temp"
                              description="The actual physical temperature of the heat sink process."
                              inline={true}
                            />
                          </span>
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('T_source')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t('optimization.panel.headers.t_source')} [°C]
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title="Shifted Source Temp"
                              description="The shifted temperature of the heat source pocket on the GCC."
                              inline={true}
                            />
                          </span>
                          {renderSortIcon('T_source')}
                        </div>
                      </th>
                      <th style={thStyle} onClick={() => handleSort('T_source')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                          Actual Source (T*+{tMin/2}K) [°C]
                          <span onClick={(e) => e.stopPropagation()}>
                            <ChartHelpButton
                              title="Actual Source Temp"
                              description="The actual physical temperature of the heat source process."
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
                              title="Refrigerant"
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
                              title="HP Stages"
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
                    {pointsToShow.map((pt, i) => {
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
                          <td>{pt.refrigerant_type}</td>
                          <td>{pt.medium_sink}</td>
                          <td style={{ fontWeight: 600 }}>{pt.COP.toFixed(2)}</td>
                          <td
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
                          <td>{((pt.Q_demand * (pt.COP - 1)) / pt.COP).toFixed(1)}</td>
                          <td>{pt.T_sink.toFixed(1)}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{(pt.T_sink - tMin/2).toFixed(1)}</td>
                          <td>{pt.T_source.toFixed(1)}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{(pt.T_source + tMin/2).toFixed(1)}</td>
                          <td>{refName}</td>
                          <td>{pt.hp_level}</td>
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
                    title="Custom COP formula"
                    description={
                      <>
                        <p>
                          By default every heat pump above gets its COP from a data-driven model
                          trained based on simualtion data. Here you can add{' '}
                          <strong>your own equation</strong> as one extra heat pump, so it appears
                          in the same table and chart and can be compared against the model
                          directly.
                        </p>
                        <p>
                          Write COP as an expression of the operating temperatures. Available
                          variables:
                        </p>
                        <ul style={{ margin: '4px 0 8px 16px', padding: 0 }}>
                          <li>
                            <code>T_source</code>, <code>T_sink</code> — °C
                          </li>
                          <li>
                            <code>T_lift</code> — T_sink − T_source
                          </li>
                          <li>
                            <code>carnot</code> — T_sink in K, divided by T_lift
                          </li>
                        </ul>
                        <p>
                          So a heat pump at 50 % of Carnot is written as{' '}
                          <code>0.5 * (T_sink + 273.15) / T_lift</code> (or <code>0.5 * carnot</code>).
                        </p>
                        <p>
                          You can also write <strong>temperature interval conditions</strong>, for instance:{' '}
                          <code>(0.5 * (T_sink + 273.15) / T_lift) if T_sink &lt;= 100 else (0.4 * (T_sink + 273.15) / T_lift)</code>.
                        </p>
                        <p>
                          The formula is checked as you type and previewed at one operating point.
                          Set a <strong>validity range</strong> to say where your heat pump may be
                          used — outside it the pump is not offered, exactly as a model refrigerant
                          is ignored outside its trained range.
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
