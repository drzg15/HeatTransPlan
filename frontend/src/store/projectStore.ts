import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectState } from '../types/project';
import type { ProcessNode } from '../types/process';

interface ProjectStore {
  projectId: string | null;
  state: ProjectState;

  // Actions
  setProjectId: (id: string) => void;
  setState: (state: ProjectState) => void;
  resetState: () => void;
  setProcesses: (processes: ProcessNode[]) => void;
  updateProcess: (idx: number, node: ProcessNode) => void;
  setMapCenter: (center: number[]) => void;
  setMapZoom: (zoom: number) => void;
  setMapLocked: (locked: boolean) => void;
  setCurrentBase: (base: string) => void;
  setProjectNotes: (notes: string) => void;
  setPinchNotes: (notes: string) => void;
  setGroupNames: (names: string[]) => void;
  setGroups: (groups: number[][]) => void;
  setGroupCoordinates: (coords: ProjectState['proc_group_coordinates']) => void;
  setMapSnapshots: (snapshots: Record<string, string>) => void;

  // Potential Analysis
  setAnalysisSelection: (streams: Record<string, boolean>) => void;
  setAnalysisDemands: (demands: any[]) => void;
  setAnalysisTMin: (val: number) => void;
}

const defaultState: ProjectState = {
  timestamp: null,
  map_locked: false,
  map_center: [51.707937580921694, 8.772205607882668],
  map_zoom: 17.5,
  current_base: 'OpenStreetMap',
  processes: [],
  proc_groups: [],
  proc_group_names: [],
  proc_group_expanded: [],
  proc_group_coordinates: {},
  proc_group_info_expanded: [],
  project_notes: '',
  pinch_notes: '',
  map_snapshots_encoded: {},
  selected_streams: {},
  energy_demands: [],
  t_min: 10.0,
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      projectId: null,
      state: { ...defaultState },

      setProjectId: (id) => set({ projectId: id }),
      setState: (state) => set({ state }),
      resetState: () => set({ state: { ...defaultState } }),
      setProcesses: (processes) => set((s) => ({ state: { ...s.state, processes } })),
      updateProcess: (idx, node) =>
        set((s) => {
          const processes = [...s.state.processes];
          processes[idx] = node;
          return { state: { ...s.state, processes } };
        }),
      setMapCenter: (center) => set((s) => ({ state: { ...s.state, map_center: center } })),
      setMapZoom: (zoom) => set((s) => ({ state: { ...s.state, map_zoom: zoom } })),
      setMapLocked: (locked) => set((s) => ({ state: { ...s.state, map_locked: locked } })),
      setCurrentBase: (base) => set((s) => ({ state: { ...s.state, current_base: base } })),
      setProjectNotes: (notes) => set((s) => ({ state: { ...s.state, project_notes: notes } })),
      setPinchNotes: (notes) => set((s) => ({ state: { ...s.state, pinch_notes: notes } })),
      setGroupNames: (names) => set((s) => ({ state: { ...s.state, proc_group_names: names } })),
      setGroups: (groups) => set((s) => ({ state: { ...s.state, proc_groups: groups } })),
      setGroupCoordinates: (coords) =>
        set((s) => ({ state: { ...s.state, proc_group_coordinates: coords } })),
      setMapSnapshots: (snapshots) =>
        set((s) => ({ state: { ...s.state, map_snapshots_encoded: snapshots } })),

      // Potential Analysis
      setAnalysisSelection: (streams) =>
        set((s) => ({ state: { ...s.state, selected_streams: streams } })),
      setAnalysisDemands: (demands) =>
        set((s) => ({ state: { ...s.state, energy_demands: demands } })),
      setAnalysisTMin: (val) => set((s) => ({ state: { ...s.state, t_min: val } })),
    }),
    {
      name: 'heattransplan-storage', // name of the item in the storage (must be unique)
    }
  )
);
