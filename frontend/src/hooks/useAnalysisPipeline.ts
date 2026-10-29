/** The Potential Analysis pipeline: the selected streams, then pinch, heat
 *  pump integration, optimisation and status quo, each re-run when one of its
 *  inputs changes. Results go to the analysis store; the page draws them. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { runHPI, runHPIOptimization, runPinch, runStatusQuo } from '../api/analysis';
import { useAnalysisStore } from '../store/analysisStore';
import { useProjectStore } from '../store/projectStore';
import type { PinchStream } from '../types/analysis';
import { getStreamInfo } from '../utils/streamUtils';

const DEFAULT_HP_TYPES = [
  'Prototypical Stirling',
  'VHTHP (HFC/HFO)',
  'SHP and HTHPs (HFC/HFO)',
  'SHP and HTHPs (R717)',
  'Carnot',
];

export function useAnalysisPipeline() {
  const { i18n } = useTranslation();
  const processes = useProjectStore((s) => s.state.processes);
  const selectedStreams = useAnalysisStore((s) => s.selectedStreams);
  const tMin = useAnalysisStore((s) => s.tMin);
  const profileMode = useAnalysisStore((s) => s.profileMode);
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
  const energyDemands = useAnalysisStore((s) => s.energyDemands);
  const copFormula = useAnalysisStore((s) => s.copFormula);
  const customCopModel = useAnalysisStore((s) => s.customCopModel);
  const copModel = useAnalysisStore((s) => s.copModel);

  const [pinchError, setPinchError] = useState<string | null>(null);
  const [, setHPIError] = useState<string | null>(null);

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
  }, [copFormula, customCopModel, copModel, recoveryPct]);

  // The newest request of each kind. The server answers them in parallel, so an
  // older one can come back last; only the newest may change the page.
  const latest = useRef({ hpi: 0, opt: 0 });

  // Run HPI analysis
  const runHPIAnalysis = useCallback(
    async (pinch: typeof pinchResult) => {
      if (!pinch) return;
      const run = ++latest.current.hpi;
      setHPILoading(true);
      setHPIError(null);
      try {
        const result = await runHPI({
          pinch_result: pinch,
          hp_types: DEFAULT_HP_TYPES,
          profile_mode: profileMode,
        });
        if (run !== latest.current.hpi) return;
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
        if (run !== latest.current.hpi) return;
        const msg = err instanceof Error ? err.message : 'HPI analysis failed';
        setHPIError(msg);
        setHPIResult(null);
      } finally {
        if (run === latest.current.hpi) setHPILoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHPTypes, profileMode]
  );

  // Run HPI Optimization analysis
  const runHPIOptimizationAnalysis = useCallback(
    async (pinch: typeof pinchResult) => {
      if (!pinch) return;
      const run = ++latest.current.opt;
      setHPIOptimizationLoading(true);
      try {
        const result = await runHPIOptimization({
          pinch_result: pinch,
          profile_mode: profileMode,
          cop_formula: copFormula,
          custom_cop_model: customCopModel,
          cop_model: copModel,
          recovery_pct: recoveryPct,
          lang: i18n.language,
        });
        if (run === latest.current.opt) setHPIOptimizationResult(result);
      } catch (err: unknown) {
        console.error('HPI Optimization failed:', err);
        if (run === latest.current.opt) setHPIOptimizationResult(null);
      } finally {
        if (run === latest.current.opt) setHPIOptimizationLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileMode, copFormula, customCopModel, copModel, recoveryPct, i18n.language]
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

  return { streamsData, pinchError, getStreamsFromSelection };
}
