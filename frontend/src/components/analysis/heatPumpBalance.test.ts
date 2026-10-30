import { describe, expect, it } from 'vitest';
import { balance, profileAt } from './heatPumpBalance';

describe('profileAt', () => {
  const p = { T: [50, 60, 80], H: [0, 100, 300] };
  it('interpolates and holds the ends, as numpy interp does', () => {
    expect(profileAt(p, 55)).toBe(50);
    expect(profileAt(p, 70)).toBe(200);
    expect(profileAt(p, 40)).toBe(0);
    expect(profileAt(p, 90)).toBe(300);
    expect(profileAt({ T: [], H: [] }, 60)).toBeNull();
  });
});

describe('balance', () => {
  it("Example 1's default pump sits on both profiles", () => {
    // 375 kW at COP 4.75 needs 296.05 kW of waste heat.
    const b = balance(375, 4.75, 296.0)!;
    expect(b.needed).toBeCloseTo(296.05, 2);
    expect(b.pEl).toBeCloseTo(78.95, 2);
    expect(b.state).toBe('balanced');
  });
  it('names the side that runs short', () => {
    const short = balance(375, 4.75, 200)!;
    expect(short.state).toBe('source_limited');
    expect(short.qSinkPossible).toBeCloseTo((200 * 4.75) / 3.75, 6);
    expect(balance(375, 4.75, 400)!.state).toBe('demand_limited');
    expect(balance(375, 0.9, 400)).toBeNull();
  });
});
