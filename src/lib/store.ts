import { useEffect, useState, useSyncExternalStore } from 'react';
import { DB_KEY, NOTIFY_KEY } from './defaults';
import { loadDB, loadNotify, normalizeDB, onRawChange, saveDB, saveNotify } from './storage';
import type { DB, NotifyState } from './types';

/** Small reactive store over chrome.storage.local, shared by the dashboard and popup. */

let db: DB | null = null;
let notify: NotifyState = { sent: {}, log: [] };
let loadError: string | null = null;
const listeners = new Set<() => void>();
let started = false;
let queue: Promise<unknown> = Promise.resolve();

function emit() {
  listeners.forEach((l) => l());
}

export async function initStore() {
  if (started) return;
  started = true;
  try {
    db = await loadDB();
    notify = await loadNotify();
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Failed to load data';
  }
  emit();
  onRawChange((key, value) => {
    if (key === DB_KEY) db = normalizeDB(value);
    else if (key === NOTIFY_KEY) notify = { sent: (value as any)?.sent || {}, log: (value as any)?.log || [] };
    else return;
    emit();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('nexus-storage', async () => {
      db = await loadDB();
      notify = await loadNotify();
      emit();
    });
  }
}

export function getDB(): DB | null {
  return db;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useDB(): DB | null {
  return useSyncExternalStore(subscribe, () => db);
}
export function useNotify(): NotifyState {
  return useSyncExternalStore(subscribe, () => notify);
}
export function useLoadError() {
  return useSyncExternalStore(subscribe, () => loadError);
}

/**
 * Apply a mutation. Mutations are serialized; each reads the latest persisted state first so
 * that writes from another tab or the popup aren't lost.
 */
export function mutate<T = void>(fn: (draft: DB) => T): Promise<T> {
  const run = async () => {
    const fresh = await loadDB();
    const draft = structuredClone(fresh);
    const result = fn(draft);
    db = draft;
    emit();
    await saveDB(draft);
    return result;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export async function mutateNotify(fn: (n: NotifyState) => void) {
  const n = structuredClone(await loadNotify());
  fn(n);
  notify = n;
  emit();
  await saveNotify(n);
}

/** Re-render periodically so countdowns roll over at midnight without reload. */
export function useToday(): string {
  const get = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [t, setT] = useState(get);
  useEffect(() => {
    const id = setInterval(() => setT(get()), 60_000);
    const vis = () => setT(get());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return t;
}
