import type { OptimizedIntegrationPoint } from '../../types/analysis';

const sameKey = (p: OptimizedIntegrationPoint) => `${p.refrigerant}|${p.T_source}|${p.T_sink}`;

/** The pumps a summary describes, so it stays short however many are picked:
 *  the last one picked, then the best (largest heat output) to compare with;
 *  only the best when nothing is picked; once when they are the same pump. */
export function summaryPoints(
  selected: OptimizedIntegrationPoint[],
  best: OptimizedIntegrationPoint | null | undefined
): Array<{ p: OptimizedIntegrationPoint; role: 'selected' | 'best' }> {
  const last = selected[selected.length - 1];
  const out: Array<{ p: OptimizedIntegrationPoint; role: 'selected' | 'best' }> = [];
  if (last) out.push({ p: last, role: 'selected' });
  if (best && (!last || sameKey(best) !== sameKey(last))) out.push({ p: best, role: 'best' });
  return out;
}
