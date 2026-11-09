/**
 * Deleting a subprocess has to take the node out of `processes`, not just out of
 * its group: the potential analysis walks the flat `processes` array, so a node
 * left behind keeps showing up there with its streams. Removing it shifts every
 * later index, so group members and the `stream_<procIdx>_...` selection keys
 * have to move with it.
 */

import type { ProcessNode } from '../types/process';

export function removeProcesses(
  removed: number[],
  processes: ProcessNode[],
  groups: number[][],
  selection: Record<string, boolean>
) {
  const drop = new Set(removed);
  const shift = (i: number) => i - removed.filter((r) => r < i).length;

  return {
    processes: processes.filter((_, i) => !drop.has(i)),
    groups: groups.map((g) => g.filter((i) => !drop.has(i)).map(shift)),
    selection: Object.fromEntries(
      Object.entries(selection).flatMap(([key, val]) => {
        // stream_<procIdx>_<streamIdx>, or stream_<procIdx>_<childIdx>_<streamIdx>
        const m = /^stream_(\d+)(_.*)?$/.exec(key);
        if (!m) return [[key, val]];
        const pIdx = Number(m[1]);
        return drop.has(pIdx) ? [] : [[`stream_${shift(pIdx)}${m[2] ?? ''}`, val]];
      })
    ),
  };
}

/** Indices of processes no group claims — leftovers from deletes before the fix above. */
export function orphanProcesses(processes: ProcessNode[], groups: number[][]) {
  const grouped = new Set(groups.flat());
  return processes.map((_, i) => i).filter((i) => !grouped.has(i));
}

/** Deleting a stream moves the later streams of its subprocess up by one; the
 *  selection keys `stream_<sub>_<stream>` have to move with them, or a
 *  selection would silently point at the next stream. */
export function removeStreamFromSelection(
  selection: Record<string, boolean>,
  sub: number,
  index: number
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(selection).flatMap(([key, val]) => {
      const m = /^stream_(\d+)_(\d+)$/.exec(key);
      if (!m || Number(m[1]) !== sub) return [[key, val]];
      const si = Number(m[2]);
      if (si === index) return [];
      return [[`stream_${sub}_${si > index ? si - 1 : si}`, val]];
    })
  );
}
