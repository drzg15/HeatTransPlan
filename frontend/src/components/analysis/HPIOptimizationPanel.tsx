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
import HPIOptimizationChart from './HPIOptimizationChart';
import HPIOperatingTable from './HPIOperatingTable';
import HPIOptimizationFilters from './HPIOptimizationFilters';
import CopFormulaModal from './CopFormulaModal';

export default function HPIOptimizationPanel() {
  const hpiOptimizationResult = useAnalysisStore((s) => s.hpiOptimizationResult);
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const tMin = useAnalysisStore((s) => s.tMin);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

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


  const handleSort = (key: SortKey) => {
    setSortConfigs((prev) => {
      const existingIdx = prev.findIndex((c) => c.key === key);
      if (existingIdx === 0) {
        // Toggle direction of primary sort
        const newConfigs = [...prev];
        newConfigs[0] = { key, direction: prev[0].direction === 'desc' ? 'asc' : 'desc' } as SortConfig;
        return newConfigs;
      } else if (existingIdx > 0) {
        // Move to front and set to ascending
        const newConfigs = prev.filter((c) => c.key !== key);
        newConfigs.unshift({ key, direction: 'asc' });
        return newConfigs;
      } else {
        // Add to front as primary sort, keep up to 3 keys
        return [{ key, direction: 'asc' as const }, ...prev].slice(0, 3);
      }
    });
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

  return (
    <div className={`analysis-panel ${isDark ? 'dark-mode' : ''}`} style={{ marginTop: '2rem' }}>
      <div className="pa-split-layout">
        <div className="pa-left-col">
          <HPIOperatingTable
            isDark={isDark}
            tMin={tMin}
            rows={pointsToShow}
            selectedPoints={selectedPoints}
            sortConfigs={sortConfigs}
            onSort={handleSort}
            feasibleCount={feasible_points.length}
            diagnosticMessages={diagnosticMessages}
          />
        </div>

        <div className="pa-right-col">
          {/* Direction and widths come from CSS (pa-opt-*) so they can stack
              on narrow screens — inline values would win over the media query. */}
          <div className="pa-card pa-opt-row" style={{ gap: '1.5rem', alignItems: 'flex-start' }}>
            {/* Filters on the left of the visual */}
            <HPIOptimizationFilters
              isDark={isDark}
              uniqueMediumSinks={uniqueMediumSinks}
              uniqueRefrigerantTypes={uniqueRefrigerantTypes}
              uniqueRefrigerants={uniqueRefrigerants}
              uniqueHpLevels={uniqueHpLevels}
              mediumSinkFilter={mediumSinkFilter}
              setMediumSinkFilter={setMediumSinkFilter}
              refrigerantTypeFilter={refrigerantTypeFilter}
              setRefrigerantTypeFilter={setRefrigerantTypeFilter}
              refrigerantFilter={refrigerantFilter}
              hpLevelFilter={hpLevelFilter}
              toggleRefrigerant={toggleRefrigerant}
              toggleHpLevel={toggleHpLevel}
              refDropdownRef={refDropdownRef}
              hpDropdownRef={hpDropdownRef}
              refDropdownOpen={refDropdownOpen}
              setRefDropdownOpen={setRefDropdownOpen}
              hpDropdownOpen={hpDropdownOpen}
              setHpDropdownOpen={setHpDropdownOpen}
              showTheoretical={showTheoretical}
              setShowTheoretical={setShowTheoretical}
              showSourceLimited={showSourceLimited}
              setShowSourceLimited={setShowSourceLimited}
              showDemandLimited={showDemandLimited}
              setShowDemandLimited={setShowDemandLimited}
              theoreticalCount={theoreticalCount}
              sourceLimitedCount={sourceLimitedCount}
              demandLimitedCount={demandLimitedCount}
              filteredPoints={filteredPoints}
              setSelectedPoints={setSelectedPoints}
              feasibleCount={feasible_points.length}
              chartPointsCount={chartPoints.length}
              copFormula={copFormula}
              onOpenFormula={() => setFormulaOpen(true)}
            />

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
