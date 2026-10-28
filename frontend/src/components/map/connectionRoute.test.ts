/** Process flow arrows run edge to edge, never hidden under a box. */

import { describe, it, expect } from 'vitest';
import { routeConnection } from './connectionRoute';

const box = { w: 50, h: 15 };

describe('routeConnection', () => {
  it('leaves the source edge and ends with the arrow tip at the target edge', () => {
    const r = routeConnection({ x: 0, y: 0 }, { x: 300, y: 40 }, box, box)!;
    expect(r.horizontal).toBe(true);
    expect(r.start).toEqual({ x: 50, y: 0 });
    expect(r.arrow).toEqual({ x: 300 - 50 - 12, y: 40 });
    // The turn lies between the two boxes, not under either.
    expect(r.mid1.x).toBeGreaterThan(50);
    expect(r.mid1.x).toBeLessThan(238);
    expect(r.angle).toBe(0);
  });

  it('goes over or under when wide boxes leave no room beside each other', () => {
    // Centres 100 px apart sideways, but two 400 px wide boxes overlap there.
    const wide = { w: 200, h: 15 };
    const r = routeConnection({ x: 0, y: 200 }, { x: 100, y: 0 }, wide, wide)!;
    expect(r.horizontal).toBe(false);
    expect(r.start).toEqual({ x: 0, y: 185 });
    expect(r.arrow).toEqual({ x: 100, y: 15 + 12 });
    expect(r.angle).toBe(-90);
  });

  it('draws nothing when the boxes touch', () => {
    expect(routeConnection({ x: 0, y: 0 }, { x: 60, y: 20 }, box, box)).toBeNull();
  });
});
