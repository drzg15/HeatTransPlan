import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SnapshotIO } from './snapshotStorage';

const IMAGES = { OpenStreetMap: 'osm-png', Satellite: 'satellite-png' };

/** An in-memory stand-in for IndexedDB, optionally broken. */
function fakeIO(initial?: Record<string, string>, broken = false) {
  let value = initial;
  const io: SnapshotIO = {
    get: async () => {
      if (broken) throw new Error('no IndexedDB');
      return value;
    },
    set: async (v) => {
      if (broken) throw new Error('no IndexedDB');
      value = v;
    },
  };
  return { io, saved: () => value };
}

const persisted = () => JSON.parse(localStorage.getItem('heattransplan-storage') ?? '{}');

// Each test gets a fresh store and a fresh "offloaded" flag.
async function freshStore(oldEntry?: object) {
  localStorage.clear();
  if (oldEntry) localStorage.setItem('heattransplan-storage', JSON.stringify(oldEntry));
  vi.resetModules();
  const { useProjectStore } = await import('./projectStore');
  const { startSnapshotPersistence } = await import('./snapshotStorage');
  return { store: useProjectStore, start: startSnapshotPersistence };
}

const oldEntryWithImages = {
  state: {
    projectId: null,
    state: { processes: [{ name: 'Kiln' }], proc_groups: [[0]], map_snapshots_encoded: IMAGES },
  },
  version: 0,
};

describe('map snapshot persistence', () => {
  beforeEach(() => localStorage.clear());

  it('moves the images out of an existing localStorage entry, keeping the data', async () => {
    const { store, start } = await freshStore(oldEntryWithImages);
    const idb = fakeIO();
    await start(store, idb.io);

    expect(idb.saved()).toEqual(IMAGES); // copied over first
    expect(persisted().state.state.map_snapshots_encoded).toEqual({}); // then dropped
    expect(persisted().state.state.processes).toEqual([{ name: 'Kiln' }]); // the data stays
    expect(store.getState().state.map_snapshots_encoded).toEqual(IMAGES); // still usable
  });

  it('brings the images back on the next load', async () => {
    const { store, start } = await freshStore({
      ...oldEntryWithImages,
      state: { ...oldEntryWithImages.state, state: { processes: [], map_snapshots_encoded: {} } },
    });
    await start(store, fakeIO(IMAGES).io);
    expect(store.getState().state.map_snapshots_encoded).toEqual(IMAGES);
  });

  it('keeps everything in localStorage when IndexedDB is unavailable', async () => {
    const { store, start } = await freshStore(oldEntryWithImages);
    await start(store, fakeIO(undefined, true).io);

    store.getState().setProjectNotes('edited');
    expect(persisted().state.state.map_snapshots_encoded).toEqual(IMAGES);
  });

  it('saves images from a newly loaded project', async () => {
    const { store, start } = await freshStore();
    const idb = fakeIO({});
    await start(store, idb.io);

    store.getState().setMapSnapshots({ Positron: 'positron-png' });
    await new Promise((r) => setTimeout(r, 0));
    expect(idb.saved()).toEqual({ Positron: 'positron-png' });
    expect(persisted().state.state.map_snapshots_encoded).toEqual({});
  });
});
