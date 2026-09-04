import { create } from 'zustand';

interface UIStore {
  // Theme
  theme: 'light' | 'dark';

  // Sidebar
  sidebarCollapsed: boolean;
  activePage: 'home' | 'data-collection' | 'analysis';

  // Map modes
  placementMode: boolean;
  measureMode: boolean;

  // Data collection expansion states
  expandedGroups: Set<number>;
  expandedSubprocesses: Set<number>; // subIdx
  activeSections: Record<number, string>; // subIdx -> "streams", "notes", etc.

  // Loading / errors
  loading: boolean;
  error: string | null;

  // Analysis tab
  analysisTab: string;

  // Actions
  toggleTheme: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setActivePage: (page: UIStore['activePage']) => void;
  setPlacementMode: (v: boolean) => void;
  setMeasureMode: (v: boolean) => void;

  toggleGroupExpanded: (idx: number) => void;
  setGroupsExpanded: (idxs: Set<number>) => void;

  toggleSubprocessExpanded: (idx: number) => void;
  setSubprocessExpanded: (idx: number, expanded: boolean) => void;

  setActiveSection: (subIdx: number, section: string) => void;

  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setAnalysisTab: (tab: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: 'light',
  sidebarCollapsed: false,
  activePage: 'home',
  placementMode: false,
  measureMode: false,
  expandedGroups: new Set(),
  expandedSubprocesses: new Set(),
  activeSections: {},
  loading: false,
  error: null,
  analysisTab: 'pinch',

  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActivePage: (page) => set({ activePage: page }),
  setPlacementMode: (v) => set({ placementMode: v, measureMode: false }),
  setMeasureMode: (v) => set({ measureMode: v, placementMode: false }),

  toggleGroupExpanded: (idx) =>
    set((s) => {
      const next = new Set(s.expandedGroups);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return { expandedGroups: next };
    }),
  setGroupsExpanded: (idxs) => set({ expandedGroups: idxs }),

  toggleSubprocessExpanded: (idx) =>
    set((s) => {
      const next = new Set(s.expandedSubprocesses);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return { expandedSubprocesses: next };
    }),
  setSubprocessExpanded: (idx, expanded) =>
    set((s) => {
      const next = new Set(s.expandedSubprocesses);
      if (expanded) next.add(idx);
      else next.delete(idx);
      return { expandedSubprocesses: next };
    }),

  setActiveSection: (subIdx, section) =>
    set((s) => ({
      activeSections: { ...s.activeSections, [subIdx]: section },
    })),

  setLoading: (v) => set({ loading: v }),
  setError: (msg) => set({ error: msg }),
  setAnalysisTab: (tab) => set({ analysisTab: tab }),
}));
