/** Pockets of the grand composite curve.
 *
 *  Moving away from the pinch, the GCC should only move right: above the
 *  pinch every interval needs heat, below it every interval has heat to spare.
 *  Where it turns back left, an interval with the opposite balance sits next to
 *  it and the two exchange heat internally — a pocket. Closing it with a
 *  vertical line gives the pocketless profile, the envelope
 *
 *    above the pinch:  env(T) = min { H(T') : T' ≥ T }
 *    below the pinch:  env(T) = min { H(T') : T' ≤ T }
 *
 *  and the pocket is the area between the curve and that envelope. */

export interface Pockets {
  /** Polygons for a Plotly 'toself' fill, one per pocket, separated by null. */
  x: Array<number | null>;
  y: Array<number | null>;
  /** Heat exchanged inside the pockets: the summed width of each pocket, kW. */
  heat: number;
}

const EPS = 1e-6;

/** Pockets on one side of the pinch. `pts` run from the far end towards the
 *  pinch, so the running minimum of H is the envelope. */
function side(pts: Array<[number, number]>, out: Pockets) {
  // Refine the curve with the points where it crosses the envelope level, so
  // each pocket closes exactly on its vertical line.
  const curve: Array<[number, number, number]> = []; // H, T, envelope
  let m = Infinity;
  for (let k = 0; k < pts.length; k++) {
    const [h, t] = pts[k];
    if (k > 0) {
      const [h0, t0] = pts[k - 1];
      if ((h0 - m) * (h - m) < 0) {
        const f = (m - h0) / (h - h0);
        curve.push([m, t0 + f * (t - t0), m]);
      }
    }
    m = Math.min(m, h);
    curve.push([h, t, m]);
  }

  // Each run where the curve stands right of the envelope is one pocket:
  // along the curve, then back down the envelope's vertical line.
  let run: Array<[number, number, number]> = [];
  const close = () => {
    if (run.length > 2) {
      const width = Math.max(...run.map(([h, , e]) => h - e));
      if (width > EPS) {
        out.x.push(...run.map(([h]) => h), ...[...run].reverse().map(([, , e]) => e), null);
        out.y.push(...run.map(([, t]) => t), ...[...run].reverse().map(([, t]) => t), null);
        out.heat += width;
      }
    }
    run = [];
  };
  let prev: [number, number, number] | null = null;
  for (const p of curve) {
    const inside = p[0] - p[2] > EPS;
    // A pocket opens at the last point on the envelope before it.
    if (inside && !run.length && prev) run.push(prev);
    if (inside || run.length) run.push(p);
    if (!inside && run.length) close();
    prev = p;
  }
  close();
}

export function gccPockets(H: number[], T: number[], pinchT: number): Pockets {
  const pts = H.map((h, k) => [h, T[k]] as [number, number]);
  const out: Pockets = { x: [], y: [], heat: 0 };
  // Above the pinch from the top down, below it from the bottom up.
  side(
    pts.filter(([, t]) => t >= pinchT - EPS).sort((a, b) => b[1] - a[1]),
    out
  );
  side(
    pts.filter(([, t]) => t <= pinchT + EPS).sort((a, b) => a[1] - b[1]),
    out
  );
  return out;
}
