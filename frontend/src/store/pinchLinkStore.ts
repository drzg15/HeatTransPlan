/** Links the composite curves, the grand composite curve and the pinch metric
 *  cards: the temperature under the mouse, the area being hovered, and which
 *  legend entries are switched off, shared so each view can echo the other. */

import { create } from 'zustand';

/** Areas that appear in more than one view: surplus and deficit are bands on
 *  the composite curves, bars on the GCC and the cooling and heating cards;
 *  recovery is the green band on the composite curves and its card. The GCC's
 *  pockets are only part of the recovery, so they are not linked to it. */
export type LinkRegion = 'surplus' | 'deficit' | 'recovery' | 'pinch';

/** A stream hovered in the stream list, in real temperatures. */
export interface LinkStream {
  name: string;
  tin: number;
  tout: number;
  Q: number;
  hot: boolean;
}

interface PinchLinkStore {
  /** Hovered temperature on the shifted scale (the GCC's), °C. */
  hoverT: number | null;
  region: LinkRegion | null;
  /** Legend entries switched off, by key; shared keys hide in both charts. */
  hidden: Record<string, boolean>;
  stream: LinkStream | null;
  /** The markings on the pinch charts (areas, labels, linked lines); off
   *  leaves the bare curves. */
  explain: boolean;
  setExplain: (on: boolean) => void;
  setStream: (stream: LinkStream | null) => void;
  setHoverT: (t: number | null) => void;
  setRegion: (region: LinkRegion | null) => void;
  toggle: (key: string) => void;
}

export const usePinchLink = create<PinchLinkStore>((set) => ({
  hoverT: null,
  region: null,
  hidden: {},
  stream: null,
  explain: true,
  setExplain: (explain) => set({ explain }),
  setStream: (stream) => set({ stream }),
  // Rounded to 0,1 K so moving the mouse does not redraw both charts per pixel.
  setHoverT: (t) =>
    set((s) => {
      const hoverT = t === null ? null : Math.round(t * 10) / 10;
      return hoverT === s.hoverT ? s : { hoverT };
    }),
  setRegion: (region) => set((s) => (region === s.region ? s : { region })),
  toggle: (key) => set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
}));

/** Value of a piecewise-linear curve at y (curves here are monotonic in T),
 *  or null outside its range. */
/** A stream's temperature range on the shifted scale: hot streams are shifted
 *  down by ΔTmin/2, cold streams up. */
export function shiftedRange(s: { tin: number; tout: number; hot: boolean }, half: number) {
  const shift = s.hot ? -half : half;
  return [Math.min(s.tin, s.tout) + shift, Math.max(s.tin, s.tout) + shift] as const;
}

export function hAtT(H: number[], T: number[], t: number): number | null {
  const pts = H.map((h, k) => [h, T[k]]).sort((a, b) => a[1] - b[1]);
  for (let k = 1; k < pts.length; k++) {
    const [h0, t0] = pts[k - 1];
    const [h1, t1] = pts[k];
    if (t >= t0 && t <= t1) return t1 === t0 ? h1 : h0 + ((t - t0) / (t1 - t0)) * (h1 - h0);
  }
  return null;
}

/** The temperature under the mouse on a Plotly chart, or null outside the
 *  plot area. Works anywhere on the plot, not only over a data point. */
export function tempUnderMouse(gd: any, clientY: number): number | null {
  const fl = gd?._fullLayout;
  if (!fl?.yaxis) return null;
  const y = clientY - gd.getBoundingClientRect().top - fl._size.t;
  if (y < 0 || y > fl._size.h) return null;
  return fl.yaxis.p2l(y);
}
