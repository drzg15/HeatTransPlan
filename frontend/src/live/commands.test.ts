/** The AI's commands change the page exactly as its controls do. */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalysisStore } from '../store/analysisStore';
import { useProjectStore } from '../store/projectStore';
import type { HPIOptimizationResult } from '../types/analysis';
import type { ProjectState } from '../types/project';
import fixture from '../test/fixtures/optimization.json';
import { runCommand, useAiHistory } from './commands';

// The backend's example project. A glob, not an import: the frontend image is
// built from frontend/ alone, where the type check cannot see backend/.
const example = Object.values(
  import.meta.glob('../../../backend/app/data/examples/heat_integration_example_1.json', {
    eager: true,
    import: 'default',
  })
)[0];
const opt = fixture.optimization as unknown as HPIOptimizationResult;

beforeEach(() => {
  useProjectStore.getState().setState(example as unknown as ProjectState);
  useAnalysisStore.setState({
    selectedStreams: {},
    tMin: 10,
    hpiOptimizationResult: opt,
    selectedHPPoints: [],
    pinchLoading: false,
    hpiLoading: false,
    hpiOptimizationLoading: false,
    scenarios: [],
    activeScenarioId: null,
  });
  useAiHistory.setState({ steps: [] });
});

/** A saved scenario, as the page keeps one. */
const scenario = () => useAnalysisStore.getState().saveScenario('Kept');

describe('live commands', () => {
  it('selects streams like the stream table', async () => {
    const r = (await runCommand('select_streams', { all: true })) as { selected: string[] };
    expect(r.selected).toHaveLength(6);
    await runCommand('select_streams', { keys: ['stream_0_0'], value: false });
    expect(useAnalysisStore.getState().selectedStreams.stream_0_0).toBe(false);
    expect(useProjectStore.getState().state.selected_streams?.stream_0_0).toBe(false);
    await expect(runCommand('select_streams', { keys: ['stream_9_9'] })).rejects.toThrow(
      /Unknown stream/
    );
  });

  it('selects by process and by subprocess, and never ticks streams nobody named', async () => {
    useAnalysisStore.setState({ selectedStreams: { stream_0_0: true } });
    const one = (await runCommand('select_streams', { keys: ['stream_2_1'] })) as {
      selected: string[];
    };
    expect(one.selected).toEqual(['stream_0_0', 'stream_2_1']);
    const sub = (await runCommand('select_streams', { none: true, subprocess: 2 })) as {
      selected: string[];
    };
    expect(sub.selected).toEqual(['stream_2_0', 'stream_2_1']);
    const all = (await runCommand('select_streams', { process: 0 })) as { selected: string[] };
    expect(all.selected).toHaveLength(6);
    await expect(runCommand('select_streams', { process: 3 })).rejects.toThrow(
      /no process 3; there are 1/
    );
    await expect(runCommand('select_streams', { keys: 'stream_0_0' })).rejects.toThrow(/list/);
    await expect(runCommand('select_streams', {})).rejects.toThrow(/Say which/);
  });

  it('applies a single step without touching scenarios, and takes it back', async () => {
    scenario();
    const before = useProjectStore.getState().state;
    const names = [...before.proc_group_names, 'Dryer'];
    await runCommand('edit_project', { changes: { proc_group_names: names }, label: 'add Dryer' });
    expect(useProjectStore.getState().state.proc_group_names).toEqual(names);
    expect(useProjectStore.getState().state.processes).toBe(before.processes);
    expect(useAnalysisStore.getState().scenarios.map((s) => s.name)).toEqual(['Kept']);
    await expect(runCommand('edit_project', { changes: { map_center: [0, 0] } })).rejects.toThrow(
      /cannot change map_center/
    );
    expect(await runCommand('undo', {})).toEqual({ undone: 'add Dryer', steps_left: 0 });
    expect(useProjectStore.getState().state.proc_group_names).toEqual(before.proc_group_names);
    await expect(runCommand('undo', {})).rejects.toThrow(/no step/);
  });

  it('loads a whole case in place of the old one, scenarios included', async () => {
    scenario();
    await runCommand('edit_project', { changes: { proc_group_names: ['X'] } });
    const r = await runCommand('set_project', {});
    expect(r).toEqual({ processes: 0, streams: 0 });
    expect(useAnalysisStore.getState().scenarios).toEqual([]);
    expect(useAiHistory.getState().steps).toEqual([]);
  });

  it('sets ΔTmin and the heat recovery share', async () => {
    await runCommand('set_t_min', { value: 15 });
    expect(useAnalysisStore.getState().tMin).toBe(15);
    await runCommand('set_recovery_pct', { value: 140 });
    expect(useAnalysisStore.getState().recoveryPct).toBe(100);
    await expect(runCommand('set_t_min', { value: 'x' })).rejects.toThrow(/number/);
  });

  it('picks heat pumps by refrigerant and sink temperature', async () => {
    const p = opt.feasible_points.find((x) => !x.theoretical)!;
    await runCommand('select_heat_pumps', {
      points: [{ refrigerant: p.refrigerant, T_sink: p.T_sink }],
    });
    expect(useAnalysisStore.getState().selectedHPPoints).toEqual([p]);
    await runCommand('select_heat_pumps', { clear: true });
    expect(useAnalysisStore.getState().selectedHPPoints).toEqual([]);
  });

  it('changes economics inputs and rejects unknown ones', async () => {
    await runCommand('set_economics', { form: { pFuel: 9 }, ref_type: 'oil' });
    expect(useAnalysisStore.getState().econForm.pFuel).toBe(9);
    expect(useAnalysisStore.getState().econRefType).toBe('oil');
    await expect(runCommand('set_economics', { form: { nope: 1 } })).rejects.toThrow(/Unknown/);
  });

  it('reports the view, waits for quiet and explains unknown commands', async () => {
    const view = (await runCommand('wait_idle', { timeout: 2 })) as { analysis: { t_min: number } };
    expect(view.analysis.t_min).toBe(10);
    await expect(runCommand('fly', {})).rejects.toThrow(/not available here/);
    expect(await runCommand('list_commands', {})).toContain('select_streams');
  });

  it('exports the project as CSV text', async () => {
    const csv = (await runCommand('export_csv', {})) as string;
    expect(csv.split('\n').length).toBeGreaterThan(6);
  });
});
