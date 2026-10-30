/** The optimization's balance for one operating point, as the heat pump view
 *  shows it (backend/app/services/optimization/search.py does the same).
 *
 *  For a sink temperature it reads the demand off the sink profile; the COP
 *  says how much of that must come from waste heat; the source profile says how
 *  much waste heat there is down to the source temperature. The optimizer keeps
 *  the points where the two match. */

export interface Profile {
  H: number[];
  T: number[];
}

/** The profile's duty at a temperature: linear between points, held at the
 *  ends (numpy's interp, which the optimizer uses). T must be ascending. */
export function profileAt(p: Profile | undefined, t: number): number | null {
  if (!p || p.T.length === 0) return null;
  const { T, H } = p;
  if (t <= T[0]) return H[0];
  if (t >= T[T.length - 1]) return H[H.length - 1];
  let i = 1;
  while (T[i] < t) i++;
  return H[i - 1] + ((t - T[i - 1]) / (T[i] - T[i - 1])) * (H[i] - H[i - 1]);
}

export type BalanceState = 'balanced' | 'source_limited' | 'demand_limited';

export interface Balance {
  /** Waste heat the pump draws for the whole sink duty: Q_sink·(COP−1)/COP. */
  needed: number;
  /** Electricity: Q_sink / COP. */
  pEl: number;
  /** available − needed. */
  gap: number;
  state: BalanceState;
  /** Sink duty the available waste heat can carry: Q_avail·COP/(COP−1). */
  qSinkPossible: number;
}

/** Within 1 % (at least 1 kW) counts as on both profiles. */
export function balance(qSink: number, cop: number, qAvailable: number): Balance | null {
  if (!(cop > 1) || !(qSink > 0)) return null;
  const needed = (qSink * (cop - 1)) / cop;
  const gap = qAvailable - needed;
  const tolerance = Math.max(1, 0.01 * needed);
  const state: BalanceState =
    Math.abs(gap) <= tolerance ? 'balanced' : gap < 0 ? 'source_limited' : 'demand_limited';
  return {
    needed,
    pEl: qSink / cop,
    gap,
    state,
    qSinkPossible: Math.min(qSink, (qAvailable * cop) / (cop - 1)),
  };
}
