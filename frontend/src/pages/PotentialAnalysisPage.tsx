/** PotentialAnalysisPage — main page assembling all analysis sub-components.
 *  1:1 port of the original Streamlit potential_analysis.py layout.
 */

import {
  BookOpen,
  CircleCheck,
  FileText,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Save,
  TriangleAlert,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ChangeEvent,
} from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAnalysisStore } from '../store/analysisStore';
import {
  runPinch,
  runHPI,
  runStatusQuo,
  generateReport,
  runHPIOptimization,
} from '../api/analysis';
import { getStreamInfo } from '../utils/streamUtils';
import type { PinchStream } from '../types/analysis';

import StreamSelector from '../components/analysis/StreamSelector';
import EnergyDemands from '../components/analysis/EnergyDemands';
import MapViewer from '../components/map/MapViewer';
import PinchMetrics from '../components/analysis/PinchMetrics';
import PinchCurvesChart from '../components/analysis/PinchCurvesChart';
import { usePinchLink } from '../store/pinchLinkStore';
import StatusQuoComparison from '../components/analysis/StatusQuoComparison';
import TemperatureIntervalDiagram from '../components/analysis/TemperatureIntervalDiagram';
import ScenarioComparison from '../components/analysis/ScenarioComparison';
import HPIOptimizationPanel from '../components/analysis/HPIOptimizationPanel';
import { econReportData } from '../components/analysis/econModel';
import EconomicAnalysis from '../components/analysis/EconomicAnalysis';
import { HPISummary, PinchSummary } from '../components/analysis/SectionSummaries';
import Section from '../components/ui/Section';
import Part from '../components/ui/Part';
import CopCoverageChart from '../components/analysis/CopCoverageChart';
import HeatRecoveryToggle from '../components/analysis/HeatRecoveryToggle';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';

import './PotentialAnalysisPage.css';

const DEFAULT_HP_TYPES = [
  'Prototypical Stirling',
  'VHTHP (HFC/HFO)',
  'SHP and HTHPs (HFC/HFO)',
  'SHP and HTHPs (R717)',
  'Carnot',
];
import AnalysisHelp from '../components/ui/AnalysisHelp';
import ChartHelpButton from '../components/ui/ChartHelpButton';

export default function PotentialAnalysisPage() {
  const { t, i18n } = useTranslation();
  const processes = useProjectStore((s) => s.state.processes);
  const pinchNotes = useProjectStore((s) => s.state.pinch_notes);
  const setPinchNotes = useProjectStore((s) => s.setPinchNotes);

  const selectedStreams = useAnalysisStore((s) => s.selectedStreams);
  const tMin = useAnalysisStore((s) => s.tMin);
  const showShifted = useAnalysisStore((s) => s.showShifted);
  const profileMode = useAnalysisStore((s) => s.profileMode);
  const setTMin = useAnalysisStore((s) => s.setTMin);
  const setShowShifted = useAnalysisStore((s) => s.setShowShifted);
  const explain = usePinchLink((s) => s.explain);
  const setExplain = usePinchLink((s) => s.setExplain);
  const setProfileMode = useAnalysisStore((s) => s.setProfileMode);
  const recoveryPct = useAnalysisStore((s) => s.recoveryPct);
  const setPinchResult = useAnalysisStore((s) => s.setPinchResult);
  const setHPIResult = useAnalysisStore((s) => s.setHPIResult);
  const setStatusQuoResult = useAnalysisStore((s) => s.setStatusQuoResult);
  const pinchResult = useAnalysisStore((s) => s.pinchResult);
  const selectedHPTypes = useAnalysisStore((s) => s.selectedHPTypes);
  const setSelectedHPTypes = useAnalysisStore((s) => s.setSelectedHPTypes);
  const setPinchLoading = useAnalysisStore((s) => s.setPinchLoading);
  const setHPILoading = useAnalysisStore((s) => s.setHPILoading);
  const setHPIOptimizationLoading = useAnalysisStore((s) => s.setHPIOptimizationLoading);
  const setHPIOptimizationResult = useAnalysisStore((s) => s.setHPIOptimizationResult);
  const hpiOptimizationResult = useAnalysisStore((s) => s.hpiOptimizationResult);
  const pinchLoading = useAnalysisStore((s) => s.pinchLoading);
  const hpiResult = useAnalysisStore((s) => s.hpiResult);
  const energyDemands = useAnalysisStore((s) => s.energyDemands);
  const copFormula = useAnalysisStore((s) => s.copFormula);
  const copModel = useAnalysisStore((s) => s.copModel);

  const [pinchError, setPinchError] = useState<string | null>(null);
  const [, setHPIError] = useState<string | null>(null);
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  // The classic HPI panel — the five technology archetypes at a single sink
  // temperature — is superseded by the optimisation panel below, which sweeps
  // them across every sink temperature. Kept behind a toggle rather than
  // removed, so it is one click away while it is still being compared against.
  const [hpiReset, setHpiReset] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Store actions
  const setState = useProjectStore((s) => s.setState);
  const setAnalysisSelection = useProjectStore((s) => s.setAnalysisSelection);
  const setAnalysisDemands = useProjectStore((s) => s.setAnalysisDemands);
  const setAnalysisTMin = useProjectStore((s) => s.setAnalysisTMin);

  // Full project state for report
  const projectState = useProjectStore((s) => s.state);

  // 1. Unified Synchronization Logic: Sync UI (AnalysisStore) ↔ Project (ProjectStore)
  // We use a ref to store the last stringified state we synced to avoid infinite loops.
  const lastSyncedJsonRef = useRef<string>('');

  useEffect(() => {
    if (!projectState) return;

    // Detect if the change came from a "Load" (the ProjectStore state is different from what we last saw)
    const currentAnalysisData = {
      selected_streams: projectState.selected_streams || {},
      energy_demands: projectState.energy_demands || [],
      t_min: projectState.t_min ?? 10.0,
    };
    const psJson = JSON.stringify(currentAnalysisData);

    // If the project state has changed (e.g. from a file load), push it to the local UI store
    if (psJson !== lastSyncedJsonRef.current) {
      // Stream Selections
      useAnalysisStore.setState({ selectedStreams: currentAnalysisData.selected_streams });

      // Energy Demands (normalize for compatibility)
      const mappedDemands = currentAnalysisData.energy_demands.map((d: any) => ({
        heat_demand: d.heat_demand ?? d.heating_kW ?? 0,
        cooling_demand: d.cooling_demand ?? d.cooling_kW ?? 0,
        selected_heat_streams: d.selected_heat_streams ?? [],
        selected_cooling_streams: d.selected_cooling_streams ?? [],
      }));
      useAnalysisStore.setState({
        energyDemands:
          mappedDemands.length > 0 ? mappedDemands : useAnalysisStore.getState().energyDemands,
      });

      // ΔTmin
      if (currentAnalysisData.t_min !== tMin) {
        setTMin(currentAnalysisData.t_min);
      }

      lastSyncedJsonRef.current = psJson;
    }
  }, [projectState, tMin, setTMin]);

  // Sync BACK from UI → Project (only on local changes)
  useEffect(() => {
    const localData = {
      selected_streams: selectedStreams,
      energy_demands: energyDemands,
      t_min: tMin,
    };
    const localJson = JSON.stringify(localData);

    if (localJson !== lastSyncedJsonRef.current) {
      setAnalysisSelection(selectedStreams);
      setAnalysisDemands(energyDemands);
      setAnalysisTMin(tMin);
      lastSyncedJsonRef.current = localJson;
    }
  }, [
    selectedStreams,
    energyDemands,
    tMin,
    setAnalysisSelection,
    setAnalysisDemands,
    setAnalysisTMin,
  ]);

  const handleSaveProject = useCallback(() => {
    const blob = new Blob([JSON.stringify(projectState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heattransplan_state_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectState]);

  const handleLoadProject = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          setState({ ...data, map_locked: true });
        } catch (err) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
      if (fileRef.current) fileRef.current.value = '';
    },
    [setState]
  );

  // Helper to extract valid streams from a selection object
  const getStreamsFromSelection = useCallback(
    (selection: Record<string, boolean>) => {
      const result: Array<{
        name: string;
        CP: number;
        Tin: number;
        Tout: number;
        Q: number;
        type: 'Hot' | 'Cold';
      }> = [];
      for (const [key, selected] of Object.entries(selection)) {
        if (!selected || !key.startsWith('stream_')) continue;
        const parts = key.split('_');
        const pIdx = parseInt(parts[1], 10);
        const sIdx = parseInt(parts[2], 10);
        if (pIdx >= processes.length) continue;
        const proc = processes[pIdx];
        const streams = proc.streams ?? [];
        if (sIdx >= streams.length) continue;
        const stream = streams[sIdx];
        const info = getStreamInfo(stream);
        if (info.tin !== null && info.tout !== null && info.CP !== null) {
          const procName = proc.name || `Subprocess ${pIdx + 1}`;
          const streamName = stream.name || `Stream ${sIdx + 1}`;
          result.push({
            name: `${procName} - ${streamName}`,
            CP: info.CP,
            Tin: info.tin,
            Tout: info.tout,
            Q: info.Q ?? 0,
            type: info.tin > info.tout ? 'Hot' : 'Cold',
          });
        }
      }
      return result;
    },
    [processes]
  );

  // Extract valid streams for pinch analysis
  const streamsData = useMemo(
    () => getStreamsFromSelection(selectedStreams),
    [getStreamsFromSelection, selectedStreams]
  );

  // Auto-run pinch analysis when streams/tMin change
  useEffect(() => {
    if (streamsData.length < 2) {
      setPinchResult(null);
      setHPIResult(null);
      setHPIOptimizationResult(null);
      setStatusQuoResult(null);
      setPinchError(null);
      return;
    }
    let cancelled = false;

    const run = async () => {
      setPinchLoading(true);
      setPinchError(null);
      try {
        const pinchStreams: PinchStream[] = streamsData.map((s: any) => ({
          name: s.name,
          CP: s.CP,
          T_supply: s.Tin,
          T_target: s.Tout,
        }));
        const result = await runPinch({ streams: pinchStreams, T_min: tMin });
        if (!cancelled) {
          setPinchResult(result);
          // Auto-run HPI
          runHPIAnalysis(result);
          // Auto-run HPI Optimization
          runHPIOptimizationAnalysis(result);
          // Run status-quo if demands exist
          runStatusQuoAnalysis(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Pinch analysis failed';
          setPinchError(msg);
          setPinchResult(null);
        }
      } finally {
        if (!cancelled) setPinchLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamsData, tMin]);

  // Always open the page on the standard setting. The store lives above the
  // router, so without this a mode picked earlier would still be active after
  // navigating away and back.
  useEffect(() => {
    setProfileMode('net_load');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run both integrations when the heat recovery mode changes.
  // The pinch result itself is unaffected, so it is not recomputed.
  const firstProfileModeRun = useRef(true);
  useEffect(() => {
    if (firstProfileModeRun.current) {
      firstProfileModeRun.current = false;
      return;
    }
    if (!pinchResult) return;
    // The optimisation re-runs below: every mode change also changes the share.
    runHPIAnalysis(pinchResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileMode]);

  // Applying, editing or removing a custom formula, or moving the heat recovery
  // share, re-runs the optimisation without touching anything else.
  useEffect(() => {
    if (!pinchResult) return;
    runHPIOptimizationAnalysis(pinchResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copFormula, copModel, recoveryPct]);

  // Run HPI analysis
  const runHPIAnalysis = useCallback(
    async (pinch: typeof pinchResult) => {
      if (!pinch) return;
      setHPILoading(true);
      setHPIError(null);
      try {
        const result = await runHPI({
          pinch_result: pinch,
          hp_types: DEFAULT_HP_TYPES,
          profile_mode: profileMode,
        });
        setHPIResult(result);
        // Auto-select first available HP if current selection is invalid or empty
        const currentSelection = useAnalysisStore.getState().selectedHPTypes;
        const availableNames = result.heat_pumps
          .filter((hp: any) => hp.available)
          .map((hp: any) => hp.name);
        const validSelection = currentSelection.filter((name) => availableNames.includes(name));

        if (validSelection.length === 0 && availableNames.length > 0) {
          setSelectedHPTypes([availableNames[0]]);
        } else if (validSelection.length !== currentSelection.length) {
          setSelectedHPTypes(validSelection);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'HPI analysis failed';
        setHPIError(msg);
        setHPIResult(null);
      } finally {
        setHPILoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHPTypes, profileMode]
  );

  // Run HPI Optimization analysis
  const runHPIOptimizationAnalysis = useCallback(
    async (pinch: typeof pinchResult) => {
      if (!pinch) return;
      setHPIOptimizationLoading(true);
      try {
        const result = await runHPIOptimization({
          pinch_result: pinch,
          profile_mode: profileMode,
          cop_formula: copFormula,
          cop_model: copModel,
          recovery_pct: recoveryPct,
          lang: i18n.language,
        });
        setHPIOptimizationResult(result);
      } catch (err: unknown) {
        console.error('HPI Optimization failed:', err);
        setHPIOptimizationResult(null);
      } finally {
        setHPIOptimizationLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileMode, copFormula, copModel, recoveryPct, i18n.language]
  );

  // Run status-quo analysis
  const runStatusQuoAnalysis = useCallback(
    async (pinch: typeof pinchResult) => {
      if (!pinch) return;
      const hasDemands = energyDemands.some((d) => d.heat_demand > 0 || d.cooling_demand > 0);
      if (!hasDemands) {
        setStatusQuoResult(null);
        return;
      }
      try {
        const demands = energyDemands.map((d) => ({
          stream_name: '',
          heating_kW: d.heat_demand,
          cooling_kW: d.cooling_demand,
        }));
        const result = await runStatusQuo({
          current_demands: demands,
          pinch_hot_utility: pinch.hot_utility,
          pinch_cold_utility: pinch.cold_utility,
        });
        setStatusQuoResult(result);
      } catch {
        setStatusQuoResult(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [energyDemands]
  );

  // Re-run status-quo when energy demands change
  useEffect(() => {
    if (pinchResult) runStatusQuoAnalysis(pinchResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [energyDemands, pinchResult]);

  // Helper to build payload for report and map preview
  const buildReportPayload = useCallback(() => {
    return {
      language: i18n.language || 'en',
      project_notes: projectState.project_notes || '',
      pinch_notes: projectState.pinch_notes || '',
      map_snapshots_encoded: projectState.map_snapshots_encoded || {},
      map_center: projectState.map_center || [],
      map_zoom: projectState.map_zoom || 17.5,
      current_base: projectState.current_base || 'OpenStreetMap',
      processes: projectState.processes.map((p) => ({
        name: p.name || '',
        streams: p.streams || [],
      })),
      proc_groups: projectState.proc_groups || [],
      proc_group_names: projectState.proc_group_names || [],
      proc_group_coordinates: projectState.proc_group_coordinates || {},
      selected_streams: streamsData,
      pinch_result: pinchResult,
      heat_pumps: hpiResult?.heat_pumps || [],
      hpi_optimization_result: hpiOptimizationResult,
      energy_demands: energyDemands,
      t_min: tMin,
      // Include all saved scenarios in the report for comparison
      scenarios: (useAnalysisStore.getState().scenarios || []).map((sc) => ({
        name: sc.name,
        selected_streams: getStreamsFromSelection(sc.selectedStreams),
        pinch_result: sc.pinchResult,
        heat_pumps: sc.hpiResult?.heat_pumps || [],
        hpi_optimization_result: sc.hpiOptimizationResult || null,
        // Whatever was clicked on the optimization chart, so the report shows
        // that pump instead of the default one.
        selected_hp_points: sc.selectedHPPoints || [],
        energy_demands:
          sc.energyDemands?.map((d) => ({
            heat_demand: d.heat_demand,
            cooling_demand: d.cooling_demand,
          })) || [],
        t_min: sc.tMin,
        // The economic analysis of this scenario's pump, with the inputs from
        // the Economic analysis section, translated and formatted here.
        economics: econReportData(
          t,
          useAnalysisStore.getState().econForm,
          useAnalysisStore.getState().econRefType,
          sc.selectedHPPoints || [],
          sc.hpiOptimizationResult
        ),
      })),
    };
  }, [
    projectState,
    streamsData,
    pinchResult,
    hpiResult,
    hpiOptimizationResult,
    energyDemands,
    tMin,
    getStreamsFromSelection,
    t,
  ]);

  // Handle report generation
  const handleGenerateReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const payload = buildReportPayload();
      const blob = await generateReport(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'heat_integration_report.html';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report generation failed:', err);
      alert('Report generation failed. Check console for details.');
    } finally {
      setReportLoading(false);
    }
  }, [buildReportPayload]);

  const scenarios = useAnalysisStore((s) => s.scenarios);
  const activeScenarioId = useAnalysisStore((s) => s.activeScenarioId);
  const saveScenario = useAnalysisStore((s) => s.saveScenario);
  const loadScenario = useAnalysisStore((s) => s.loadScenario);
  const deleteScenario = useAnalysisStore((s) => s.deleteScenario);
  const renameScenario = useAnalysisStore((s) => s.renameScenario);
  const setStreamsForProcess = useAnalysisStore((s) => s.setStreamsForProcess);
  const toggleStreamSelection = useAnalysisStore((s) => s.toggleStreamSelection);

  const [scenarioName, setScenarioName] = useState('');
  const [editingScenarioIdx, setEditingScenarioIdx] = useState<number | null>(null);
  const [selectionActive] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const isMobile = useIsMobile();

  // Auto-calculated default scenario name
  const defaultScenarioName = t('ui.scenario_default', { n: scenarios.length + 1 });

  const handleSaveScenario = () => {
    saveScenario(scenarioName.trim() || defaultScenarioName);
    setScenarioName('');
  };

  const handleRenameScenario = (idx: number, newName: string) => {
    if (!newName.trim()) return;
    renameScenario(idx, newName.trim());
    setEditingScenarioIdx(null);
  };

  const handleMapProcessesSelect = useCallback(
    (pIdxs: number[], val: boolean) => {
      pIdxs.forEach((pIdx) => setStreamsForProcess(pIdx, val, processes));
    },
    [setStreamsForProcess, processes]
  );

  const handleMapSelectionToggle = useCallback(
    (pIdx: number, si: number) => {
      toggleStreamSelection(pIdx, si);
    },
    [toggleStreamSelection]
  );

  const selectedCount = Object.values(selectedStreams).filter(Boolean).length;

  return (
    <div className="pa-page">
      <div className="pa-header-row">
        <h1 className="pa-title">{t('analysis.title')}</h1>

        {/* Scenarios - Inline */}
        <div className="pa-scenario-bar">
          <div className="pa-scenario-pills">
            {scenarios.map((scen: any, idx: number) => {
              const isActive = scen.id === activeScenarioId;
              return (
                <div
                  key={scen.id || idx}
                  className={`pa-scenario-pill ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isActive ? 'var(--primary)' : 'var(--bg)',
                    color: isActive ? 'var(--text-on-primary)' : 'var(--text-main)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--primary-hover)' : 'var(--border)',
                    padding: '3px 10px',
                    borderRadius: '16px',
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  {editingScenarioIdx === idx ? (
                    <input
                      autoFocus
                      defaultValue={scen.name}
                      onBlur={(e) => handleRenameScenario(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameScenario(idx, e.currentTarget.value);
                        if (e.key === 'Escape') setEditingScenarioIdx(null);
                      }}
                      style={{
                        border: 'none',
                        background: 'var(--bg)',
                        padding: '0 4px',
                        fontSize: 'inherit',
                        width: '80px',
                        color: 'var(--text-main)',
                      }}
                    />
                  ) : (
                    <span
                      style={{ cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => loadScenario(idx)}
                      onDoubleClick={() => setEditingScenarioIdx(idx)}
                      title={t('ui.scenario_hint')}
                    >
                      {scen.name}
                    </span>
                  )}
                  <button
                    className="pa-scenario-delete"
                    aria-label={`Delete ${scen.name}`}
                    onClick={() => deleteScenario(idx)}
                    style={{ color: isActive ? '#bfdbfe' : '#94a3b8' }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pa-scenario-save">
            <input
              type="text"
              className="pa-scenario-input"
              placeholder={t('analysis.placeholders.scenario_name')}
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveScenario()}
            />
            <button className="pa-scenario-save-btn" onClick={handleSaveScenario}>
              {t('analysis.buttons.save')}
            </button>
          </div>
        </div>

        <div className="pa-header-actions">
          <button className="btn btn-sm" onClick={handleSaveProject} title={t('ui.save_json')}>
            <Save size={14} /> {t('analysis.buttons.save')}
          </button>
          <label className="btn btn-sm" style={{ cursor: 'pointer' }} title={t('ui.load_json')}>
            <FolderOpen size={14} /> {t('analysis.buttons.load')}
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleLoadProject}
              style={{ display: 'none' }}
            />
          </label>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          <button
            className="pa-btn-report"
            disabled={reportLoading}
            onClick={handleGenerateReport}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            {reportLoading ? (
              <>
                <LoaderCircle size={14} className="pa-spin" /> {t('analysis.buttons.generating')}
              </>
            ) : (
              <>
                <FileText size={14} /> {t('analysis.buttons.report')}
              </>
            )}
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          <button
            className={`btn btn-sm icon-btn ${showHelp ? 'btn-primary' : ''}`}
            onClick={() => setShowHelp(!showHelp)}
            title={t('ui.toggle_guide')}
          >
            <BookOpen size={16} />
          </button>
        </div>
      </div>

      <Part
        n={1}
        title={t('analysis.parts.integration')}
        input={t('analysis.parts.integration_in')}
      >
        {/* Top row: Streams | Energy Demands | Map */}
        <div className="pa-top-row">
          <div className="pa-top-col pa-col-streams">
            <StreamSelector />
          </div>
          <div className="pa-top-col pa-col-demands">
            <EnergyDemands />
          </div>
          <div className="pa-top-col pa-col-map" style={{ position: 'relative' }}>
            <AnalysisHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
            <MapViewer
              key="pa-mini-map"
              height={isMobile ? 'clamp(260px, 45vh, 400px)' : '420px'}
              center={
                projectState.map_center?.length === 2
                  ? (projectState.map_center as [number, number])
                  : [51.707937580921694, 8.772205607882668]
              }
              zoom={Math.max(1, (projectState.map_zoom || 17) - 1.5)}
              locked={true}
              processes={projectState.processes}
              groups={projectState.proc_groups || []}
              groupNames={projectState.proc_group_names || []}
              groupCoordinates={projectState.proc_group_coordinates || {}}
              baseTile={projectState.current_base || 'OpenStreetMap'}
              sitePlan={projectState.site_plan}
              onClick={() => {}}
              onMoveEnd={() => {}}
              subprocessMapExpanded={{}}
              childMapExpanded={{}}
              // Selection API
              selectionActive={selectionActive}
              selectedStreams={selectedStreams}
              onProcessesSelect={handleMapProcessesSelect}
              onSelectionToggle={handleMapSelectionToggle}
            />
          </div>
        </div>

        {processes.length === 0 ? (
          <div className="pa-info-box">{t('analysis.messages.no_processes')}</div>
        ) : streamsData.length < 2 ? (
          <div className="pa-info-box">
            {t('analysis.messages.need_more_streams')}
            {selectedCount > 0 && (
              <div className="pa-data-status">
                <strong>{t('ui.data_status')}</strong>
                {Object.entries(selectedStreams)
                  .filter(([, v]) => v)
                  .map(([key]) => {
                    if (!key.startsWith('stream_')) return null;
                    const parts = key.split('_');
                    const pIdx = parseInt(parts[1], 10);
                    const sIdx = parseInt(parts[2], 10);
                    if (pIdx >= processes.length) return null;
                    const proc = processes[pIdx];
                    const streams = proc.streams ?? [];
                    if (sIdx >= streams.length) return null;
                    const stream = streams[sIdx];
                    const info = getStreamInfo(stream);
                    const procName = proc.name || `Subprocess ${pIdx + 1}`;
                    const streamName = stream.name || `Stream ${sIdx + 1}`;
                    const missing: string[] = [];
                    if (info.tin === null) missing.push('Tin');
                    if (info.tout === null) missing.push('Tout');
                    if (info.CP === null) {
                      if (info.mdot === null) missing.push('ṁ');
                      if (info.cp === null) missing.push('cp');
                      missing.push('(or CP)');
                    }
                    return (
                      <div key={key} className={missing.length > 0 ? 'pa-missing' : 'pa-complete'}>
                        {missing.length > 0 ? (
                          <>
                            <TriangleAlert size={14} /> {procName} - {streamName}: {t('ui.missing')}{' '}
                            {missing.join(', ')}
                          </>
                        ) : (
                          <>
                            <CircleCheck size={14} /> {procName} - {streamName}:{' '}
                            {t('ui.complete_data')}
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          <>
            {pinchLoading && <div className="pa-loading">{t('analysis.messages.running')}</div>}
            {pinchError && (
              <div className="pa-error">
                {t('analysis.messages.error')} {pinchError}
              </div>
            )}

            {pinchResult && (
              <>
                {/* Pinch analysis: status quo, controls, metrics, curves, summary */}
                <Section
                  title={
                    <h3 className="pa-section-title" style={{ flex: 1 }}>
                      {t('analysis.sections.pinch')}
                      <ResetButton
                        hint={t('analysis.controls.reset_pinch_hint')}
                        onClick={() => {
                          setTMin(10);
                          setProfileMode('net_load');
                          setShowShifted(true);
                          setExplain(true);
                        }}
                      />
                    </h3>
                  }
                >
                  <StatusQuoComparison />

                  {/* Controls row: toggle + ΔTmin + metrics */}
                  <div className="pa-controls-row">
                    <label className="pa-toggle-label">
                      <input
                        type="checkbox"
                        checked={showShifted}
                        onChange={(e) => setShowShifted(e.target.checked)}
                      />
                      {t('analysis.controls.show_shifted')}
                    </label>
                    <label className="pa-toggle-label">
                      <input
                        type="checkbox"
                        checked={explain}
                        onChange={(e) => setExplain(e.target.checked)}
                      />
                      {t('analysis.controls.show_explanations')}
                    </label>

                    <label className="pa-input-label pa-tmin-label">
                      ΔTmin
                      <input
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        value={tMin}
                        onChange={(e) => setTMin(parseFloat(e.target.value) || 10)}
                        className="pa-number-input pa-tmin-input"
                      />
                    </label>
                  </div>

                  <PinchMetrics />

                  {/* With or without heat recovery: the right plot below and the
                      heat pump integration in part 2 follow it. */}
                  <HeatRecoveryToggle />

                  {/* Composite curves and GCC as one figure on one temperature axis */}
                  <PinchCurvesChart />
                  <PinchSummary />
                </Section>
              </>
            )}
          </>
        )}
      </Part>

      {pinchResult && streamsData.length >= 2 && (
        <>
          <Part
            n={2}
            title={t('analysis.parts.heat_pump')}
            input={t('analysis.parts.heat_pump_in')}
            actions={
              <>
                <ChartHelpButton
                  inline
                  title={t('analysis.charts.hpi_title')}
                  description={t('optimization.desc_hp_simulates')}
                />
                <ResetButton
                  hint={t('analysis.controls.reset_hpi_hint')}
                  onClick={() => {
                    const s = useAnalysisStore.getState();
                    s.setCopModel('2t');
                    s.setCopFormula(null);
                    s.setSelectedHPPoints([]);
                    // Remounts the panel, so its filters and sorting start over.
                    setHpiReset((n) => n + 1);
                  }}
                />
              </>
            }
          >
            {/* Heat Integration Analysis Optimization */}
            <HPIOptimizationPanel key={hpiReset} />
            <HPISummary />
          </Part>

          {/* Renders its own Part, since its banner carries the reset button. */}
          <EconomicAnalysis />

          <Section title={<h3 className="pa-section-title">{t('analysis.sections.notes')}</h3>}>
            <textarea
              className="pa-notes-textarea"
              value={pinchNotes ?? ''}
              onChange={(e) => setPinchNotes(e.target.value)}
              placeholder={t('analysis.placeholders.notes')}
              rows={4}
            />
          </Section>

          {/* More information */}
          <details
            className="pa-details pa-more-info"
            open={moreInfoOpen}
            onToggle={(e) => setMoreInfoOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary>{t('analysis.more_info')}</summary>
            <TemperatureIntervalDiagram />
            <CopCoverageChart />
          </details>

          {/* Scenario Comparison View */}
          {scenarios.length >= 2 && (
            <Section
              title={<h3 className="pa-section-title">{t('analysis.sections.scenarios')}</h3>}
            >
              <ScenarioComparison />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

/** The reset button at the right of a section heading; a button, so it does not fold the section. */
function ResetButton({ hint, onClick }: { hint: string; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="econ-reset" onClick={onClick} title={hint}>
      <RotateCcw size={13} /> {t('economics.reset')}
    </button>
  );
}
