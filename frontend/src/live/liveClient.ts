/** Connects the page to a live session on the backend, so an AI can watch and
 *  drive it (see backend/app/services/live.py).
 *
 *  Off until the user switches it on. Nothing of the project is kept on the
 *  server: the page holds the only copy. While connected the page runs the
 *  commands the AI sends (reading the project or what the page shows,
 *  applying an edit, ...) and answers each one. */

import { create } from 'zustand';
import client, { API_BASE, API_KEY } from '../api/client';
import { runCommand } from './commands';

type Status = 'off' | 'connecting' | 'on' | 'error';

/** One thing the AI changed, as the server noted it. */
export interface AiLogEntry {
  time: number;
  tool: string;
  detail: string;
}

interface LiveState {
  status: Status;
  sessionId: string | null;
  projectId: string | null;
  error: string | null;
  /** The user paused the AI: it can do nothing until resumed. */
  paused: boolean;
  /** What the AI changed, newest last. */
  log: AiLogEntry[];
}

const LOG_LENGTH = 50;

export const useLiveStore = create<LiveState>(() => ({
  status: 'off',
  sessionId: null,
  projectId: null,
  error: null,
  paused: false,
  log: [],
}));

const SAVED = 'heattransplan_live_session';

let abort: AbortController | null = null;
// AI commands running now: the server's activity log (X-Actor) tells the
// requests they make from the user's.
let aiCommands = 0;
client.interceptors.request.use((cfg) => {
  if (aiCommands > 0 && !cfg.headers['X-Actor']) cfg.headers['X-Actor'] = 'ai';
  return cfg;
});

const set = (patch: Partial<LiveState>) => useLiveStore.setState(patch);

async function openSession(): Promise<{
  session_id: string;
  project_id: string;
  paused?: boolean;
}> {
  // A reload of the same tab keeps its session, and with it the AI's link.
  const saved = sessionStorage.getItem(SAVED);
  if (saved) {
    try {
      const { data } = await client.get(`/api/live/sessions/${saved}`);
      return data;
    } catch {
      sessionStorage.removeItem(SAVED);
    }
  }
  const { data } = await client.post('/api/live/sessions');
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
  else if (type === 'ai_log') {
    const entry = data as unknown as AiLogEntry;
    set({ log: [...useLiveStore.getState().log, entry].slice(-LOG_LENGTH) });
  } else if (type === 'command') {
    const id = String(data.id);
    aiCommands++;
    Promise.resolve()
      .then(() => runCommand(String(data.name), (data.args as Record<string, unknown>) ?? {}))
      .finally(() => aiCommands--)
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

export async function connectLive() {
  if (useLiveStore.getState().status !== 'off' && useLiveStore.getState().status !== 'error')
    return;
  set({ status: 'connecting', error: null });
  try {
    const { session_id, project_id, paused } = await openSession();
    sessionStorage.setItem(SAVED, session_id);
    set({ sessionId: session_id, projectId: project_id, paused: Boolean(paused) });
    abort = new AbortController();
    void listen(session_id, abort.signal);
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

export async function disconnectLive() {
  const { sessionId } = useLiveStore.getState();
  abort?.abort();
  abort = null;
  sessionStorage.removeItem(SAVED);
  set({ status: 'off', sessionId: null, projectId: null, error: null, paused: false, log: [] });
  if (sessionId) await client.delete(`/api/live/sessions/${sessionId}`).catch(() => {});
}

/** Pause or resume the AI on this page; the server refuses it while paused. */
export async function setAiPaused(paused: boolean) {
  const { sessionId } = useLiveStore.getState();
  if (!sessionId) return;
  const { data } = await client.put(`/api/live/sessions/${sessionId}/pause`, { paused });
  set({ paused: Boolean(data.paused) });
}

/** After a reload, reconnect a tab that was connected. */
export function resumeLive() {
  if (sessionStorage.getItem(SAVED)) void connectLive();
}
