/** Shared y-range for the Composite Curves and Grand Composite Curve charts.
 *
 *  The two sit side by side in the same row and both carry a dashed pinch line.
 *  Left to themselves, Plotly pads each axis around its own data, so the same
 *  temperature lands at a different height in each chart and the two pinch
 *  lines do not meet. Giving both the combined range fixes them to the same
 *  scale. */

import type { PinchResult } from '../../types/analysis';

export function pairedTempRange(
  pinchResult: PinchResult,
  showShifted: boolean
): [number, number] {
  const diagram = showShifted
    ? pinchResult.shifted_composite_diagram
    : pinchResult.composite_diagram;

  const temps: number[] = [
    ...(diagram?.hot?.T ?? []),
    ...(diagram?.cold?.T ?? []),
    ...(pinchResult.grand_composite_curve?.T ?? []),
  ].filter((v) => Number.isFinite(v));

  if (temps.length === 0) return [0, 1];

  // Both charts use rangemode 'tozero', so the floor stays at zero; only the
  // top needs agreeing on. The 5 % headroom is what Plotly would add anyway.
  const top = Math.max(...temps);
  return [0, top * 1.05];
}
