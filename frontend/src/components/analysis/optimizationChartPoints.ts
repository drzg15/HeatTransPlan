/** Which points the optimization chart draws, their hover text, and which
 *  pumps it highlights. Pure functions of the optimization result. */

import type { TFunction } from 'i18next';
import type { OptimizedIntegrationPoint } from '../../types/analysis';

// On a steep stretch of the sink profile, tens of degrees of lift cost only
// a few kW, so dozens of points stack into a near-vertical line at
// effectively the same power. They are not distinct options — the extra
// temperature buys no extra duty — and they crowd out the points that do
// differ. Thin them by duty, keeping the coolest sink temperature in each
// step: the cheapest lift that delivers that power.
//
// The step is in DUTY, so it only bites where duty is barely changing. A
// shallow stretch spreads its points across many steps and keeps them all.
const collapseVerticals = (points: OptimizedIntegrationPoint[]) => {
  const qs = points.map((p) => p.Q_demand);
  const span = qs.length ? Math.max(...qs) - Math.min(...qs) : 0;
  if (span <= 0) return points;
  const step = span * 0.02;

  const perBucket = new Map<string, OptimizedIntegrationPoint>();
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

/** The refrigerant dots and archetype diamonds the chart draws. */
export function thinnedPoints(
  feasiblePoints: OptimizedIntegrationPoint[],
  selectedPoints: OptimizedIntegrationPoint[],
  maxQPoint: OptimizedIntegrationPoint | null
) {
  // Filter feasible points: For each T_sink temperature level and each refrigerant type, keep only the single point with the highest COP
  const bestPointsMap = new Map<string, OptimizedIntegrationPoint>();
  for (const pt of feasiblePoints) {
    if (pt.theoretical) continue;
    // Group by T_sink and refrigerant_type (Natural/Synthetic)
    const key = `${pt.T_sink.toFixed(2)}_${pt.refrigerant_type}`;
    const existing = bestPointsMap.get(key);
    if (!existing || pt.COP > existing.COP) {
      bestPointsMap.set(key, pt);
    }
  }

  // Active points are drawn as their own markers regardless of thinning, so if
  // thinning drops one it is left standing alone off the line. Keep whatever is
  // active in the cloud it belongs to.
  const activeKeys = new Set(
    (selectedPoints.length > 0 ? selectedPoints : maxQPoint ? [maxQPoint] : []).map(
      (p) => `${p.refrigerant}_${p.T_sink.toFixed(2)}`
    )
  );
  const keepActive = (
    points: OptimizedIntegrationPoint[],
    thinned: OptimizedIntegrationPoint[]
  ) => {
    const have = new Set(thinned.map((p) => `${p.refrigerant}_${p.T_sink.toFixed(2)}`));
    const extra = points.filter((p) => {
      const k = `${p.refrigerant}_${p.T_sink.toFixed(2)}`;
      return activeKeys.has(k) && !have.has(k);
    });
    return extra.length ? [...thinned, ...extra] : thinned;
  };

  const bestPointsList = Array.from(bestPointsMap.values());
  const filteredPoints = keepActive(bestPointsList, collapseVerticals(bestPointsList));

  // The technology archetypes are grouped per technology instead, so each keeps
  // its own curve rather than competing with the refrigerants for a T_sink slot.
  const theoreticalBest = new Map<string, OptimizedIntegrationPoint>();
  for (const pt of feasiblePoints) {
    if (!pt.theoretical) continue;
    const key = `${pt.T_sink.toFixed(2)}_${pt.refrigerant}`;
    const existing = theoreticalBest.get(key);
    if (!existing || pt.COP > existing.COP) {
      theoreticalBest.set(key, pt);
    }
  }
  // Archetypes stack on a steep profile exactly as the refrigerants do, so they
  // get the same thinning — otherwise the diamonds keep the vertical alive
  // after the dots have been thinned out of it.
  const theoreticalList = Array.from(theoreticalBest.values());
  const theoreticalPoints = keepActive(theoreticalList, collapseVerticals(theoreticalList));

  return { filteredPoints, theoreticalPoints };
}

const RUNNERS_UP = 3;

/** Hover text for every drawn point. */
export function stackedHoverText(
  drawn: OptimizedIntegrationPoint[],
  t: TFunction
): (p: OptimizedIntegrationPoint, side: 'sink' | 'source') => string {
  // Every candidate at one sink temperature carries the same duty, so they all
  // land on the same pixel. Plotly's 'closest' hovermode breaks that tie by
  // draw order, which meant the archetype diamonds — pushed last, and drawn
  // larger — captured the tooltip whatever their COP. Rank the stack by COP
  // instead and let every point at that temperature report the same winner.
  const stackAtTemp = new Map<string, OptimizedIntegrationPoint[]>();
  for (const p of drawn) {
    const key = p.T_sink.toFixed(2);
    const at = stackAtTemp.get(key);
    if (at) at.push(p);
    else stackAtTemp.set(key, [p]);
  }
  for (const group of stackAtTemp.values()) {
    group.sort((a, b) => b.COP - a.COP);
  }

  /** The hover text for a point: whichever machine at this sink temperature has
   *  the best COP, then the next few, so the Carnot ceiling can be read against
   *  what a real machine actually reaches. `side` picks which half of the
   *  balance the headline numbers describe. */
  return (p, side) => {
    const group = stackAtTemp.get(p.T_sink.toFixed(2)) ?? [p];
    const [best, ...rest] = group;
    const kind = best.theoretical ? t('optimization.theoretical') : t('optimization.real');
    const qSource = (x: OptimizedIntegrationPoint) => (x.Q_demand * (x.COP - 1)) / x.COP;

    const head =
      side === 'sink'
        ? `<b>${best.refrigerant} — ${kind}</b><br>` +
          `T_sink: ${best.T_sink.toFixed(1)}°C<br>` +
          `Q_sink: ${best.Q_demand.toFixed(1)} kW` +
          `${best.source_limited && best.Q_demand_total ? ` of ${best.Q_demand_total.toFixed(1)} kW (source-limited)` : ''}<br>` +
          `COP: ${best.COP.toFixed(2)}`
        : `<b>${best.refrigerant} — ${kind}</b><br>` +
          `T_source: ${best.T_source.toFixed(1)}°C<br>` +
          `Q_source: ${qSource(best).toFixed(1)} kW<br>` +
          `COP: ${best.COP.toFixed(2)}` +
          `${best.demand_limited ? `<br>${t('optimization.hover_demand_limited')}` : ''}`;

    if (rest.length === 0) return head;

    // Runners-up are named with their COP only: the point of the list is to
    // compare efficiency at a fixed duty, and repeating the duty on each row
    // would say the same number several times.
    const others = rest
      .slice(0, RUNNERS_UP)
      .map((o) => `  ${o.refrigerant}: ${o.COP.toFixed(2)}`)
      .join('<br>');
    const more =
      rest.length > RUNNERS_UP
        ? `<br>  +${rest.length - RUNNERS_UP} ${t('optimization.hover_more')}`
        : '';

    return `${head}<br>${t('optimization.hover_also_here')}:<br>${others}${more}`;
  };
}

/** The highlighted pumps: the max-Q point, plus everything clicked.
 *
 *  The max-Q point is highlighted before anything is clicked. It used to be
 *  REPLACED by the first click, so that marker silently shrank back into the
 *  cloud — it now stays highlighted alongside the clicked ones. */
export function activePointsOf(
  maxQPoint: OptimizedIntegrationPoint | null,
  selectedPoints: OptimizedIntegrationPoint[]
) {
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

/** The pump that gets the schematic box.
 *
 *  Only the most recently clicked pump gets a box. A click appends every
 *  machine at that sink temperature to the end of the selection, so the last
 *  entry's temperature is the one just clicked; the earlier selections stay
 *  on the chart as enlarged markers and in the table. */
export function boxPointsOf(activePoints: OptimizedIntegrationPoint[]) {
  const lastTemp = activePoints.length ? activePoints[activePoints.length - 1].T_sink : null;
  return lastTemp === null
    ? []
    : (() => {
        const atTemp = activePoints.filter((p) => Math.abs(p.T_sink - lastTemp) < 0.01);
        // The best machine there represents the temperature.
        const best = atTemp.reduce<OptimizedIntegrationPoint | null>(
          (b, p) =>
            !b || p.Q_demand > b.Q_demand || (p.Q_demand === b.Q_demand && p.COP > b.COP) ? p : b,
          null
        );
        return best ? [best] : [];
      })();
}
