import { formatDe } from '../../utils/numberFormat';
import type { LinkRegion } from '../../store/pinchLinkStore';

type Curve = { H: number[]; T: number[] };

/** The three regions of the composite curves as full-height bands: where hot
 *  and cold overlap is internal heat recovery; where only the hot curve runs
 *  is heat surplus that needs cooling; where only the cold curve runs is heat
 *  deficit that needs heating. The amount is each band's width on the H axis
 *  (recovery and the minimum utilities), so all three read the same way. */
export function regionTraces(
  hot: Curve,
  cold: Curve,
  yRange: [number, number],
  names: { recovery: string; surplus: string; deficit: string }
) {
  if (hot.H.length < 2 || cold.H.length < 2) return [];
  const span = (c: Curve) => [Math.min(...c.H), Math.max(...c.H)];
  const [hotLo, hotHi] = span(hot);
  const [coldLo, coldHi] = span(cold);
  const lo = Math.max(hotLo, coldLo);
  const hi = Math.min(hotHi, coldHi);
  const RECOVERY = 'rgba(46,125,50,0.14)';
  // Coloured like the metric cards above: heating red, cooling blue. The
  // surplus is what has to be cooled away, the deficit what has to be heated.
  const SURPLUS = 'rgba(37,99,235,0.12)';
  const DEFICIT = 'rgba(220,38,38,0.12)';

  const band = (a: number, b: number, color: string, name: string, meta: LinkRegion) =>
    b > a + 1e-9 && {
      meta,
      x: [a, a, b, b, a],
      y: [yRange[0], yRange[1], yRange[1], yRange[0], yRange[0]],
      fill: 'toself',
      fillcolor: color,
      line: { width: 0 },
      mode: 'lines',
      name: `${name}: ${formatDe(b - a, 1)} kW`,
      hoveron: 'fills',
      hoverinfo: 'name',
    };
  // Each end belongs to whichever curve runs on alone there.
  const end = (hotAlone: boolean) =>
    hotAlone
      ? ([SURPLUS, names.surplus, 'surplus'] as const)
      : ([DEFICIT, names.deficit, 'deficit'] as const);
  return [
    band(Math.min(hotLo, coldLo), lo, ...end(hotLo < coldLo)),
    band(lo, hi, RECOVERY, names.recovery, 'recovery'),
    band(hi, Math.max(hotHi, coldHi), ...end(hotHi > coldHi)),
  ].filter(Boolean);
}
