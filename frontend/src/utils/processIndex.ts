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
    selection: rekeySelection(removed, selection),
  };
}

/**
 * A stream selection after the processes at `removed` are gone: their keys
 * dropped, every later key moved up. Every selection that outlives a delete
 * needs this — the live one and each saved scenario's.
 */
export function rekeySelection(removed: number[], selection: Record<string, boolean>) {
  const drop = new Set(removed);
  const shift = (i: number) => i - removed.filter((r) => r < i).length;
  return Object.fromEntries(
    Object.entries(selection).flatMap(([key, val]) => {
      // stream_<procIdx>_<streamIdx>, or stream_<procIdx>_<childIdx>_<streamIdx>
      const m = /^stream_(\d+)(_.*)?$/.exec(key);
      if (!m) return [[key, val]];
      const pIdx = Number(m[1]);
      return drop.has(pIdx) ? [] : [[`stream_${shift(pIdx)}${m[2] ?? ''}`, val]];
    })
  );
}

/** Indices of processes no group claims — leftovers from deletes before the fix above. */
export function orphanProcesses(processes: ProcessNode[], groups: number[][]) {
  const grouped = new Set(groups.flat());
  return processes.map((_, i) => i).filter((i) => !grouped.has(i));
}
