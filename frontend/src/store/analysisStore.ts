/** Zustand store for Potential Analysis page state. */

import { create } from 'zustand';
import type {
  CopFormulaSpec,
  EnergyDemandLocal,
  HPIOptimizationResult,
  HPIResult,
  PinchResult,
  ProfileMode,
  StatusQuoResult,
} from '../types/analysis';
import { newId } from '../utils/id';

interface AnalysisStore {
  // Stream selection: "stream_{procIdx}_{streamIdx}" → boolean
  selectedStreams: Record<string, boolean>;

  // Energy demands (user-entered)
  energyDemands: EnergyDemandLocal[];

  // Pinch controls
  tMin: number;
  showShifted: boolean;

  // How much heat recovery the heat pump integration credits
  profileMode: ProfileMode;
  /** User-supplied COP correlation, evaluated alongside the trained model.
   *  null means "model only", which is the default. */
  copFormula: CopFormulaSpec | null;

  // Results from backend
  pinchResult: PinchResult | null;
  hpiResult: HPIResult | null;
  hpiOptimizationResult: HPIOptimizationResult | null;
  statusQuoResult: StatusQuoResult | null;

  // Heat pump selection for chart
  selectedHPTypes: string[];

  // Loading states
  pinchLoading: boolean;
  hpiLoading: boolean;
  hpiOptimizationLoading: boolean;

  // Scenarios: Array of saved states
  scenarios: Array<{
    id: string;
    name: string;
    selectedStreams: Record<string, boolean>;
    energyDemands: EnergyDemandLocal[];
    tMin: number;
    // Results for comparison
    pinchResult?: PinchResult | null;
    hpiResult?: HPIResult | null;
    hpiOptimizationResult?: HPIOptimizationResult | null;
    statusQuoResult?: StatusQuoResult | null;
  }>;
  activeScenarioId: string | null;

  // Actions
  setSelectedStream: (key: string, val: boolean) => void;
  setSelectedStreams: (streams: Record<string, boolean>) => void;
  setStreamsForProcess: (pIdx: number, val: boolean, processes: any[]) => void;
  toggleStreamSelection: (pIdx: number, sIdx: number) => void;
  initSelectedStreams: (keys: string[]) => void;
  setEnergyDemands: (demands: EnergyDemandLocal[]) => void;
  addEnergyDemand: (demand: EnergyDemandLocal) => void;
  removeEnergyDemand: (index: number) => void;
  updateEnergyDemand: (index: number, demand: Partial<EnergyDemandLocal>) => void;
  setTMin: (val: number) => void;
  setShowShifted: (val: boolean) => void;
  setProfileMode: (mode: ProfileMode) => void;
  setCopFormula: (formula: CopFormulaSpec | null) => void;
  setPinchResult: (result: PinchResult | null) => void;
  setHPIResult: (result: HPIResult | null) => void;
  setHPIOptimizationResult: (result: HPIOptimizationResult | null) => void;
  setStatusQuoResult: (result: StatusQuoResult | null) => void;
  setSelectedHPTypes: (types: string[]) => void;
  setPinchLoading: (val: boolean) => void;
  setHPILoading: (val: boolean) => void;
  setHPIOptimizationLoading: (val: boolean) => void;

  saveScenario: (name?: string) => void;
  loadScenario: (index: number) => void;
  deleteScenario: (index: number) => void;
  renameScenario: (index: number, newName: string) => void;
  clearActiveScenario: () => void;
}

// Helper to update the scenario list if an active scenario is set
const syncScenario = (state: AnalysisStore) => {
  if (!state.activeScenarioId) return {};
  return {
    scenarios: state.scenarios.map((sc) =>
      sc.id === state.activeScenarioId
        ? {
            ...sc,
            selectedStreams: { ...state.selectedStreams },
            energyDemands: JSON.parse(JSON.stringify(state.energyDemands)),
            tMin: state.tMin,
            pinchResult: state.pinchResult ? JSON.parse(JSON.stringify(state.pinchResult)) : null,
            hpiResult: state.hpiResult ? JSON.parse(JSON.stringify(state.hpiResult)) : null,
            hpiOptimizationResult: state.hpiOptimizationResult
              ? JSON.parse(JSON.stringify(state.hpiOptimizationResult))
              : null,
            statusQuoResult: state.statusQuoResult
              ? JSON.parse(JSON.stringify(state.statusQuoResult))
              : null,
          }
        : sc
    ),
  };
};

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  selectedStreams: {},
  energyDemands: [
    {
      heat_demand: 0,
      cooling_demand: 0,
      selected_heat_streams: [],
      selected_cooling_streams: [],
    },
  ],
  tMin: 10,
  showShifted: false,
  profileMode: 'net_load',
  copFormula: null,
  pinchResult: null,
  hpiResult: null,
  hpiOptimizationResult: null,
  statusQuoResult: null,
  selectedHPTypes: [],
  pinchLoading: false,
  hpiLoading: false,
  hpiOptimizationLoading: false,
  scenarios: [],
  activeScenarioId: null,

  setSelectedStream: (key, val) => {
    set((s) => ({ selectedStreams: { ...s.selectedStreams, [key]: val } }));
    set((s) => syncScenario(s));
  },

  setSelectedStreams: (streams) => {
    set({ selectedStreams: streams });
    set((s) => syncScenario(s));
  },

  setStreamsForProcess: (pIdx, val, processes) => {
    set((s) => {
      const next = { ...s.selectedStreams };
      const proc = processes[pIdx];
      if (proc) {
        (proc.streams || []).forEach((_: any, si: number) => {
          next[`stream_${pIdx}_${si}`] = val;
        });
      }
      return { selectedStreams: next };
    });
    set((s) => syncScenario(s));
  },

  toggleStreamSelection: (pIdx, sIdx) => {
    set((s) => {
      const key = `stream_${pIdx}_${sIdx}`;
      const current = s.selectedStreams[key] !== false;
      return { selectedStreams: { ...s.selectedStreams, [key]: !current } };
    });
    set((s) => syncScenario(s));
  },

  initSelectedStreams: (keys) =>
    set(() => {
      const streams: Record<string, boolean> = {};
      keys.forEach((k) => (streams[k] = true));
      return { selectedStreams: streams };
    }),

  setEnergyDemands: (demands) => {
    set({ energyDemands: demands });
    set((s) => syncScenario(s));
  },

  addEnergyDemand: (demand) => {
    set((s) => ({ energyDemands: [...s.energyDemands, demand] }));
    set((s) => syncScenario(s));
  },

  removeEnergyDemand: (index) => {
    set((s) => ({
      energyDemands: s.energyDemands.filter((_, i) => i !== index),
    }));
    set((s) => syncScenario(s));
  },

  updateEnergyDemand: (index, demand) => {
    set((s) => ({
      energyDemands: s.energyDemands.map((d, i) => (i === index ? { ...d, ...demand } : d)),
    }));
    set((s) => syncScenario(s));
  },

  setTMin: (val) => {
    set({ tMin: val });
    set((s) => syncScenario(s));
  },

  setShowShifted: (val) => set({ showShifted: val }),
  setProfileMode: (mode) => set({ profileMode: mode }),
  setCopFormula: (formula) => set({ copFormula: formula }),

  setPinchResult: (result) => {
    set((s) => {
      const newState: any = { pinchResult: result };

      // Auto-save "All streams" if it's the first time we get a result and no scenarios exist
      if (result && s.scenarios.length === 0 && !s.activeScenarioId) {
        const newScen = {
          id: newId(),
          name: 'All streams',
          selectedStreams: { ...s.selectedStreams },
          energyDemands: JSON.parse(JSON.stringify(s.energyDemands)),
          tMin: s.tMin,
          pinchResult: JSON.parse(JSON.stringify(result)),
          hpiResult: null,
          hpiOptimizationResult: null,
          statusQuoResult: null,
        };
        newState.scenarios = [newScen];
        newState.activeScenarioId = newScen.id;
      }

      return newState;
    });
    set((s) => syncScenario(s));
  },

  setHPIResult: (result) => {
    set({ hpiResult: result });
    set((s) => syncScenario(s));
  },

  setHPIOptimizationResult: (result) => {
    set({ hpiOptimizationResult: result });
    set((s) => syncScenario(s));
  },

  setStatusQuoResult: (result) => {
    set({ statusQuoResult: result });
    set((s) => syncScenario(s));
  },

  setSelectedHPTypes: (types) => set({ selectedHPTypes: types }),
  setPinchLoading: (val) => set({ pinchLoading: val }),
  setHPILoading: (val) => set({ hpiLoading: val }),
  setHPIOptimizationLoading: (val) => set({ hpiOptimizationLoading: val }),

  saveScenario: (name) =>
    set((s) => {
      const nextIndex = s.scenarios.length + 1;
      const finalName = name?.trim() || `Scenario ${nextIndex}`;
      const newScen = {
        id: newId(),
        name: finalName,
        selectedStreams: { ...s.selectedStreams },
        energyDemands: JSON.parse(JSON.stringify(s.energyDemands)),
        tMin: s.tMin,
        pinchResult: s.pinchResult ? JSON.parse(JSON.stringify(s.pinchResult)) : null,
        hpiResult: s.hpiResult ? JSON.parse(JSON.stringify(s.hpiResult)) : null,
        hpiOptimizationResult: s.hpiOptimizationResult
          ? JSON.parse(JSON.stringify(s.hpiOptimizationResult))
          : null,
        statusQuoResult: s.statusQuoResult ? JSON.parse(JSON.stringify(s.statusQuoResult)) : null,
      };
      return {
        scenarios: [...s.scenarios, newScen],
        activeScenarioId: newScen.id,
      };
    }),

  loadScenario: (index) =>
    set((s) => {
      const sc = s.scenarios[index];
      if (!sc) return {};
      return {
        activeScenarioId: sc.id,
        selectedStreams: { ...sc.selectedStreams },
        energyDemands: JSON.parse(JSON.stringify(sc.energyDemands)),
        tMin: sc.tMin,
        pinchResult: sc.pinchResult ? JSON.parse(JSON.stringify(sc.pinchResult)) : null,
        hpiResult: sc.hpiResult ? JSON.parse(JSON.stringify(sc.hpiResult)) : null,
        hpiOptimizationResult: sc.hpiOptimizationResult
          ? JSON.parse(JSON.stringify(sc.hpiOptimizationResult))
          : null,
        statusQuoResult: sc.statusQuoResult ? JSON.parse(JSON.stringify(sc.statusQuoResult)) : null,
      };
    }),

  deleteScenario: (index) =>
    set((s) => {
      const sc = s.scenarios[index];
      const isActive = sc && sc.id === s.activeScenarioId;
      return {
        scenarios: s.scenarios.filter((_, i) => i !== index),
        activeScenarioId: isActive ? null : s.activeScenarioId,
      };
    }),

  renameScenario: (index, newName) =>
    set((s) => ({
      scenarios: s.scenarios.map((sc, i) => (i === index ? { ...sc, name: newName } : sc)),
    })),

  clearActiveScenario: () => set({ activeScenarioId: null }),
}));
