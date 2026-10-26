import { describe, it, expect } from 'vitest';
import { summaryPoints } from './SectionSummaries';
import type { OptimizedIntegrationPoint } from '../../types/analysis';

const pt = (refrigerant: string, T_sink: number) =>
  ({ refrigerant, T_source: 50, T_sink }) as OptimizedIntegrationPoint;

describe('summaryPoints', () => {
  const best = pt('R1234ze', 120);

  it('shows only the best pump when nothing is selected', () => {
    expect(summaryPoints([], best)).toEqual([{ p: best, role: 'best' }]);
  });

  it('shows the last selected pump, then the best', () => {
    const a = pt('R600', 100);
    const b = pt('R601', 110);
    expect(summaryPoints([a, b], best)).toEqual([
      { p: b, role: 'selected' },
      { p: best, role: 'best' },
    ]);
  });

  it('shows the pump once when the last selected is the best', () => {
    expect(summaryPoints([pt('R1234ze', 120)], best)).toHaveLength(1);
  });
});
