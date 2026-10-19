import { beforeEach, describe, expect, it } from 'vitest';
import { useAnalysisStore } from './analysisStore';
import { useProjectStore } from './projectStore';
import { DEFAULT_HP_FILTERS } from '../components/analysis/hpRules';
import type { HPIOptimizationResult, OptimizedIntegrationPoint } from '../types/analysis';

const point = (
  refrigerant: string,
  T_sink: number,
  extra: Partial<OptimizedIntegrationPoint> = {}
) =>
  ({
    refrigerant,
    refrigerant_type: 'Natural',
    medium_sink: 'Water',
    hp_level: '1',
    T_source: 48,
    T_sink,
    Q_demand: 100,
    COP: 3,
    ...extra,
  }) as OptimizedIntegrationPoint;

const result = (points: OptimizedIntegrationPoint[]) =>
  ({ feasible_points: points, max_q_point: points[0] ?? null }) as HPIOptimizationResult;

describe('picks and filters across results', () => {
  beforeEach(() =>
    useAnalysisStore.setState({
      selectedHPPoints: [],
      hpFilters: DEFAULT_HP_FILTERS,
      hpiOptimizationResult: null,
      scenarios: [],
      activeScenarioId: null,
    })
  );

  it('keeps a pick that is still in the new result and drops one that is not', () => {
    const s = useAnalysisStore.getState();
    s.setSelectedHPPoints([point('Butane_1', 99), point('Pentane_1', 110)]);
    s.setHPIOptimizationResult(result([point('Butane_1', 99), point('Propane_1', 90)]));
    expect(useAnalysisStore.getState().selectedHPPoints.map((p) => p.refrigerant)).toEqual([
      'Butane_1',
    ]);
  });

  it('keeps the picks while a result is being recalculated', () => {
    const s = useAnalysisStore.getState();
    s.setSelectedHPPoints([point('Butane_1', 99)]);
    s.setHPIOptimizationResult(null);
    expect(useAnalysisStore.getState().selectedHPPoints).toHaveLength(1);
  });

  it('drops a filter value the new result no longer offers', () => {
    const s = useAnalysisStore.getState();
    s.setHPFilters({ refrigerants: ['Butane', 'Pentane'], medium_sink: 'Steam' });
    s.setHPIOptimizationResult(result([point('Butane_2', 99)]));
    const f = useAnalysisStore.getState().hpFilters;
    expect(f.refrigerants).toEqual(['Butane']);
    expect(f.medium_sink).toBe('All');
  });

  it('a filter change drops only the picks it hides', () => {
    const s = useAnalysisStore.getState();
    s.setSelectedHPPoints([
      point('Butane_1', 99),
      point('R1224yd_1', 99, { refrigerant_type: 'Synthetic' }),
    ]);
    s.setHPFilters({ refrigerant_type: 'Natural' });
    expect(useAnalysisStore.getState().selectedHPPoints.map((p) => p.refrigerant)).toEqual([
      'Butane_1',
    ]);
  });

  it('a scenario brings back its own pick and filters', () => {
    const s = useAnalysisStore.getState();
    s.setSelectedHPPoints([point('Butane_1', 99)]);
    s.setHPFilters({ hp_levels: ['1'] });
    s.saveScenario('A');
    // The active scenario follows live edits, so switch to B before changing them.
    s.saveScenario('B');
    s.setSelectedHPPoints([]);
    s.setHPFilters({ hp_levels: [] });
    expect(useAnalysisStore.getState().scenarios[1].hpFilters?.hp_levels).toEqual([]);

    s.loadScenario(0);
    const st = useAnalysisStore.getState();
    expect(st.selectedHPPoints.map((p) => p.refrigerant)).toEqual(['Butane_1']);
    expect(st.hpFilters.hp_levels).toEqual(['1']);
  });
});

describe('scenarios belong to the project', () => {
  beforeEach(() => {
    useProjectStore.getState().resetState();
    useAnalysisStore.setState({ selectedHPPoints: [], hpFilters: DEFAULT_HP_FILTERS });
  });

  it('a saved scenario reaches the project, so Save writes it', () => {
    useAnalysisStore.getState().saveScenario('A');
    const saved = useProjectStore.getState().state.analysis_scenarios;
    expect(saved?.scenarios.map((s) => s.name)).toEqual(['A']);
    expect(saved?.active_id).toBe(useAnalysisStore.getState().activeScenarioId);
  });

  it('loading a project brings its scenarios; one without any clears them', () => {
    useAnalysisStore.getState().saveScenario('old');
    const project = useProjectStore.getState().state;
    const loaded = {
      scenarios: [{ ...project.analysis_scenarios!.scenarios[0], name: 'B' }],
      active_id: null,
    };

    useProjectStore.getState().setState({ ...project, analysis_scenarios: loaded });
    expect(useAnalysisStore.getState().scenarios.map((s) => s.name)).toEqual(['B']);
    expect(useAnalysisStore.getState().activeScenarioId).toBeNull();

    useProjectStore.getState().setState({ ...project, analysis_scenarios: undefined });
    expect(useAnalysisStore.getState().scenarios).toEqual([]);
  });

  it('reset clears them', () => {
    useAnalysisStore.getState().saveScenario('A');
    useProjectStore.getState().resetState();
    expect(useAnalysisStore.getState().scenarios).toEqual([]);
    expect(useAnalysisStore.getState().activeScenarioId).toBeNull();
  });

  it('they are never written to localStorage, which they would overflow', () => {
    useAnalysisStore.getState().saveScenario('A');
    const entry = JSON.parse(localStorage.getItem('heattransplan-storage') ?? '{}');
    expect(entry.state.state.analysis_scenarios).toBeUndefined();
  });
});
