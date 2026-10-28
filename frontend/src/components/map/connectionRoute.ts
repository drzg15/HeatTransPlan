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
