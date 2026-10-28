/** What an AI connected through a live session can do on the page. Each
 *  command does what a button, slider or field on the page does, through the
 *  same store actions. Components register the commands only they can run
 *  (the report, the site plan on the map) while they are on screen. */

import { useEffect, useRef } from 'react';
import i18n from '../i18n';
import { useAnalysisStore } from '../store/analysisStore';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import {
  DEFAULTS as ECON_DEFAULTS,
  PRESETS as ECON_PRESETS,
  type RefType,
} from '../components/analysis/econConfig';
import { distanceCsv, projectCsv } from '../utils/csvExport';
import type {
  CopFormulaSpec,
  CopModel,
  OptimizedIntegrationPoint,
  ProfileMode,
} from '../types/analysis';
import type { ProjectState } from '../types/project';
import type { CustomCopModelSpec } from '../types/copTraining';
import { buildView } from './view';

export type Args = Record<string, unknown>;
export type Handler = (args: Args) => unknown | Promise<unknown>;

const registered = new Map<string, Handler>();

/** Thrown for a command the page cannot run as asked; the AI gets the message. */
export class CommandError extends Error {}

const num = (args: Args, key: string): number => {
  const v = Number(args[key]);
  if (!Number.isFinite(v)) throw new CommandError(`"${key}" must be a number`);
  return v;
};

const analysis = () => useAnalysisStore.getState();
const project = () => useProjectStore.getState();

const idle = () => {
  const s = analysis();
  return !s.pinchLoading && !s.hpiLoading && !s.hpiOptimizationLoading;
};

/** Every stream key of the project, as the selection stores them. */
const allStreamKeys = (state: ProjectState) =>
  state.processes.flatMap((p, pi) => (p.streams ?? []).map((_, si) => `stream_${pi}_${si}`));

/** Find optimization points by refrigerant and sink temperature. */
/** A refrigerant alone: all its points. A T_sink alone: everything at that
 *  sink temperature, as a click on the chart. Both: that one point. */
function findPoints(specs: Array<{ refrigerant?: string; T_sink?: number }>) {
  const opt = analysis().hpiOptimizationResult;
  if (!opt) throw new CommandError('There are no optimization results yet.');
  return specs.flatMap((spec) => {
    if (spec.refrigerant === undefined && spec.T_sink === undefined)
      throw new CommandError('Give a refrigerant, a T_sink or both.');
    const hits = opt.feasible_points.filter(
      (p) =>
        (spec.refrigerant === undefined || p.refrigerant === spec.refrigerant) &&
        (spec.T_sink === undefined || Math.abs(p.T_sink - spec.T_sink) < 0.05)
    );
    if (!hits.length)
      throw new CommandError(
        `No heat pump ${spec.refrigerant ?? ''} at T_sink ${spec.T_sink ?? 'any'}.`
      );
    return spec.refrigerant !== undefined && spec.T_sink !== undefined ? hits.slice(0, 1) : hits;
  });
}

const BUILT_IN: Record<string, Handler> = {
  /** What the page shows right now. */
  get_view: () => buildView(),

  /** Full results, which the view only summarises. */
  get_results: () => {
    const s = analysis();
    return {
      pinch: s.pinchResult,
      hpi: s.hpiResult,
      optimization: s.hpiOptimizationResult,
      status_quo: s.statusQuoResult,
    };
  },

  /** Resolves once no analysis is running (they rerun after most changes). */
  wait_idle: async (args) => {
    const timeout = args.timeout === undefined ? 60_000 : num(args, 'timeout') * 1000;
    const start = Date.now();
    let quietSince = idle() ? Date.now() : 0;
    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, 100));
      if (!idle()) quietSince = 0;
      else if (!quietSince) quietSince = Date.now();
      // Results trigger follow-up runs, so wait for a moment of quiet.
      else if (Date.now() - quietSince >= 400) return buildView();
    }
    throw new CommandError('The analysis is still running.');
  },

  set_language: async (args) => {
    const lang = String(args.lang);
    if (!['en', 'de'].includes(lang)) throw new CommandError('lang must be "en" or "de"');
    await i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
    return { lang };
  },

  set_theme: (args) => {
    const theme = args.theme === 'dark' ? 'dark' : 'light';
    useUIStore.setState({ theme });
    return { theme };
  },

  // ── Project (data collection) ───────────────────────────────────────────
  get_project: () => project().state,
  set_project: (args) => {
    project().setState(args.state as ProjectState);
    return { processes: project().state.processes.length };
  },
  set_project_notes: (args) => {
    project().setProjectNotes(String(args.notes ?? ''));
    return { ok: true };
  },
  set_pinch_notes: (args) => {
    project().setPinchNotes(String(args.notes ?? ''));
    return { ok: true };
  },
  set_map_view: (args) => {
    if (args.center) project().setMapCenter(args.center as number[]);
    if (args.zoom !== undefined) project().setMapZoom(num(args, 'zoom'));
    if (args.bearing !== undefined) project().setMapBearing(num(args, 'bearing'));
    if (args.base) project().setCurrentBase(String(args.base));
    if (args.locked !== undefined) project().setMapLocked(Boolean(args.locked));
    const s = project().state;
    return {
      center: s.map_center,
      zoom: s.map_zoom,
      bearing: s.map_bearing ?? 0,
      base: s.current_base,
      locked: s.map_locked,
    };
  },
  set_site_plan_bounds: (args) => {
    const plan = project().state.site_plan;
    if (!plan) throw new CommandError('There is no site plan.');
    project().setSitePlan({ ...plan, bounds: args.bounds as typeof plan.bounds });
    return { bounds: args.bounds };
  },
  remove_site_plan: () => {
    project().setSitePlan(null);
    return { ok: true };
  },
  remove_subprocess_plan: (args) => {
    const plans = { ...(project().state.canvas_plans ?? {}) };
    delete plans[String(args.key)];
    project().setCanvasPlans(plans);
    return { ok: true };
  },
  export_csv: () => projectCsv(project().state),
  export_distances_csv: (args) =>
    distanceCsv(project().state, args.metric === 'euclidean' ? 'euclidean' : 'manhattan'),

  // ── Potential analysis: inputs ──────────────────────────────────────────
  select_streams: (args) => {
    const state = project().state;
    const keys = allStreamKeys(state);
    const current = analysis().selectedStreams;
    const next: Record<string, boolean> = {};
    const base = args.all === true ? true : args.none === true ? false : null;
    for (const k of keys) next[k] = base ?? current[k] !== false;
    if (args.process !== undefined) {
      const pi = num(args, 'process');
      for (const k of keys) if (k.startsWith(`stream_${pi}_`)) next[k] = args.value !== false;
    }
    for (const k of (args.keys as string[] | undefined) ?? []) {
      if (!keys.includes(k))
        throw new CommandError(`Unknown stream ${k}; keys are ${keys.join(', ')}`);
      next[k] = args.value !== false;
    }
    analysis().setSelectedStreams(next);
    project().setAnalysisSelection(next);
    return { selected: keys.filter((k) => next[k]) };
  },
  set_t_min: (args) => {
    const v = num(args, 'value');
    if (v <= 0) throw new CommandError('ΔTmin must be above 0');
    analysis().setTMin(v);
    project().setAnalysisTMin(v);
    return { t_min: v };
  },
  set_show_shifted: (args) => {
    analysis().setShowShifted(Boolean(args.value));
    return { show_shifted: Boolean(args.value) };
  },
  set_recovery_pct: (args) => {
    const v = Math.min(100, Math.max(0, num(args, 'value')));
    analysis().setRecoveryPct(v);
    return { recovery_pct: v };
  },
  set_profile_mode: (args) => {
    if (args.mode !== 'net_load' && args.mode !== 'composite')
      throw new CommandError('mode must be "net_load" or "composite"');
    analysis().setProfileMode(args.mode as ProfileMode);
    return { mode: args.mode };
  },
  set_energy_demands: (args) => {
    analysis().setEnergyDemands(args.demands as never);
    project().setAnalysisDemands(args.demands as never[]);
    return { demands: analysis().energyDemands };
  },
  reset_pinch: () => {
    // As the reset button of part 1.
    const s = analysis();
    s.setTMin(10);
    project().setAnalysisTMin(10);
    s.setProfileMode('net_load');
    s.setShowShifted(true);
    return { ok: true };
  },

  // ── Heat pumps ──────────────────────────────────────────────────────────
  set_cop_model: (args) => {
    if (args.model !== '2t' && args.model !== '4t')
      throw new CommandError('model must be "2t" or "4t"');
    analysis().setCopModel(args.model as CopModel);
    return { model: args.model };
  },
  set_cop_formula: (args) => {
    analysis().setCopFormula((args.formula as CopFormulaSpec | null) ?? null);
    return { formula: analysis().copFormula };
  },
  /** A COP model trained on the user's data (COP training module): the
   *  model, or null to remove it; `enabled` switches it off and on. */
  set_custom_cop_model: (args) => {
    const s = analysis();
    if (args.model !== undefined)
      s.setCustomCopModel((args.model as CustomCopModelSpec | null) ?? null);
    if (args.enabled !== undefined && s.customCopModel)
      s.setCustomCopModel({ ...s.customCopModel, enabled: Boolean(args.enabled) });
    const m = analysis().customCopModel;
    return m ? { name: m.name, enabled: m.enabled, metrics: m.metrics } : null;
  },
  set_hp_types: (args) => {
    analysis().setSelectedHPTypes(args.types as string[]);
    return { types: analysis().selectedHPTypes };
  },
  select_heat_pumps: (args) => {
    const specs = (args.points as Array<{ refrigerant?: string; T_sink?: number }>) ?? [];
    const picked: OptimizedIntegrationPoint[] = args.clear
      ? []
      : [...(args.add ? analysis().selectedHPPoints : []), ...findPoints(specs)];
    analysis().setSelectedHPPoints(picked);
    return { selected: picked.map((p) => `${p.refrigerant} @ ${p.T_sink.toFixed(1)} °C`) };
  },

  // ── Economics ───────────────────────────────────────────────────────────
  set_economics: (args) => {
    const s = analysis();
    const refType = (args.ref_type as RefType | undefined) ?? s.econRefType;
    if (!['gas', 'oil', 'eboiler'].includes(refType))
      throw new CommandError('ref_type must be "gas", "oil" or "eboiler"');
    const patch = (args.form as Record<string, number> | undefined) ?? {};
    for (const k of Object.keys(patch))
      if (!(k in ECON_DEFAULTS)) throw new CommandError(`Unknown economics input "${k}"`);
    // Picking a heater on the page brings its efficiency, price and CO2 factor.
    const preset = refType !== s.econRefType ? ECON_PRESETS[refType] : {};
    s.setEcon({ ...s.econForm, ...preset, ...patch }, refType);
    return { form: analysis().econForm, ref_type: analysis().econRefType };
  },
  reset_economics: () => {
    analysis().setEcon(ECON_DEFAULTS, 'gas');
    return { ok: true };
  },

  // ── Scenarios ───────────────────────────────────────────────────────────
  save_scenario: (args) => {
    analysis().saveScenario(args.name === undefined ? undefined : String(args.name));
    return { scenarios: analysis().scenarios.map((s) => s.name) };
  },
  load_scenario: (args) => {
    analysis().loadScenario(num(args, 'index'));
    return { active: analysis().activeScenarioId };
  },
  rename_scenario: (args) => {
    analysis().renameScenario(num(args, 'index'), String(args.name));
    return { scenarios: analysis().scenarios.map((s) => s.name) };
  },
  delete_scenario: (args) => {
    analysis().deleteScenario(num(args, 'index'));
    return { scenarios: analysis().scenarios.map((s) => s.name) };
  },
};

/** The commands available right now, with those registered by components. */
export function commandNames(): string[] {
  return [...Object.keys(BUILT_IN), ...registered.keys(), 'list_commands'].sort();
}

export async function runCommand(name: string, args: Args): Promise<unknown> {
  if (name === 'list_commands') return commandNames();
  const handler = registered.get(name) ?? BUILT_IN[name];
  if (!handler) {
    throw new CommandError(
      `"${name}" is not available here. Available now: ${commandNames().join(', ')}. ` +
        'Some commands only exist while their page is open (navigate first).'
    );
  }
  return handler(args ?? {});
}

/** Lets a component offer a command while it is mounted. */
export function useLiveCommand(name: string, handler: Handler) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const run: Handler = (args) => ref.current(args);
    registered.set(name, run);
    return () => {
      if (registered.get(name) === run) registered.delete(name);
    };
  }, [name]);
}
