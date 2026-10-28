/** What the page shows, as a compact summary an AI can read: where it is,
 *  every input, and the key results. Full results via get_results. */

import i18n from '../i18n';
import { useAnalysisStore } from '../store/analysisStore';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import type { OptimizedIntegrationPoint } from '../types/analysis';

/** Set by the router bridge, so the view knows the page. */
let currentPage = '/';
export const setCurrentPage = (path: string) => {
  currentPage = path;
};

const pump = (p: OptimizedIntegrationPoint | null | undefined) =>
  p && {
    refrigerant: p.refrigerant,
    theoretical: Boolean(p.theoretical),
    T_source: p.T_source,
    T_sink: p.T_sink,
    Q_sink_kW: p.Q_demand,
    Q_source_kW: p.Q_source,
    COP: p.COP,
    source_limited: p.source_limited,
    demand_limited: p.demand_limited,
  };

export function buildView() {
  const a = useAnalysisStore.getState();
  const proj = useProjectStore.getState().state;
  const opt = a.hpiOptimizationResult;
  return {
    page: currentPage,
    language: i18n.language,
    theme: useUIStore.getState().theme,
    project: {
      groups: proj.proc_group_names.map((name, gi) => ({
        index: gi,
        name,
        subprocesses: (proj.proc_groups[gi] ?? []).map((pi) => ({
          index: pi,
          name: proj.processes[pi]?.name,
          streams: (proj.processes[pi]?.streams ?? []).map((s, si) => ({
            key: `stream_${pi}_${si}`,
            name: s.name,
            type: s.type,
          })),
        })),
      })),
      has_site_plan: Boolean(proj.site_plan),
      subprocess_plans: Object.keys(proj.canvas_plans ?? {}),
    },
    analysis: {
      selected_streams: Object.keys(a.selectedStreams).filter((k) => a.selectedStreams[k]),
      t_min: a.tMin,
      show_shifted: a.showShifted,
      recovery_pct: a.recoveryPct,
      profile_mode: a.profileMode,
      energy_demands: a.energyDemands,
      cop_model: a.copModel,
      cop_formula: a.copFormula,
      custom_cop_model: a.customCopModel && {
        name: a.customCopModel.name,
        enabled: a.customCopModel.enabled,
        metrics: a.customCopModel.metrics,
      },
      hp_types: a.selectedHPTypes,
      running: a.pinchLoading || a.hpiLoading || a.hpiOptimizationLoading,
    },
    results: {
      pinch: a.pinchResult && {
        pinch_temperature: a.pinchResult.pinch_temperature,
        min_heating_kW: a.pinchResult.hot_utility,
        min_cooling_kW: a.pinchResult.cold_utility,
      },
      heat_pumps: a.hpiResult?.heat_pumps.map((h) => ({
        name: h.name,
        cop: h.cop,
        t_source: h.t_source,
        t_sink: h.t_sink,
        q_sink: h.q_sink,
      })),
      optimization: opt && {
        feasible_points: opt.feasible_points.length,
        best: pump(opt.max_q_point),
        messages: opt.diagnostics?.messages ?? [],
      },
      selected_heat_pumps: a.selectedHPPoints.map(pump),
      status_quo: a.statusQuoResult,
    },
    economics: { form: a.econForm, ref_type: a.econRefType },
    scenarios: a.scenarios.map((s, index) => ({
      index,
      name: s.name,
      active: s.id === a.activeScenarioId,
    })),
  };
}
