import { DB_KEY, DB_VERSION, NOTIFY_KEY, defaultCategories, defaultSettings, emptyDB } from './defaults';
import type { Asset, Category, DB, NotifyState, Provider, Task } from './types';

/**
 * Storage adapter. Uses chrome.storage.local inside the extension; falls back to
 * localStorage when the UI is opened outside Chrome (e.g. `vite dev`) so the UI can be previewed.
 */

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function rawGet<T>(key: string): Promise<T | undefined> {
  if (hasChrome) {
    const r = await chrome.storage.local.get(key);
    return r[key] as T | undefined;
  }
  const s = localStorage.getItem(key);
  return s ? (JSON.parse(s) as T) : undefined;
}

export async function rawSet(key: string, value: unknown): Promise<void> {
  if (hasChrome) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('nexus-storage', { detail: { key } }));
}

export function onRawChange(cb: (key: string, value: unknown) => void): () => void {
  if (hasChrome) {
    const fn = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      for (const k of Object.keys(changes)) cb(k, changes[k].newValue);
    };
    chrome.storage.onChanged.addListener(fn);
    return () => chrome.storage.onChanged.removeListener(fn);
  }
  const fn = (e: StorageEvent) => e.key && cb(e.key, e.newValue ? JSON.parse(e.newValue) : undefined);
  window.addEventListener('storage', fn);
  return () => window.removeEventListener('storage', fn);
}

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const str = (x: unknown): string => (typeof x === 'string' ? x : '');
const num = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);

export function normalizeAsset(a: Partial<Asset> & { id: string; name: string }): Asset {
  const now = Date.now();
  return {
    id: a.id,
    name: str(a.name),
    categoryId: str(a.categoryId) || 'domains',
    providerId: a.providerId || undefined,
    purchaseUrl: str(a.purchaseUrl),
    purchasePrice: num(a.purchasePrice),
    currency: str(a.currency) || 'USD',
    purchaseDate: a.purchaseDate || undefined,
    expirationDate: a.expirationDate || undefined,
    renewalPrice: num(a.renewalPrice),
    loginUrl: str(a.loginUrl),
    username: str(a.username),
    password: a.password || undefined,
    notes: str(a.notes),
    tags: arr<string>(a.tags).filter((t) => typeof t === 'string'),
    status: a.status === 'paused' || a.status === 'cancelled' ? a.status : 'active',
    custom: a.custom && typeof a.custom === 'object' ? a.custom : {},
    attachments: arr(a.attachments),
    pinned: !!a.pinned,
    notificationsEnabled: a.notificationsEnabled !== false,
    reminderDays: Array.isArray(a.reminderDays) ? a.reminderDays.filter((n) => typeof n === 'number') : null,
    snoozedUntil: a.snoozedUntil || undefined,
    renewals: arr(a.renewals),
    createdAt: num(a.createdAt) ?? now,
    updatedAt: num(a.updatedAt) ?? now,
  };
}

export function normalizeTask(t: Partial<Task> & { id: string; title: string }): Task {
  const now = Date.now();
  return {
    id: t.id,
    title: str(t.title),
    description: str(t.description),
    dueDate: t.dueDate || undefined,
    reminderAt: t.reminderAt || undefined,
    priority: (['low', 'medium', 'high', 'urgent'] as const).includes(t.priority as any) ? (t.priority as Task['priority']) : 'medium',
    tags: arr<string>(t.tags),
    done: !!t.done,
    completedAt: num(t.completedAt),
    assetId: t.assetId || undefined,
    recurrence: (['none', 'daily', 'weekly', 'monthly', 'yearly'] as const).includes(t.recurrence as any) ? (t.recurrence as Task['recurrence']) : 'none',
    subtasks: arr(t.subtasks),
    pinned: !!t.pinned,
    autoRenewal: !!t.autoRenewal,
    createdAt: num(t.createdAt) ?? now,
    updatedAt: num(t.updatedAt) ?? now,
  };
}

export function normalizeProvider(p: Partial<Provider> & { id: string; name: string }): Provider {
  const now = Date.now();
  return {
    id: p.id,
    name: str(p.name),
    website: str(p.website),
    dashboardUrl: str(p.dashboardUrl),
    supportUrl: str(p.supportUrl),
    contact: str(p.contact),
    notes: str(p.notes),
    createdAt: num(p.createdAt) ?? now,
    updatedAt: num(p.updatedAt) ?? now,
  };
}

/** Fill in missing fields so older/partial data never crashes the UI. */
export function normalizeDB(input: unknown): DB {
  const base = emptyDB();
  if (!input || typeof input !== 'object') return base;
  const d = input as Partial<DB>;
  const settings = { ...defaultSettings(), ...(d.settings || {}) };
  // make sure every dashboard section exists exactly once
  const known = defaultSettings().dashboardSections;
  const secs = arr<{ id: any; visible: boolean }>(settings.dashboardSections).filter((s) => known.some((k) => k.id === s.id));
  for (const k of known) if (!secs.some((s) => s.id === k.id)) secs.push(k);
  settings.dashboardSections = secs;
  const categories = arr<Category>(d.categories).length ? arr<Category>(d.categories) : defaultCategories();
  return {
    version: DB_VERSION,
    assets: arr<any>(d.assets).filter((a) => a && a.id).map(normalizeAsset),
    tasks: arr<any>(d.tasks).filter((t) => t && t.id).map(normalizeTask),
    providers: arr<any>(d.providers).filter((p) => p && p.id).map(normalizeProvider),
    categories: categories.map((c) => ({ ...c, fields: arr(c.fields) })),
    activity: arr(d.activity),
    settings,
  };
}

export async function loadDB(): Promise<DB> {
  return normalizeDB(await rawGet<DB>(DB_KEY));
}

export async function saveDB(db: DB): Promise<void> {
  await rawSet(DB_KEY, db);
}

export async function loadNotify(): Promise<NotifyState> {
  const n = await rawGet<NotifyState>(NOTIFY_KEY);
  return { sent: n?.sent || {}, log: Array.isArray(n?.log) ? n!.log : [] };
}

export async function saveNotify(n: NotifyState): Promise<void> {
  await rawSet(NOTIFY_KEY, n);
}
