/**
 * Where the map snapshots are persisted.
 *
 * The snapshots are the background images a project file carries for the
 * report's process map — about 2.6 MB for the bundled examples, against a few
 * KB for everything the user actually enters. Persisted with the rest of the
 * project they filled half of the ~5 MB localStorage gives a site, and since
 * the project is one entry, a write that overflowed lost the user's edits along
 * with the images.
 *
 * So they go to IndexedDB, which allows hundreds of MB. They stay in the store
 * exactly as before — the report, Save and Load read them from memory and never
 * notice — only the copy that survives a reload moves.
 */

import type { useProjectStore } from './projectStore';
import type { SavedScenarios } from '../types/analysis';

type Snapshots = Record<string, string>;

export interface SnapshotIO {
  get: () => Promise<Snapshots | undefined>;
  set: (snapshots: Snapshots) => Promise<void>;
}

const DB_NAME = 'heattransplan';
const STORE = 'kv';
const KEY = 'map_snapshots_encoded';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = op(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const idbSnapshots: SnapshotIO = {
  get: () => run('readonly', (s) => s.get(KEY)),
  set: (snapshots) => run('readwrite', (s) => s.put(snapshots, KEY)).then(() => undefined),
};

export interface ScenarioIO {
  get: () => Promise<SavedScenarios | null | undefined>;
  set: (saved: SavedScenarios | null) => Promise<void>;
}

const SCENARIOS_KEY = 'analysis_scenarios';
export const idbScenarios: ScenarioIO = {
  get: () => run('readonly', (s) => s.get(SCENARIOS_KEY)),
  set: (saved) => run('readwrite', (s) => s.put(saved, SCENARIOS_KEY)).then(() => undefined),
};

// Only true once IndexedDB has proven it works. Until then the snapshots stay
// in localStorage, so a browser without IndexedDB behaves exactly as before.
let offloaded = false;
export const snapshotsOffloaded = () => offloaded;

export async function startSnapshotPersistence(
  store: typeof useProjectStore,
  io: SnapshotIO = idbSnapshots
) {
  const atStartup = store.getState().state.map_snapshots_encoded;
  try {
    const saved = await io.get();
    if (saved === undefined) {
      // First load since this change: the snapshots arrived from the old
      // localStorage entry. Copy them over before anything is dropped.
      await io.set(atStartup ?? {});
      offloaded = true;
    } else if (store.getState().state.map_snapshots_encoded === atStartup) {
      offloaded = true;
      store.getState().setMapSnapshots(saved);
    } else {
      // A project was loaded while IndexedDB was being read; that one wins.
      await io.set(store.getState().state.map_snapshots_encoded ?? {});
      offloaded = true;
    }
  } catch {
    offloaded = false;
    return;
  }

  store.subscribe((next, prev) => {
    if (next.state.map_snapshots_encoded !== prev.state.map_snapshots_encoded) {
      io.set(next.state.map_snapshots_encoded ?? {}).catch(() => {});
    }
  });

  // Rewrite the localStorage entry now, without the images, rather than
  // waiting for the next edit to do it.
  store.setState({});
}

/**
 * The saved scenarios, same idea. Each carries the full results it was
 * computed with — megabytes with the optimization points — so they never go
 * to localStorage at all (see projectStore's partialize). Without IndexedDB
 * they last until the page is closed, as they always did.
 */
export async function startScenarioPersistence(
  store: typeof useProjectStore,
  io: ScenarioIO = idbScenarios
) {
  try {
    const saved = await io.get();
    // A project loaded or a scenario saved in the meantime is newer; keep it.
    if (saved && !store.getState().state.analysis_scenarios?.scenarios.length) {
      store.getState().setAnalysisScenarios(saved);
    }
  } catch {
    return;
  }
  // ponytail: rewrites every scenario on each change (the active one tracks
  // every edit); per-scenario keys if that ever shows up as lag.
  store.subscribe((next, prev) => {
    if (next.state.analysis_scenarios !== prev.state.analysis_scenarios) {
      io.set(next.state.analysis_scenarios ?? null).catch(() => {});
    }
  });
}
