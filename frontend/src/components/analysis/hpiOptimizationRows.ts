/** Which optimization results the panel lists and charts, and in what order.
 *  Pure functions, so the table, the chart and the report can agree. */

import type { OptimizedIntegrationPoint } from '../../types/analysis';

export type SortKey =
  | 'refrigerant_type'
  | 'medium_sink'
  | 'refrigerant'
  | 'hp_level'
  | 'COP'
  | 'T_source'
  | 'T_sink'
  | 'Q_source'
  | 'W_el'
  | 'Q_demand'
  | 'theoretical';

export type SortConfig = { key: SortKey; direction: 'asc' | 'desc' };

export interface PointFilters {
  mediumSink: string; // 'All' or one medium
  refrigerantType: string; // 'All' or one type
  refrigerants: string[]; // empty means all
  hpLevels: string[]; // empty means all
  showTheoretical: boolean;
}

/** An operating point is identified by its refrigerant and the temperature
 *  pair it runs between — the backend sends max_q_point as its own object, so
 *  it never matches a point in the list by reference. */
export function isSamePoint(a: OptimizedIntegrationPoint, b: OptimizedIntegrationPoint): boolean {
  return (
    a.refrigerant === b.refrigerant &&
    a.medium_sink === b.medium_sink &&
    a.T_sink === b.T_sink &&
    a.T_source === b.T_source
  );
}

/** The refrigerant without its stage suffix: R1233zd_2 → R1233zd. */
export const refBaseName = (refrigerant: string) =>
  refrigerant.includes('_') ? refrigerant.substring(0, refrigerant.lastIndexOf('_')) : refrigerant;

/** Most duty delivered, higher COP breaks a tie. */
const beats = (p: OptimizedIntegrationPoint, best: OptimizedIntegrationPoint | null | undefined) =>
  !best || p.Q_demand > best.Q_demand || (p.Q_demand === best.Q_demand && p.COP > best.COP);

/** The choices each filter offers. */
export function filterOptions(points: OptimizedIntegrationPoint[]) {
  return {
    mediumSinks: Array.from(new Set(points.map((p) => p.medium_sink))).sort(),
    refrigerantTypes: Array.from(new Set(points.map((p) => p.refrigerant_type))).sort(),
    refrigerants: Array.from(new Set(points.map((p) => refBaseName(p.refrigerant)))).sort(),
    hpLevels: Array.from(new Set(points.map((p) => p.hp_level))).sort(),
  };
}

export function filterPoints(points: OptimizedIntegrationPoint[], f: PointFilters) {
  return points.filter((p) => {
    // Hiding the theoretical rows here keeps every downstream count, chart
    // trace and best-point pick consistent with what is on screen.
    if (p.theoretical && !f.showTheoretical) return false;
    const refName = refBaseName(p.refrigerant);
    if (f.mediumSink !== 'All' && p.medium_sink !== f.mediumSink) return false;
    if (f.refrigerantType !== 'All' && p.refrigerant_type !== f.refrigerantType) return false;
    if (f.refrigerants.length > 0 && !f.refrigerants.includes(refName)) return false;
    if (f.hpLevels.length > 0 && !f.hpLevels.includes(p.hp_level)) return false;
    return true;
  });
}

/** The points the chart plots and the pump it highlights. */
export function chartView(
  filteredPoints: OptimizedIntegrationPoint[],
  showSourceLimited: boolean,
  showDemandLimited: boolean,
  maxQPoint: OptimizedIntegrationPoint | null | undefined
) {
  // Two kinds of point sit off a profile and turn the chart into a cloud when
  // plotted by default. Source-limited ones deliver less than the demand above
  // T_sink, so they miss the sink profile; demand-limited ones leave waste heat
  // unused at T_source, so they miss the source profile. Both can be switched
  // on explicitly, in the chart and the table together.
  const onProfilePoints = filteredPoints.filter((p) => !p.source_limited && !p.demand_limited);
  const sourceLimitedCount = filteredPoints.filter((p) => p.source_limited).length;
  const demandLimitedCount = filteredPoints.filter((p) => p.demand_limited).length;
  // If nothing sits on the profiles, a chart with no points at all would be
  // worse than a busy one — fall back to showing everything.
  const chartPoints =
    onProfilePoints.length === 0
      ? filteredPoints
      : filteredPoints.filter(
          (p) =>
            (!p.source_limited || showSourceLimited) && (!p.demand_limited || showDemandLimited)
        );

  // The max-Q point is highlighted by default, so it has to follow the same
  // visibility rules as the cloud — otherwise it draws an off-profile marker
  // while the source/demand-limited boxes are unticked, which reads as a bug.
  // An explicitly selected point is left alone: hiding what was just clicked
  // would be worse than showing it off-profile.
  //
  // When the backend's max-Q point is one of the hidden ones, highlight the
  // best point that *is* visible rather than dropping the highlight — the
  // source→sink connector is drawn only for the active point, so leaving it
  // empty loses the link between the two dots. Same rule as the backend: most
  // duty delivered, higher COP breaks a tie.
  const bestVisiblePoint = chartPoints.reduce<OptimizedIntegrationPoint | null>(
    (best, p) => (beats(p, best) ? p : best),
    null
  );
  // The headline pump is a machine you could actually buy, so the default
  // highlight skips the theoretical references — Carnot wins on COP at the top
  // duty and would otherwise always be the one in the box.
  const bestRealPoint = chartPoints.reduce<OptimizedIntegrationPoint | null>(
    (best, p) => (p.theoretical ? best : beats(p, best) ? p : best),
    null
  );
  const chartMaxQPoint =
    maxQPoint && !maxQPoint.theoretical && chartPoints.some((p) => isSamePoint(p, maxQPoint))
      ? maxQPoint
      : (bestRealPoint ?? bestVisiblePoint);

  return { chartPoints, chartMaxQPoint, sourceLimitedCount, demandLimitedCount };
}

/** The table's rows, unsorted: the best real machine per refrigerant type, the
 *  archetypes worth showing, and anything picked on the chart. */
export function tableRows(
  filteredPoints: OptimizedIntegrationPoint[],
  selectedPoints: OptimizedIntegrationPoint[],
  showTheoretical: boolean
) {
  const bestByType = new Map<string, OptimizedIntegrationPoint>();
  for (const pt of filteredPoints) {
    if (pt.theoretical) continue;
    if (beats(pt, bestByType.get(pt.refrigerant_type))) bestByType.set(pt.refrigerant_type, pt);
  }
  const tableData = Array.from(bestByType.values());

  // Every archetype shares the one "Theoretical" type, so grouping them by type
  // would collapse five technologies into a single row. Group by technology.
  const bestTheoretical = new Map<string, OptimizedIntegrationPoint>();
  for (const pt of filteredPoints) {
    if (!pt.theoretical) continue;
    if (beats(pt, bestTheoretical.get(pt.refrigerant))) bestTheoretical.set(pt.refrigerant, pt);
  }
  // Carnot is the thermodynamic ceiling, so it always stays as the reference.
  // Of the remaining archetypes only the best one is shown — listing every
  // technology that happens to fit at some sink temperature buried the table.
  //
  // "Best" is the one at the maximum integration point, not the highest COP:
  // an archetype that only fits at a low sink temperature covers a fraction of
  // the demand, and its COP is high precisely because it does less work. Duty
  // first, COP as the tie-break — the same order bestByType uses above.
  const allTheoretical = Array.from(bestTheoretical.values());
  const carnotRow = allTheoretical.find((p) => p.refrigerant === 'Carnot');
  const bestOtherRow = allTheoretical
    .filter((p) => p.refrigerant !== 'Carnot')
    .sort((a, b) => b.Q_demand - a.Q_demand || b.COP - a.COP)[0];
  const theoreticalRows = showTheoretical
    ? [carnotRow, bestOtherRow].filter((p): p is OptimizedIntegrationPoint => Boolean(p))
    : [];

  // Archetypes take part in the table's own sort rather than sitting in a
  // pinned block, so one click on a header orders every row consistently.
  const pointsToShow = [...theoreticalRows, ...tableData];
  selectedPoints.forEach((sp) => {
    // A point selected while the toggle was on must not linger once it is off.
    if (sp.theoretical && !showTheoretical) return;
    if (!pointsToShow.some((p) => p.refrigerant === sp.refrigerant && p.T_sink === sp.T_sink)) {
      pointsToShow.unshift(sp);
    }
  });
  return pointsToShow;
}

/** Sorts in place by the configured keys, then by COP descending. */
export function sortRows(rows: OptimizedIntegrationPoint[], sortConfigs: SortConfig[]) {
  return rows.sort((a, b) => {
    for (const config of sortConfigs) {
      // Q_source and P_el are derived rather than stored on the point, so they
      // are computed here instead of read off the object.
      const valueFor = (p: OptimizedIntegrationPoint): string | number | boolean | undefined => {
        switch (config.key) {
          case 'Q_source':
            return (p.Q_demand * (p.COP - 1)) / p.COP;
          // Electrical input closes the balance: Q_sink - Q_source = Q_sink/COP.
          case 'W_el':
            return p.Q_demand / p.COP;
          default:
            return p[config.key];
        }
      };
      let valA = valueFor(a);
      let valB = valueFor(b);

      // theoretical is an optional boolean; compare it as 0/1 so undefined
      // sorts with the real machines rather than below everything.
      if (config.key === 'theoretical') {
        valA = a.theoretical ? 1 : 0;
        valB = b.theoretical ? 1 : 0;
      }
      if (valA === undefined || valB === undefined) continue;

      if (valA < valB) return config.direction === 'asc' ? -1 : 1;
      if (valA > valB) return config.direction === 'asc' ? 1 : -1;
    }
    // Every sort key can tie — Q_sink especially, since several machines often
    // cover the same duty. Without a final tie-break the rows keep the order
    // they were built in, which puts the archetypes on top and reads as an
    // unsorted table. COP descending is the meaningful second key.
    return b.COP - a.COP;
  });
}

/** A header click: flip the primary key, or make the clicked key primary
 *  (ascending), keeping up to three keys. */
export function nextSortConfigs(prev: SortConfig[], key: SortKey): SortConfig[] {
  const existingIdx = prev.findIndex((c) => c.key === key);
  if (existingIdx === 0) {
    const newConfigs = [...prev];
    newConfigs[0] = { key, direction: prev[0].direction === 'desc' ? 'asc' : 'desc' };
    return newConfigs;
  }
  if (existingIdx > 0) {
    const newConfigs = prev.filter((c) => c.key !== key);
    newConfigs.unshift({ key, direction: 'asc' });
    return newConfigs;
  }
  return [{ key, direction: 'asc' } as SortConfig, ...prev].slice(0, 3);
}
