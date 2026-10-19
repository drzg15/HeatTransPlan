/**
 * Which heat pumps the optimization panel shows, and how — as plain functions.
 *
 * These used to live inline in HPIOptimizationPanel and HPIOptimizationChart.
 * The report draws the same table and chart on the server, so it needs the same
 * rules in Python (backend/app/services/report/hp_rules.py). Both
 * implementations are checked against contracts/hp_rules.json; if one changes
 * and the other does not, a test fails instead of the report quietly
 * disagreeing with the page.
 */

import type { OptimizedIntegrationPoint } from '../../types/analysis';

type Point = OptimizedIntegrationPoint;

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

/** How the table is sorted whenever a new result arrives — so, in practice,
 *  the order everyone sees before clicking a column header. */
export const DEFAULT_TABLE_SORT: SortConfig[] = [{ key: 'Q_demand', direction: 'desc' }];

/**
 * The panel's filters. Kept in the store and saved with each scenario, and
 * sent with the report, so the report shows the pumps the page shows.
 * Snake case because they go to the backend as they are.
 */
export interface HPFilters {
  medium_sink: string; // 'All' or one sink medium
  refrigerant_type: string; // 'All' or one type
  refrigerants: string[]; // empty means all
  hp_levels: string[]; // empty means all
  // Theoretical reference rows are shown by default: they are the context the
  // real machines are read against, and with them hidden a click on the chart
  // cannot select them either.
  show_theoretical: boolean;
  show_source_limited: boolean;
  show_demand_limited: boolean;
}

export const DEFAULT_HP_FILTERS: HPFilters = {
  medium_sink: 'All',
  refrigerant_type: 'All',
  refrigerants: [],
  hp_levels: [],
  show_theoretical: true,
  show_source_limited: false,
  show_demand_limited: false,
};

/** The refrigerant without its stage suffix: "Butane_2" → "Butane". */
export const refrigerantNameOf = (p: Point) =>
  p.refrigerant.includes('_') ? p.refrigerant.substring(0, p.refrigerant.lastIndexOf('_')) : p.refrigerant;

/**
 * The points the filters let through. Hiding the theoretical rows here keeps
 * every downstream count, chart trace and best-point pick consistent with what
 * is on screen.
 */
export function filterPoints(points: Point[], f: HPFilters): Point[] {
  return points.filter(
    (p) =>
      !(p.theoretical && !f.show_theoretical) &&
      (f.medium_sink === 'All' || p.medium_sink === f.medium_sink) &&
      (f.refrigerant_type === 'All' || p.refrigerant_type === f.refrigerant_type) &&
      (f.refrigerants.length === 0 || f.refrigerants.includes(refrigerantNameOf(p))) &&
      (f.hp_levels.length === 0 || f.hp_levels.includes(p.hp_level))
  );
}

/** The picks that are still among `points` — what survives a new result or a filter change. */
export const picksAmong = (selected: Point[], points: Point[]) =>
  selected.filter((sp) => points.some((p) => isSamePoint(p, sp)));

/**
 * The filters with any value the new points no longer offer dropped, so a
 * filter set for one result can never empty the table for the next.
 */
export function filtersFor(points: Point[], f: HPFilters): HPFilters {
  const has = (key: (p: Point) => string, v: string) => points.some((p) => key(p) === v);
  return {
    ...f,
    medium_sink: has((p) => p.medium_sink, f.medium_sink) ? f.medium_sink : 'All',
    refrigerant_type: has((p) => p.refrigerant_type, f.refrigerant_type) ? f.refrigerant_type : 'All',
    refrigerants: f.refrigerants.filter((r) => has(refrigerantNameOf, r)),
    hp_levels: f.hp_levels.filter((l) => has((p) => p.hp_level, l)),
  };
}

export function isSamePoint(a: Point, b: Point): boolean {
  return (
    a.refrigerant === b.refrigerant &&
    a.medium_sink === b.medium_sink &&
    a.T_sink === b.T_sink &&
    a.T_source === b.T_source
  );
}

/** Most duty delivered, higher COP breaks a tie. */
const beats = (p: Point, best: Point | null) =>
  !best || p.Q_demand > best.Q_demand || (p.Q_demand === best.Q_demand && p.COP > best.COP);

/**
 * The points the chart plots.
 *
 * Two kinds of point sit off a profile and turn the chart into a cloud when
 * plotted by default. Source-limited ones deliver less than the demand above
 * T_sink, so they miss the sink profile; demand-limited ones leave waste heat
 * unused at T_source, so they miss the source profile. Both stay in the table
 * and can be switched on explicitly. If nothing sits on the profiles, a chart
 * with no points at all would be worse than a busy one — fall back to
 * showing everything.
 */
export function chartPointsOf(
  filteredPoints: Point[],
  showSourceLimited = false,
  showDemandLimited = false
): Point[] {
  const onProfilePoints = filteredPoints.filter((p) => !p.source_limited && !p.demand_limited);
  return onProfilePoints.length === 0
    ? filteredPoints
    : filteredPoints.filter(
        (p) => (!p.source_limited || showSourceLimited) && (!p.demand_limited || showDemandLimited)
      );
}

/**
 * The pump highlighted before anything is clicked.
 *
 * The max-Q point follows the same visibility rules as the cloud — otherwise it
 * draws an off-profile marker while the source/demand-limited boxes are
 * unticked, which reads as a bug. When the backend's max-Q point is one of the
 * hidden ones, the best point that *is* visible is highlighted instead. The
 * headline pump is a machine you could actually buy, so the default skips the
 * theoretical references — Carnot wins on COP at the top duty and would
 * otherwise always be the one in the box.
 */
export function defaultHighlightOf(chartPoints: Point[], maxQPoint: Point | null): Point | null {
  const bestVisiblePoint = chartPoints.reduce<Point | null>(
    (best, p) => (beats(p, best) ? p : best),
    null
  );
  const bestRealPoint = chartPoints.reduce<Point | null>(
    (best, p) => (p.theoretical ? best : beats(p, best) ? p : best),
    null
  );
  return maxQPoint && !maxQPoint.theoretical && chartPoints.some((p) => isSamePoint(p, maxQPoint))
    ? maxQPoint
    : (bestRealPoint ?? bestVisiblePoint);
}

/**
 * The rows of the table, before the user's column sort.
 *
 * The best real machine per refrigerant type. Every archetype shares the one
 * "Theoretical" type, so those are grouped by technology instead: Carnot always
 * stays as the thermodynamic ceiling, and of the rest only the best one is
 * shown — listing every technology that happens to fit at some sink
 * temperature buried the table. "Best" is duty first, COP as the tie-break: an
 * archetype that only fits at a low sink temperature covers a fraction of the
 * demand, and its COP is high precisely because it does less work. Anything
 * picked on the chart is added on top.
 */
export function tableRowsOf(
  filteredPoints: Point[],
  showTheoretical: boolean,
  selectedPoints: Point[]
): Point[] {
  const bestByType = new Map<string, Point>();
  for (const pt of filteredPoints) {
    if (pt.theoretical) continue;
    if (beats(pt, bestByType.get(pt.refrigerant_type) ?? null)) bestByType.set(pt.refrigerant_type, pt);
  }
  const tableData = Array.from(bestByType.values());

  const bestTheoretical = new Map<string, Point>();
  for (const pt of filteredPoints) {
    if (!pt.theoretical) continue;
    if (beats(pt, bestTheoretical.get(pt.refrigerant) ?? null)) bestTheoretical.set(pt.refrigerant, pt);
  }
  const allTheoretical = Array.from(bestTheoretical.values());
  const carnotRow = allTheoretical.find((p) => p.refrigerant === 'Carnot');
  const bestOtherRow = allTheoretical
    .filter((p) => p.refrigerant !== 'Carnot')
    .sort((a, b) => b.Q_demand - a.Q_demand || b.COP - a.COP)[0];
  const theoreticalRows = showTheoretical
    ? [carnotRow, bestOtherRow].filter((p): p is Point => Boolean(p))
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

/**
 * The solution cloud the chart draws, thinned.
 *
 * Refrigerants: per T_sink and refrigerant type, only the highest COP. On a
 * steep stretch of the sink profile, tens of degrees of lift cost only a few
 * kW, so dozens of points stack into a near-vertical line at effectively the
 * same power. They are not distinct options — the extra temperature buys no
 * extra duty — so they are thinned by duty, keeping the coolest sink
 * temperature in each 2%-of-span step: the cheapest lift that delivers that
 * power. The step is in DUTY, so it only bites where duty is barely changing.
 *
 * Archetypes are grouped per technology instead, so each keeps its own curve,
 * and get the same thinning.
 *
 * Active points are drawn as their own markers regardless of thinning, so if
 * thinning drops one it is left standing alone off the line; whatever is active
 * stays in the cloud it belongs to.
 */
export function thinnedCloudOf(
  feasiblePoints: Point[],
  maxQPoint: Point | null,
  selectedPoints: Point[]
): { real: Point[]; theoretical: Point[] } {
  const bestPointsMap = new Map<string, Point>();
  for (const pt of feasiblePoints) {
    if (pt.theoretical) continue;
    const key = `${pt.T_sink.toFixed(2)}_${pt.refrigerant_type}`;
    const existing = bestPointsMap.get(key);
    if (!existing || pt.COP > existing.COP) bestPointsMap.set(key, pt);
  }

  const collapseVerticals = (points: Point[]) => {
    const qs = points.map((p) => p.Q_demand);
    const span = qs.length ? Math.max(...qs) - Math.min(...qs) : 0;
    if (span <= 0) return points;
    const step = span * 0.02;

    const perBucket = new Map<string, Point>();
    for (const pt of points) {
      const key = `${Math.round(pt.Q_demand / step)}_${pt.refrigerant}`;
      const existing = perBucket.get(key);
      // Lowest sink temperature wins; COP breaks an exact tie.
      if (
        !existing ||
        pt.T_sink < existing.T_sink ||
        (pt.T_sink === existing.T_sink && pt.COP > existing.COP)
      ) {
        perBucket.set(key, pt);
      }
    }
    return Array.from(perBucket.values());
  };

  const activeKeys = new Set(
    (selectedPoints.length > 0 ? selectedPoints : maxQPoint ? [maxQPoint] : []).map(
      (p) => `${p.refrigerant}_${p.T_sink.toFixed(2)}`
    )
  );
  const keepActive = (points: Point[], thinned: Point[]) => {
    const have = new Set(thinned.map((p) => `${p.refrigerant}_${p.T_sink.toFixed(2)}`));
    const extra = points.filter((p) => {
      const k = `${p.refrigerant}_${p.T_sink.toFixed(2)}`;
      return activeKeys.has(k) && !have.has(k);
    });
    return extra.length ? [...thinned, ...extra] : thinned;
  };

  const bestPointsList = Array.from(bestPointsMap.values());
  const real = keepActive(bestPointsList, collapseVerticals(bestPointsList));

  const theoreticalBest = new Map<string, Point>();
  for (const pt of feasiblePoints) {
    if (!pt.theoretical) continue;
    const key = `${pt.T_sink.toFixed(2)}_${pt.refrigerant}`;
    const existing = theoreticalBest.get(key);
    if (!existing || pt.COP > existing.COP) theoreticalBest.set(key, pt);
  }
  const theoreticalList = Array.from(theoreticalBest.values());
  const theoretical = keepActive(theoreticalList, collapseVerticals(theoreticalList));

  return { real, theoretical };
}

/**
 * The highlighted points: the default one, plus whatever was clicked. The
 * max-Q point used to be REPLACED by the first click, so that marker silently
 * shrank back into the cloud — it now stays highlighted alongside the clicked
 * ones.
 */
export function activePointsOf(maxQPoint: Point | null, selectedPoints: Point[]): Point[] {
  const out = maxQPoint ? [maxQPoint] : [];
  for (const sp of selectedPoints) {
    const dup = out.some(
      (p) =>
        p.refrigerant === sp.refrigerant &&
        Math.abs(p.T_sink - sp.T_sink) < 0.01 &&
        Math.abs(p.T_source - sp.T_source) < 0.01
    );
    if (!dup) out.push(sp);
  }
  return out;
}

/**
 * The pump that gets the box. A click appends every machine at that sink
 * temperature to the end of the selection, so the last entry's temperature is
 * the one just clicked; the best machine there represents it.
 */
export function boxPointOf(activePoints: Point[]): Point | null {
  if (!activePoints.length) return null;
  const lastTemp = activePoints[activePoints.length - 1].T_sink;
  return activePoints
    .filter((p) => Math.abs(p.T_sink - lastTemp) < 0.01)
    .reduce<Point | null>((b, p) => (beats(p, b) ? p : b), null);
}

/**
 * The pump the chart boxes. The status quo comparison on the page and the
 * report both rate heat pump coverage with it, so the two can never name
 * different machines.
 */
export function highlightedPumpOf(
  points: Point[],
  maxQPoint: Point | null,
  selectedPoints: Point[],
  filters: HPFilters = DEFAULT_HP_FILTERS
): Point | null {
  const chartPoints = chartPointsOf(
    filterPoints(points, filters),
    filters.show_source_limited,
    filters.show_demand_limited
  );
  const highlight = defaultHighlightOf(chartPoints, maxQPoint);
  return boxPointOf(activePointsOf(highlight, selectedPoints));
}

/** Sorts the table rows in place by the given columns, as the header clicks set them. */
export function sortRows(pointsToShow: Point[], sortConfigs: SortConfig[]): Point[] {
  return pointsToShow.sort((a, b) => {
    for (const config of sortConfigs) {
      // Q_source and P_el are derived rather than stored on the point, so they
      // are computed here instead of read off the object.
      const valueFor = (p: Point): string | number | boolean | undefined => {
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
