/** Stable text for snapshot tests: NaN and Infinity survive, and long arrays
 *  (heatmap grids, point clouds) become a count plus a short hash so the
 *  snapshot stays small yet still fails on any change. */

export function fingerprint(text: string): string {
  let h = 5381;
  for (const c of text) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(16);
}

export const dump = (v: unknown) =>
  JSON.stringify(
    v,
    (_k, x) => {
      if (typeof x === 'number' && !Number.isFinite(x)) return String(x);
      if (Array.isArray(x) && x.length > 40)
        return `[${x.length} items ${fingerprint(JSON.stringify(x))}]`;
      return x;
    },
    1
  );
