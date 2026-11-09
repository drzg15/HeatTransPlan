import { describe, expect, it } from 'vitest';
import Plotly from 'plotly.js/lib/core';

// Plot.ts registers the trace types the app draws on this core bundle.
import './Plot';

const P = Plotly as unknown as {
  newPlot: (el: HTMLElement, data: object[]) => Promise<{ _fullData: { type: string }[] }>;
  validate: (data: object[], layout: object) => unknown[] | undefined;
};

describe('the partial Plotly bundle', () => {
  it('knows every trace type the charts use, and no others', () => {
    const traces = [
      { type: 'scatter', x: [1], y: [1] },
      { type: 'bar', x: [1], y: [1] },
      { type: 'heatmap', z: [[1]] },
    ];
    for (const trace of traces) expect(P.validate([trace], {}) ?? []).toEqual([]);
    expect(P.validate([{ type: 'pie', values: [1] }], {})?.length).toBeGreaterThan(0);
  });

  it('draws', async () => {
    // jsdom has no canvas, which heatmaps need; scatter and bar are SVG.
    const div = document.createElement('div');
    document.body.append(div);
    const gd = await P.newPlot(div, [
      { type: 'scatter', x: [1, 2], y: [1, 2] },
      { type: 'bar', x: [1, 2], y: [2, 1] },
    ]);
    expect(gd._fullData.map((t) => t.type)).toEqual(['scatter', 'bar']);
  });
});
