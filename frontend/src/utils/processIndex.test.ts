import { describe, it, expect } from 'vitest';
import { orphanProcesses, removeProcesses } from './processIndex';
import type { ProcessNode } from '../types/process';

const procs = ['a', 'b', 'c', 'd'].map((name) => ({ name }) as ProcessNode);

describe('removeProcesses', () => {
  it('drops the node and shifts later group members and selection keys', () => {
    const next = removeProcesses([1], procs, [[0, 1], [2, 3]], {
      stream_0_0: true,
      stream_1_0: true,
      stream_2_0: false,
      stream_3_1_0: true,
    });
    expect(next.processes.map((p) => p.name)).toEqual(['a', 'c', 'd']);
    expect(next.groups).toEqual([[0], [1, 2]]);
    expect(next.selection).toEqual({
      stream_0_0: true,
      stream_1_0: false,
      stream_2_1_0: true,
    });
  });

  it('handles a whole group at once', () => {
    const next = removeProcesses([0, 1], procs, [[2, 3]], {});
    expect(next.groups).toEqual([[0, 1]]);
    expect(next.processes.map((p) => p.name)).toEqual(['c', 'd']);
  });
});

describe('orphanProcesses', () => {
  it('finds processes no group claims', () => {
    expect(orphanProcesses(procs, [[0, 2]])).toEqual([1, 3]);
    expect(orphanProcesses(procs, [[0, 1], [2, 3]])).toEqual([]);
  });
});

describe('deleting a subprocess with saved scenarios', () => {
  it('moves the selections of every scenario, not only the active one', async () => {
    const { useAnalysisStore } = await import('../store/analysisStore');
    type Scenario = ReturnType<typeof useAnalysisStore.getState>['scenarios'][number];
    const scenario = (id: string, selectedStreams: Record<string, boolean>): Scenario => ({
      id,
      name: id,
      selectedStreams,
      energyDemands: [],
      selectedHPPoints: [],
      tMin: 10,
    });

    useAnalysisStore.setState({
      selectedStreams: { stream_0_0: true, stream_2_0: false },
      activeScenarioId: 'active',
      scenarios: [
        scenario('active', { stream_0_0: true, stream_2_0: false }),
        // A scenario saved earlier, with subprocess 2's stream switched on.
        scenario('saved', { stream_1_0: false, stream_2_0: true }),
      ],
    });

    // Subprocess 1 is deleted; subprocess 2 becomes subprocess 1.
    useAnalysisStore.getState().removeProcessesFromSelections([1]);

    const s = useAnalysisStore.getState();
    expect(s.selectedStreams).toEqual({ stream_0_0: true, stream_1_0: false });
    expect(s.scenarios[0].selectedStreams).toEqual({ stream_0_0: true, stream_1_0: false });
    // Before, this one kept stream_2_0: pointing past the end, or at whatever
    // subprocess moved into position 2.
    expect(s.scenarios[1].selectedStreams).toEqual({ stream_1_0: true });
  });
});
