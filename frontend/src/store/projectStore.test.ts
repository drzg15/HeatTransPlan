import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './projectStore';
import type { ProcessNode } from '../types/process';

describe('useProjectStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useProjectStore.getState().resetState();
  });

  it('should initialize with default state', () => {
    const state = useProjectStore.getState().state;
    expect(state.map_locked).toBe(false);
    expect(state.processes).toEqual([]);
    expect(state.proc_groups).toEqual([]);
  });

  it('should update map center and zoom', () => {
    const store = useProjectStore.getState();
    store.setMapCenter([48.8566, 2.3522]);
    store.setMapZoom(12);

    const newState = useProjectStore.getState().state;
    expect(newState.map_center).toEqual([48.8566, 2.3522]);
    expect(newState.map_zoom).toBe(12);
  });

  it('should add and update processes', () => {
    const store = useProjectStore.getState();
    const mockProcess: ProcessNode = { name: 'Test Process', level: 1 };

    store.setProcesses([mockProcess]);

    const processes = useProjectStore.getState().state.processes;
    expect(processes).toHaveLength(1);
    expect(processes[0].name).toBe('Test Process');

    // Update
    const updatedProcess = { ...mockProcess, name: 'Updated Process' };
    useProjectStore.getState().updateProcess(0, updatedProcess);

    expect(useProjectStore.getState().state.processes[0].name).toBe('Updated Process');
  });

  it('should reset state completely', () => {
    const store = useProjectStore.getState();
    store.setMapLocked(true);
    store.setProcesses([{ name: 'Test', level: 1 }]);

    expect(useProjectStore.getState().state.map_locked).toBe(true);

    useProjectStore.getState().resetState();

    const resetState = useProjectStore.getState().state;
    expect(resetState.map_locked).toBe(false);
    expect(resetState.processes).toEqual([]);
  });
});
