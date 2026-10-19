import { getStreamInfo } from '../../utils/streamUtils';
import type {
  EnergyDemandLocal,
  HPIOptimizationResult,
  HPIResult,
  PinchResult,
} from '../../types/analysis';
import type { ProcessNode } from '../../types/process';
import type { ProjectState } from '../../types/project';
import { useAnalysisStore } from '../../store/analysisStore';
import { DEFAULT_HP_FILTERS } from '../../components/analysis/hpRules';

export interface SelectedStream {
  name: string;
  CP: number;
  Tin: number;
  Tout: number;
  Q: number;
  type: 'Hot' | 'Cold';
}

/** Extract the streams with complete data from a selection object. */
export function streamsFromSelection(
  selection: Record<string, boolean>,
  processes: ProcessNode[]
): SelectedStream[] {
  const result: SelectedStream[] = [];
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
}

/** An energy demand as the project file may carry it: the current field names or the older ones. */
interface StoredEnergyDemand {
  heat_demand?: number;
  heating_kW?: number;
  cooling_demand?: number;
  cooling_kW?: number;
  selected_heat_streams?: string[];
  selected_cooling_streams?: string[];
}

/** Normalize stored energy demands for compatibility. */
export function normalizeEnergyDemands(demands: StoredEnergyDemand[]): EnergyDemandLocal[] {
  return demands.map((d) => ({
    heat_demand: d.heat_demand ?? d.heating_kW ?? 0,
    cooling_demand: d.cooling_demand ?? d.cooling_kW ?? 0,
    selected_heat_streams: d.selected_heat_streams ?? [],
    selected_cooling_streams: d.selected_cooling_streams ?? [],
  }));
}

interface ReportInput {
  language: string;
  projectState: ProjectState;
  streamsData: SelectedStream[];
  pinchResult: PinchResult | null;
  hpiResult: HPIResult | null;
  hpiOptimizationResult: HPIOptimizationResult | null;
  energyDemands: EnergyDemandLocal[];
  tMin: number;
  getStreamsFromSelection: (selection: Record<string, boolean>) => SelectedStream[];
}

/** The payload for the report and the map preview. */
export function buildReportPayload({
  language,
  projectState,
  streamsData,
  pinchResult,
  hpiResult,
  hpiOptimizationResult,
  energyDemands,
  tMin,
  getStreamsFromSelection,
}: ReportInput) {
  return {
    language,
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
      hp_filters: sc.hpFilters ?? DEFAULT_HP_FILTERS,
      energy_demands:
        sc.energyDemands?.map((d) => ({
          heat_demand: d.heat_demand,
          cooling_demand: d.cooling_demand,
        })) || [],
      t_min: sc.tMin,
    })),
  };
}
