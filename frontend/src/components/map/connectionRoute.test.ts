/** Process flow arrows run edge to edge, never hidden under a box. */

import { describe, it, expect } from 'vitest';
import { labelSpot, onCanvas, routeConnection } from './connectionRoute';

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

describe('labelSpot', () => {
  const p1 = { x: 0, y: 0 };
  it('sits just above the bend when the gap holds it', () => {
    const p2 = { x: 400, y: 40 };
    const r = routeConnection(p1, p2, box, box)!;
    // Gap from 50 to 338: a 100 px label fits.
    expect(labelSpot(r, p1, p2, box, box, 100, 30)).toEqual({ x: r.mid1.x - 50, y: -6 - 30 });
  });

  it('moves above both boxes when the gap is too narrow, so no box hides it', () => {
    const p2 = { x: 200, y: 40 };
    const r = routeConnection(p1, p2, box, box)!;
    // Gap from 50 to 138: a 160 px label does not fit; box tops are at -15 and 25.
    expect(labelSpot(r, p1, p2, box, box, 160, 30)).toEqual({ x: r.mid1.x - 80, y: -15 - 6 - 30 });
  });
});

describe('onCanvas', () => {
  const size = { x: 1000, y: 600 };
  it('leaves a box that is on the canvas where it is', () => {
    expect(onCanvas({ x: 500, y: 300 }, size, box)).toEqual({ x: 500, y: 300 });
  });

  it('brings a box from outside to just inside the edge', () => {
    // Canvas from 50 to 950 across, 30 to 570 down; the box needs 50 / 15 px plus 4.
    const q = onCanvas({ x: 1200, y: -40 }, size, box);
    expect(q.x).toBeCloseTo(950 - 54);
    expect(q.y).toBeCloseTo(30 + 19);
  });
});
