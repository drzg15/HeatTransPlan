/** Pins what the optimization panel renders, and what it hands the chart, for
 *  real backend output and every control on it. A refactoring that changes a
 *  row, a label, a filter or the chart's input fails here. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act, cleanup, within } from '@testing-library/react';
import i18n from '../../i18n';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUIStore } from '../../store/uiStore';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import fixture from '../../test/fixtures/optimization.json';
import HPIOptimizationPanel from './HPIOptimizationPanel';

/** Count plus a short hash: the full list would repeat in every snapshot. */
function fingerprint(items: string[]): string {
  let h = 5381;
  for (const c of items.join('|')) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return `${items.length}:${h.toString(16)}`;
}

// Plotly does not run in jsdom. The stand-in prints what the chart was given
// and offers a click that selects points, as a click on the real chart does.
vi.mock('./HPIOptimizationChart', () => ({
  default: (props: {
    feasiblePoints: OptimizedIntegrationPoint[];
    maxQPoint: OptimizedIntegrationPoint | null;
    selectedPoints: OptimizedIntegrationPoint[];
    onSelectPoints: (p: OptimizedIntegrationPoint[]) => void;
    pinchTemperature: number;
    profileMode: string;
  }) => (
    <div data-testid="chart">
      {JSON.stringify({
        points: fingerprint(props.feasiblePoints.map((p) => `${p.refrigerant}@${p.T_sink}`)),
        maxQ: props.maxQPoint && `${props.maxQPoint.refrigerant}@${props.maxQPoint.T_sink}`,
        selected: props.selectedPoints.map((p) => `${p.refrigerant}@${p.T_sink}`),
        pinch: props.pinchTemperature,
        mode: props.profileMode,
      })}
      <button
        data-testid="chart-pick"
        onClick={() => props.onSelectPoints(props.feasiblePoints.slice(3, 5))}
      />
    </div>
  ),
}));

const result = fixture.optimization as unknown as Parameters<
  ReturnType<typeof useAnalysisStore.getState>['setHPIOptimizationResult']
>[0];

function setup(theme: 'light' | 'dark' = 'light', res = result) {
  useUIStore.setState({ theme });
  useAnalysisStore.setState({
    pinchResult: fixture.pinch as never,
    hpiOptimizationResult: res,
    tMin: 10,
    selectedHPPoints: [],
    copFormula: null,
    copModel: '2t',
  });
  return render(<HPIOptimizationPanel />);
}

beforeEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('HPIOptimizationPanel', () => {
  it('renders the same for every control', async () => {
    const view = setup();
    const snap = () => view.container.innerHTML;
    const steps: Record<string, string> = { initial: snap() };

    const headers = view.container.querySelectorAll('thead th');
    headers.forEach((th, i) => {
      fireEvent.click(th);
      steps[`sort_${i}`] = snap();
    });
    fireEvent.click(headers[3]);
    fireEvent.click(headers[3]);
    steps.sort_cop_twice = snap();

    const selects = view.container.querySelectorAll('select');
    fireEvent.change(selects[0], {
      target: { value: (selects[0] as HTMLSelectElement).options[1].value },
    });
    steps.medium_filter = snap();
    fireEvent.change(selects[0], { target: { value: 'All' } });
    fireEvent.change(selects[1], {
      target: { value: (selects[1] as HTMLSelectElement).options[1].value },
    });
    steps.type_filter = snap();
    fireEvent.change(selects[1], { target: { value: 'All' } });

    // The two multi-select dropdowns: open, tick the first entry, close.
    const dropdownLabels = [
      'optimization.panel.filters.refrigerant',
      'optimization.panel.filters.hp_stages',
    ];
    for (const key of dropdownLabels) {
      const label = within(view.container)
        .getAllByText(i18n.t(key))
        .find((el) => el.tagName === 'LABEL')!;
      const toggle = label.nextElementSibling as HTMLElement;
      fireEvent.click(toggle);
      steps[`${key}_open`] = snap();
      const box = label.parentElement!.querySelector('input[type=checkbox]') as HTMLInputElement;
      fireEvent.click(box);
      steps[`${key}_ticked`] = snap();
      fireEvent.click(box);
      fireEvent.mouseDown(document.body);
      steps[`${key}_closed`] = snap();
    }

    const boxes = () =>
      Array.from(
        view.container.querySelectorAll('.pa-opt-filters > div > label input[type=checkbox]')
      );
    boxes().forEach((b, i) => {
      fireEvent.click(b);
      steps[`checkbox_${i}`] = snap();
    });

    fireEvent.click(
      within(view.container).getByText(i18n.t('optimization.panel.filters.select_all'))
    );
    steps.select_all = snap();
    fireEvent.click(within(view.container).getByText(i18n.t('optimization.panel.filters.clear')));
    steps.clear = snap();

    fireEvent.click(within(view.container).getByTestId('chart-pick'));
    steps.chart_pick = snap();

    const copModel = view.container.querySelector('select[title]') as HTMLSelectElement;
    fireEvent.change(copModel, { target: { value: '4t' } });
    steps.cop_model = `${useAnalysisStore.getState().copModel}\n${snap()}`;

    fireEvent.click(view.container.querySelector('.cf-trigger')!);
    steps.formula_modal = snap();

    for (const [name, html] of Object.entries(steps)) {
      expect(html).toMatchSnapshot(name);
    }
  });

  it('renders the dark theme the same', () => {
    expect(setup('dark').container.innerHTML).toMatchSnapshot();
  });

  it('renders German the same', async () => {
    await act(() => i18n.changeLanguage('de'));
    expect(setup().container.innerHTML).toMatchSnapshot();
  });

  it('explains an empty result the same', () => {
    const empty = { ...result, feasible_points: [], max_q_point: null } as typeof result;
    expect(setup('light', empty).container.innerHTML).toMatchSnapshot();
  });
});
