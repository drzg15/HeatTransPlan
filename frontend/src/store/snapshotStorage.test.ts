import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioIO, SnapshotIO } from './snapshotStorage';
import type { SavedScenarios } from '../types/analysis';

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

describe('scenario persistence', () => {
  const SAVED = {
    scenarios: [{ id: 's1', name: 'Kiln only' }],
    active_id: 's1',
  } as unknown as SavedScenarios;

  function fakeScenarioIO(initial: SavedScenarios | null | undefined) {
    let value = initial;
    const io: ScenarioIO = {
      get: async () => value,
      set: async (v) => {
        value = v;
      },
    };
    return { io, saved: () => value };
  }

  it('brings the scenarios back after a reload, and saves changes', async () => {
    const { store } = await freshStore();
    const { startScenarioPersistence } = await import('./snapshotStorage');
    const idb = fakeScenarioIO(SAVED);
    await startScenarioPersistence(store, idb.io);
    expect(store.getState().state.analysis_scenarios).toEqual(SAVED);

    store.getState().resetState();
    await new Promise((r) => setTimeout(r, 0));
    expect(idb.saved()).toBeNull();
  });

  it('a project loaded meanwhile wins over the stored scenarios', async () => {
    const { store } = await freshStore();
    const { startScenarioPersistence } = await import('./snapshotStorage');
    const mine = {
      scenarios: [{ id: 'x', name: 'Loaded' }],
      active_id: null,
    } as unknown as SavedScenarios;
    store.getState().setAnalysisScenarios(mine);
    await startScenarioPersistence(store, fakeScenarioIO(SAVED).io);
    expect(store.getState().state.analysis_scenarios).toBe(mine);
  });
});
