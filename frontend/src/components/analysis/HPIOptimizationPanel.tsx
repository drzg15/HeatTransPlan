import { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import HPIOptimizationChart from './HPIOptimizationChart';
import HPIOptimizationFilters from './HPIOptimizationFilters';
import HPIOptimizationTable from './HPIOptimizationTable';
import CopFormulaModal from './CopFormulaModal';
import CopModelTrainModal from './CopModelTrainModal';
import { useFeatures } from '../../hooks/useFeatures';
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
  const setCopFormula = useAnalysisStore((s) => s.setCopFormula);
  const [formulaOpen, setFormulaOpen] = useState(false);
  // Trained COP model (COP training module).
  const customCopModel = useAnalysisStore((s) => s.customCopModel);
  const setCustomCopModel = useAnalysisStore((s) => s.setCustomCopModel);
  const [trainingOpen, setTrainingOpen] = useState(false);
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

  // Sort state (supports multi-column)
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([{ key: 'COP', direction: 'desc' }]);

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

  if (!hpiOptimizationResult || !pinchResult) return null;

  const { feasible_points, max_q_point, original_gcc } = hpiOptimizationResult;
  const diagnosticMessages = hpiOptimizationResult.diagnostics?.messages ?? [];

  const filteredPoints = filterPoints(feasible_points, {
    mediumSink: mediumSinkFilter,
    refrigerantType: refrigerantTypeFilter,
    refrigerants: refrigerantFilter,
    hpLevels: hpLevelFilter,
    showTheoretical,
  });

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

  const rows = sortRows(tableRows(filteredPoints, selectedPoints, showTheoretical), sortConfigs);

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
              />
            </div>
          </div>
        </div>
      </div>

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
