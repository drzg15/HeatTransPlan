/** Pins the optimization chart's Plotly input (every trace, shape and
 *  annotation) and what a click on a point selects. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import i18n from '../../i18n';
import { useUIStore } from '../../store/uiStore';
import type { HPIOptimizationResult, OptimizedIntegrationPoint } from '../../types/analysis';
import fixture from '../../test/fixtures/optimization.json';
import { dump } from '../../test/dump';
import HPIOptimizationChart from './HPIOptimizationChart';

const plots: Array<{ data: unknown; layout: unknown; onClick?: (e: unknown) => void }> = [];
vi.mock('react-plotly.js', () => ({
  default: (props: { data: unknown; layout: unknown; onClick?: (e: unknown) => void }) => {
    plots.push(props);
    return <div data-testid="plot" />;
  },
}));

const opt = fixture.optimization as unknown as HPIOptimizationResult;
const pts = opt.feasible_points;

function draw(
  opts: {
    selected?: OptimizedIntegrationPoint[];
    mode?: string;
    theme?: 'light' | 'dark';
    onSelect?: (p: OptimizedIntegrationPoint[]) => void;
  } = {}
) {
  plots.length = 0;
  useUIStore.setState({ theme: opts.theme ?? 'light' });
  render(
    <HPIOptimizationChart
      originalGCC={opt.original_gcc}
      pocketlessSource={opt.pocketless_source}
      pocketlessSink={opt.pocketless_sink}
      heatCascade={fixture.pinch.heat_cascade}
      feasiblePoints={pts}
      maxQPoint={opt.max_q_point ?? null}
      selectedPoints={opts.selected ?? []}
      onSelectPoints={opts.onSelect ?? (() => {})}
      pinchTemperature={fixture.pinch.pinch_temperature}
      profileMode={opts.mode ?? 'net_load'}
    />
  );
  const last = plots[plots.length - 1];
  return { spec: dump({ data: last.data, layout: last.layout }), plot: last };
}

beforeEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('HPIOptimizationChart', () => {
  it('draws the same', () => {
    expect(draw().spec).toMatchSnapshot();
  });
  it('draws a selection the same', () => {
    expect(draw({ selected: [pts[10], pts[40], pts[41]] }).spec).toMatchSnapshot();
  });
  it('draws the composite mode the same', () => {
    expect(draw({ mode: 'composite' }).spec).toMatchSnapshot();
  });
  it('draws dark the same', () => {
    expect(draw({ theme: 'dark', selected: [pts[3]] }).spec).toMatchSnapshot();
  });
  it('draws German the same', async () => {
    await act(() => i18n.changeLanguage('de'));
    expect(draw().spec).toMatchSnapshot();
  });
  it('selects the same on a click', () => {
    let picked: OptimizedIntegrationPoint[] = [];
    const { plot } = draw({ onSelect: (p) => (picked = p) });
    const data = plot.data as Array<{ customdata?: OptimizedIntegrationPoint[] }>;
    const target = data.find((tr) => tr.customdata?.length)!.customdata![0];
    plot.onClick!({ points: [{ customdata: target }] });
    const add = picked.map((p) => `${p.refrigerant}@${p.T_sink}`);
    const { plot: again } = draw({ selected: picked, onSelect: (p) => (picked = p) });
    again.onClick!({ points: [{ customdata: target }] });
    expect({ add, remove: picked.length }).toMatchSnapshot();
  });
});
