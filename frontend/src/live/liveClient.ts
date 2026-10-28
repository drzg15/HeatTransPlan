/** Connects the page to a live session on the backend, so an AI can watch and
 *  drive it (see backend/app/services/live.py).
 *
 *  Off until the user switches it on: the project then lives on the backend
 *  too. While connected the page
 *    - keeps its project on the backend, so the AI's project edits apply here
 *      and the user's edits reach the AI;
 *    - reports what it shows (buildView) after every change;
 *    - runs the commands the AI sends and answers each one. */

import { create } from 'zustand';
import client, { API_BASE, API_KEY } from '../api/client';
import { useAnalysisStore } from '../store/analysisStore';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import type { ProjectState } from '../types/project';
import { runCommand } from './commands';
import { buildView } from './view';

type Status = 'off' | 'connecting' | 'on' | 'error';

interface LiveState {
  status: Status;
  sessionId: string | null;
  projectId: string | null;
  error: string | null;
}

export const useLiveStore = create<LiveState>(() => ({
  status: 'off',
  sessionId: null,
  projectId: null,
  error: null,
}));

const SAVED = 'heattransplan_live_session';
const PROJECT_DEBOUNCE_MS = 600;
const VIEW_DEBOUNCE_MS = 400;

let abort: AbortController | null = null;
let unsubscribers: Array<() => void> = [];
// Set while a project from the backend is being applied, so it is not sent back.
let applyingRemote = false;

const set = (patch: Partial<LiveState>) => useLiveStore.setState(patch);

function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

async function openSession(): Promise<{ session_id: string; project_id: string }> {
  const state = useProjectStore.getState().state;
  // A reload of the same tab keeps its session, and with it the AI's link.
  const saved = sessionStorage.getItem(SAVED);
  if (saved) {
    try {
      const { data } = await client.get(`/api/live/sessions/${saved}`);
      await client.put(`/api/projects/${data.project_id}`, state, {
        headers: { 'X-Live-Session': data.session_id },
      });
      return data;
    } catch {
      sessionStorage.removeItem(SAVED);
    }
  }
  const { data } = await client.post('/api/live/sessions', { state });
  return data;
}

async function answer(sessionId: string, id: string, body: Record<string, unknown>) {
  try {
    await client.post(`/api/live/sessions/${sessionId}/commands/${id}/result`, body);
  } catch {
    // The AI stopped waiting; nothing to do.
  }
}

function handleEvent(sessionId: string, type: string, data: Record<string, unknown>) {
  if (type === 'hello') set({ status: 'on', error: null });
  else if (type === 'project') {
    applyingRemote = true;
    try {
      useProjectStore.getState().setState(data.state as ProjectState);
    } finally {
      applyingRemote = false;
    }
  } else if (type === 'command') {
    const id = String(data.id);
    Promise.resolve()
      .then(() => runCommand(String(data.name), (data.args as Record<string, unknown>) ?? {}))
      .then((result) => answer(sessionId, id, { ok: true, result: result ?? null }))
      .catch((e: unknown) =>
        answer(sessionId, id, { ok: false, error: e instanceof Error ? e.message : String(e) })
      );
  }
}

/** Reads the event stream; reconnects after a drop until switched off. */
async function listen(sessionId: string, signal: AbortSignal) {
  let wait = 1000;
  while (!signal.aborted) {
    try {
      const res = await fetch(`${API_BASE}/api/live/sessions/${sessionId}/events`, {
        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
        signal,
      });
      if (res.status === 404) throw new Error('The live session has ended.');
      if (!res.ok || !res.body) throw new Error(`Live connection failed (${res.status}).`);
      wait = 1000;
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let cut: number;
        while ((cut = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const type = /^event: (.*)$/m.exec(block)?.[1];
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (type && data) handleEvent(sessionId, type, JSON.parse(data));
        }
      }
    } catch (e) {
      if (signal.aborted) return;
      if (e instanceof Error && e.message.includes('ended')) {
        set({ status: 'error', error: e.message });
        return;
      }
    }
    if (signal.aborted) return;
    set({ status: 'connecting' });
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 2, 15_000);
  }
}

function startSync(sessionId: string, projectId: string) {
  const pushProject = debounce(() => {
    client
      .put(`/api/projects/${projectId}`, useProjectStore.getState().state, {
        headers: { 'X-Live-Session': sessionId },
      })
      .catch(() => {});
  }, PROJECT_DEBOUNCE_MS);
  const pushView = debounce(() => {
    client.put(`/api/live/sessions/${sessionId}/view`, buildView()).catch(() => {});
  }, VIEW_DEBOUNCE_MS);

  unsubscribers = [
    useProjectStore.subscribe((s, prev) => {
      if (s.state !== prev.state && !applyingRemote) pushProject();
      pushView();
    }),
    useAnalysisStore.subscribe(pushView),
    useUIStore.subscribe(pushView),
  ];
  liveViewChanged = pushView;
  pushView();
}

/** Called by the router bridge when the page changes. */
export let liveViewChanged: () => void = () => {};

export async function connectLive() {
  if (useLiveStore.getState().status !== 'off' && useLiveStore.getState().status !== 'error')
    return;
  set({ status: 'connecting', error: null });
  try {
    const { session_id, project_id } = await openSession();
    sessionStorage.setItem(SAVED, session_id);
    set({ sessionId: session_id, projectId: project_id });
    abort = new AbortController();
    startSync(session_id, project_id);
    void listen(session_id, abort.signal);
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

export async function disconnectLive() {
  const { sessionId } = useLiveStore.getState();
  abort?.abort();
  abort = null;
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  liveViewChanged = () => {};
  sessionStorage.removeItem(SAVED);
  set({ status: 'off', sessionId: null, projectId: null, error: null });
  if (sessionId) await client.delete(`/api/live/sessions/${sessionId}`).catch(() => {});
}

/** After a reload, reconnect a tab that was connected. */
export function resumeLive() {
  if (sessionStorage.getItem(SAVED)) void connectLive();
}
