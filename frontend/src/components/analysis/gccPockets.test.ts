import { describe, it, expect } from 'vitest';
import { gccPockets } from './gccPockets';

describe('gccPockets', () => {
  it('finds no pocket on a curve that only moves away from the pinch', () => {
    const p = gccPockets([60, 30, 0, 10, 20], [20, 50, 80, 110, 140], 80);
    expect(p.heat).toBe(0);
    expect(p.x).toHaveLength(0);
  });

  it('closes a pocket above and one below the pinch with a vertical line', () => {
    // Above the pinch (80 °C): out to 40 at 110 °C, back to 20 at 130 °C,
    // then on to 50 at the top. The vertical at H = 20 closes it at 95 °C.
    // Below: out to 30 at 60 °C, back to 10 at 50 °C, on to 40 at 20 °C.
    const H = [40, 10, 30, 0, 40, 20, 50];
    const T = [20, 50, 60, 80, 110, 130, 150];
    const p = gccPockets(H, T, 80);
    expect(p.heat).toBeCloseTo(20 + 20);
    // Two polygons, each ending in a null separator.
    expect(p.x.filter((v) => v === null)).toHaveLength(2);
    // The upper pocket starts where the curve crosses H = 20, at 95 °C.
    const upper = p.y.slice(0, p.y.indexOf(null));
    expect(Math.min(...(upper as number[]))).toBeCloseTo(95);
  });
});
