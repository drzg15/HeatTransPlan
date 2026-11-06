import { describe, expect, it } from 'vitest';
import { loadProject } from './loadProject';
import { useUIStore } from './uiStore';
import type { ProjectState } from '../types/project';

describe('loadProject', () => {
  it('opens the first process and subprocess, and closes them for an empty case', () => {
    loadProject({ processes: [], proc_groups: [[2, 5]] } as unknown as ProjectState);
    expect([...useUIStore.getState().expandedGroups]).toEqual([0]);
    expect([...useUIStore.getState().expandedSubprocesses]).toEqual([2]);

    loadProject(null);
    expect(useUIStore.getState().expandedGroups.size).toBe(0);
    expect(useUIStore.getState().expandedSubprocesses.size).toBe(0);
  });
});
