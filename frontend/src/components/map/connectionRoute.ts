/** Where a process flow arrow runs on screen: from the source box's edge to
 *  the target box's edge, so no part of it hides under a box. */

// The arrow's centre sits this far outside the target box (its tip touches the edge).
const ARROW_OFFSET = 12;
// Shortest visible line between two boxes; closer boxes get no line.
const MIN_GAP = 16;

/** Half width and height of a process box on screen, as the box marker sizes it. */
export function boxHalf(name: string, boxScale: unknown) {
  const scale = boxScale ? parseFloat(String(boxScale)) : 1.5;
  const fs = Math.max(12, Math.round(15 * scale));
  const px = Math.max(6, Math.round(12 * scale));
  const py = Math.max(3, Math.round(6 * scale));
  return {
    w: Math.round(Math.max(20, name.length * fs * 0.62 + px * 2 + 2)) / 2,
    h: Math.round(fs + py * 2 + 2) / 2,
  };
}

type Pt = { x: number; y: number };
type Half = { w: number; h: number };

/** The elbow from the source box's edge to the target box's edge: start, two
 *  corners, the arrow's centre and its angle. Prefers the axis the boxes lie
 *  along; null when the boxes are too close for a visible line. */
export function routeConnection(p1: Pt, p2: Pt, src: Half, tgt: Half) {
  const horizontal = () => {
    const s = p2.x > p1.x ? 1 : -1;
    const start = { x: p1.x + s * src.w, y: p1.y };
    const arrow = { x: p2.x - s * (tgt.w + ARROW_OFFSET), y: p2.y };
    if ((arrow.x - start.x) * s < MIN_GAP) return null;
    const midX = (start.x + arrow.x) / 2;
    return {
      horizontal: true,
      start,
      mid1: { x: midX, y: p1.y },
      mid2: { x: midX, y: p2.y },
      arrow,
      angle: s > 0 ? 0 : 180,
    };
  };
  const vertical = () => {
    const s = p2.y > p1.y ? 1 : -1;
    const start = { x: p1.x, y: p1.y + s * src.h };
    const arrow = { x: p2.x, y: p2.y - s * (tgt.h + ARROW_OFFSET) };
    if ((arrow.y - start.y) * s < MIN_GAP) return null;
    const midY = (start.y + arrow.y) / 2;
    return {
      horizontal: false,
      start,
      mid1: { x: p1.x, y: midY },
      mid2: { x: p2.x, y: midY },
      arrow,
      angle: s > 0 ? 90 : -90,
    };
  };
  return Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y)
    ? (horizontal() ?? vertical())
    : (vertical() ?? horizontal());
}

type Route = NonNullable<ReturnType<typeof routeConnection>>;
const LABEL_GAP = 6;

/** Top-left corner of a w × h px label for a route: just above the bend, or,
 *  when the gap between the boxes is narrower than the label, clear of both
 *  boxes (above them, or right of them for a vertical route). */
export function labelSpot(
  route: Route,
  p1: Pt,
  p2: Pt,
  src: Half,
  tgt: Half,
  w: number,
  h: number
) {
  if (route.horizontal) {
    const room = Math.abs(route.arrow.x - route.start.x);
    const lineTop = Math.min(route.mid1.y, route.mid2.y);
    const boxTop = Math.min(p1.y - src.h, p2.y - tgt.h);
    const bottom = (w + 2 * LABEL_GAP <= room ? lineTop : Math.min(lineTop, boxTop)) - LABEL_GAP;
    return { x: route.mid1.x - w / 2, y: bottom - h };
  }
  const room = Math.abs(route.arrow.y - route.start.y);
  const lineRight = Math.max(route.mid1.x, route.mid2.x);
  const boxRight = Math.max(p1.x + src.w, p2.x + tgt.w);
  const left = (h + 2 * LABEL_GAP <= room ? lineRight : Math.max(lineRight, boxRight)) + LABEL_GAP;
  return { x: left, y: route.mid1.y - h / 2 };
}

/** Share of the map the white canvas of an open diagram covers, centred. */
export const CANVAS_SHARE = 0.9;

/** Where a box centred at p sits wholly on that canvas, in a map of the given
 *  size: p itself when it already does, else the nearest point just inside. */
export function onCanvas(p: Pt, size: Pt, half: Half): Pt {
  const edge = (1 - CANVAS_SHARE) / 2;
  const mx = size.x * edge + half.w + 4;
  const my = size.y * edge + half.h + 4;
  const clamp = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);
  return { x: clamp(p.x, mx, size.x - mx), y: clamp(p.y, my, size.y - my) };
}
