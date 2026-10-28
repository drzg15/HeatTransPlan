/** The AI's commands change the page exactly as its controls do. */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalysisStore } from '../store/analysisStore';
import { useProjectStore } from '../store/projectStore';
import type { HPIOptimizationResult } from '../types/analysis';
import type { ProjectState } from '../types/project';
import example from '../../../backend/app/data/examples/heat_integration_example_1.json';
import fixture from '../test/fixtures/optimization.json';
import { runCommand } from './commands';

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
  });
});

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
