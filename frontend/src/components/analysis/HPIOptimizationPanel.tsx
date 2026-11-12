import { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import HPIOptimizationChart from './HPIOptimizationChart';
import HeatPumpView from './HeatPumpView';
import { activePointsOf, boxPointsOf } from './optimizationChartPoints';
import HPIOptimizationFilters from './HPIOptimizationFilters';
import HPIOptimizationTable from './HPIOptimizationTable';
import CopFormulaModal from './CopFormulaModal';
import CopModelTrainModal from './CopModelTrainModal';
import { useFeatures } from '../../hooks/useFeatures';
import { CommandError, useLiveCommand } from '../../live/commands';
import {
  chartView,
  filterOptions,
  filterPoints,
  nextSortConfigs,
  sortRows,
  tableRows,
  type SortConfig,
  type SortKey,
} from './hpiOptimizationRows';

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
  const copModel = useAnalysisStore((s) => s.copModel);
  const setCopModel = useAnalysisStore((s) => s.setCopModel);
  const searchTemps = useAnalysisStore((s) => s.searchTemps);
  const setSearchTemps = useAnalysisStore((s) => s.setSearchTemps);
  const setCopFormula = useAnalysisStore((s) => s.setCopFormula);
  const [formulaOpen, setFormulaOpen] = useState(false);
  // Trained COP model (COP training module).
  const customCopModel = useAnalysisStore((s) => s.customCopModel);
  const setCustomCopModel = useAnalysisStore((s) => s.setCustomCopModel);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [heatPumpOpen, setHeatPumpOpen] = useState(false);
  const trainingAvailable = useFeatures().cop_training;

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

  // Sort state (supports multi-column). The panel shows only with a result,
  // and a result opens sorted by duty.
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([
    { key: 'Q_demand', direction: 'desc' },
  ]);

  // A new result starts from the default view. Reset while rendering, not in an
  // effect, so the stale view is never drawn (React: "adjusting state when a
  // prop changes").
  const [shownResult, setShownResult] = useState(hpiOptimizationResult);
  if (shownResult !== hpiOptimizationResult) {
    setShownResult(hpiOptimizationResult);
    if (hpiOptimizationResult?.max_q_point) {
      setMediumSinkFilter('All');
      setRefrigerantTypeFilter('All');
      setRefrigerantFilter([]);
      setHpLevelFilter([]);
      setShowSourceLimited(false);
      setShowDemandLimited(false);
      setSortConfigs([{ key: 'Q_demand', direction: 'desc' }]);
    }
  }

  // The selection lives in the store: a new result or another filter clears it.
  useEffect(() => {
    if (hpiOptimizationResult?.max_q_point) setSelectedPoints([]);
  }, [hpiOptimizationResult, setSelectedPoints]);

  useEffect(() => {
    setSelectedPoints([]);
  }, [mediumSinkFilter, refrigerantTypeFilter, refrigerantFilter, hpLevelFilter, setSelectedPoints]);

  // The AI sets the same filters (and "Select all") as the controls on the left.
  const currentFilters = {
    mediumSink: mediumSinkFilter,
    refrigerantType: refrigerantTypeFilter,
    refrigerants: refrigerantFilter,
    hpLevels: hpLevelFilter,
    showTheoretical,
  };
  useLiveCommand('set_heat_pump_filters', (args) => {
    if (!hpiOptimizationResult) throw new CommandError('There are no optimization results yet.');
    const options = filterOptions(hpiOptimizationResult.feasible_points);
    const pick = (value: unknown, allowed: string[], what: string) => {
      const v = String(value);
      if (v !== 'All' && !allowed.includes(v))
        throw new CommandError(`${what} must be "All" or one of ${allowed.join(', ')}`);
      return v;
    };
    const many = (value: unknown, allowed: string[], what: string) =>
      (value as unknown[]).map((v) => pick(v, allowed, what)).filter((v) => v !== 'All');
    if (args.medium_sink !== undefined)
      setMediumSinkFilter(pick(args.medium_sink, options.mediumSinks, 'medium_sink'));
    if (args.refrigerant_type !== undefined)
      setRefrigerantTypeFilter(
        pick(args.refrigerant_type, options.refrigerantTypes, 'refrigerant_type')
      );
    if (args.refrigerants !== undefined)
      setRefrigerantFilter(many(args.refrigerants, options.refrigerants, 'refrigerants'));
    if (args.stages !== undefined)
      setHpLevelFilter(many(args.stages, options.hpLevels, 'stages'));
    if (args.show_theoretical !== undefined) setShowTheoretical(Boolean(args.show_theoretical));
    if (args.show_source_limited !== undefined)
      setShowSourceLimited(Boolean(args.show_source_limited));
    if (args.show_demand_limited !== undefined)
      setShowDemandLimited(Boolean(args.show_demand_limited));
    return { options };
  });
  useLiveCommand('select_filtered_heat_pumps', () => {
    if (!hpiOptimizationResult) throw new CommandError('There are no optimization results yet.');
    const points = filterPoints(hpiOptimizationResult.feasible_points, currentFilters);
    setSelectedPoints([...points]);
    return { selected: points.length };
  });

  if (!hpiOptimizationResult || !pinchResult) return null;

  const { feasible_points, max_q_point, original_gcc } = hpiOptimizationResult;
  const diagnosticMessages = hpiOptimizationResult.diagnostics?.messages ?? [];

  const filteredPoints = filterPoints(feasible_points, currentFilters);

  // Counted on the raw results, so the checkbox can say how many rows it would
  // bring back while they are hidden.
  const theoreticalCount = new Set(
    feasible_points.filter((p) => p.theoretical).map((p) => p.refrigerant)
  ).size;

  const { chartPoints, chartMaxQPoint, sourceLimitedCount, demandLimitedCount } = chartView(
    filteredPoints,
    showSourceLimited,
    showDemandLimited,
    max_q_point
  );

  // The table picks its best rows from what the chart plots, so the boxed
  // pump is always one of them (the report does the same).
  const rows = sortRows(tableRows(chartPoints, selectedPoints, showTheoretical), sortConfigs);

  // The heat pump view shows the pump the chart boxes; its pump list is every
  // real machine in the results (the trained models need a refrigerant).
  const boxedPoint = boxPointsOf(activePointsOf(chartMaxQPoint, selectedPoints))[0] ?? null;
  const realPumps = Array.from(
    new Map(
      feasible_points
        .filter((p) => !p.theoretical && p.refrigerant_type !== 'Custom formula')
        .map((p) => [`${p.refrigerant}|${p.medium_sink}`, { refrigerant: p.refrigerant, medium_sink: p.medium_sink }])
    ).values()
  ).sort((a, b) => a.refrigerant.localeCompare(b.refrigerant) || a.medium_sink.localeCompare(b.medium_sink));

  const handleSort = (key: SortKey) => setSortConfigs((prev) => nextSortConfigs(prev, key));
  const toggle = (prev: string[], v: string) =>
    prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];

  return (
    <div className={`analysis-panel ${isDark ? 'dark-mode' : ''}`} style={{ marginTop: '2rem' }}>
      <div className="pa-split-layout">
        <div className="pa-left-col">
          <HPIOptimizationTable
            rows={rows}
            selectedPoints={selectedPoints}
            sortConfigs={sortConfigs}
            onSort={handleSort}
            tMin={tMin}
            isDark={isDark}
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
              options={filterOptions(feasible_points)}
              mediumSink={mediumSinkFilter}
              onMediumSink={setMediumSinkFilter}
              refrigerantType={refrigerantTypeFilter}
              onRefrigerantType={setRefrigerantTypeFilter}
              refrigerants={refrigerantFilter}
              onToggleRefrigerant={(v) => setRefrigerantFilter((prev) => toggle(prev, v))}
              hpLevels={hpLevelFilter}
              onToggleHpLevel={(v) => setHpLevelFilter((prev) => toggle(prev, v))}
              onSelectAll={() => setSelectedPoints([...filteredPoints])}
              onClear={() => setSelectedPoints([])}
              theoreticalCount={theoreticalCount}
              showTheoretical={showTheoretical}
              onShowTheoretical={setShowTheoretical}
              sourceLimitedCount={sourceLimitedCount}
              showSourceLimited={showSourceLimited}
              onShowSourceLimited={setShowSourceLimited}
              demandLimitedCount={demandLimitedCount}
              showDemandLimited={showDemandLimited}
              onShowDemandLimited={setShowDemandLimited}
              feasibleCount={feasible_points.length}
              shownCount={chartPoints.length}
              copModel={copModel}
              onCopModel={setCopModel}
              copFormula={copFormula}
              onOpenFormula={() => setFormulaOpen(true)}
              trainingAvailable={trainingAvailable}
              customModel={customCopModel}
              onOpenTraining={() => setTrainingOpen(true)}
              onOpenHeatPump={() => setHeatPumpOpen(true)}
              onToggleCustomModel={(enabled) =>
                customCopModel && setCustomCopModel({ ...customCopModel, enabled })
              }
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
                onOpenHeatPump={() => setHeatPumpOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {heatPumpOpen && boxedPoint && (
        <HeatPumpView
          // A new search gives a new point: start the view from it.
          key={`${boxedPoint.refrigerant}|${boxedPoint.T_source}|${boxedPoint.T_sink}|${searchTemps.join()}`}
          point={boxedPoint}
          pinchTemperature={pinchResult.pinch_temperature}
          tMin={tMin}
          pumps={realPumps}
          sourceProfile={hpiOptimizationResult.pocketless_source}
          sinkProfile={hpiOptimizationResult.pocketless_sink}
          copModel={copModel}
          searchTemps={searchTemps}
          onSearchTemps={setSearchTemps}
          onClose={() => setHeatPumpOpen(false)}
        />
      )}

      {trainingOpen && (
        <CopModelTrainModal
          initial={customCopModel}
          onCancel={() => setTrainingOpen(false)}
          onApply={(model) => {
            setCustomCopModel(model);
            setTrainingOpen(false);
          }}
        />
      )}

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
