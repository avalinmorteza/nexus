import { formatDate } from './dates';
import { t as tr } from './i18n';
import { emptyDB } from './defaults';
import { mergeImport, renewalTaskFor, spawnRecurring, type ImportResult } from './logic';
import { mutate } from './store';
import { normalizeDB } from './storage';
import type { Activity, ActivityType, Asset, Category, DB, ISODate, Provider, Settings, Task } from './types';
import { uid } from './util';

const MAX_ACTIVITY = 2000;

function log(db: DB, type: ActivityType, itemType: Activity['itemType'], itemId: string | undefined, itemName: string, summary: string) {
  db.activity.unshift({ id: uid(), type, itemType, itemId, itemName, summary, at: Date.now() });
  if (db.activity.length > MAX_ACTIVITY) db.activity.length = MAX_ACTIVITY;
}

/* ---------------- Assets ---------------- */

export type AssetInput = Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'renewals' | 'pinned'> & Partial<Pick<Asset, 'pinned'>>;

export function createAsset(input: AssetInput, opts: { createRenewalTask?: boolean } = {}) {
  return mutate((db) => {
    const now = Date.now();
    const asset: Asset = { ...input, pinned: !!input.pinned, id: uid(), renewals: [], createdAt: now, updatedAt: now };
    db.assets.push(asset);
    log(db, 'asset.created', 'asset', asset.id, asset.name, tr('Added to {cat}', { cat: catName(db, asset.categoryId) }));
    if (opts.createRenewalTask !== false) {
      const cat = db.categories.find((c) => c.id === asset.categoryId);
      // explicit opt-in from the form forces a task even when no category/global rule is on
      const settings = opts.createRenewalTask ? { ...db.settings, autoRenewalTask: true } : db.settings;
      const t = renewalTaskFor(asset, cat, settings);
      if (t) {
        db.tasks.push(t);
        log(db, 'task.created', 'task', t.id, t.title, tr('Renewal task for {name}', { name: asset.name }));
      }
    }
    return asset;
  });
}

const catName = (db: DB, id: string) => db.categories.find((c) => c.id === id)?.name || tr('Uncategorized');
const provName = (db: DB, id?: string) => (id ? db.providers.find((p) => p.id === id)?.name || tr('Unknown') : tr('None'));

export function updateAsset(id: string, patch: Partial<Asset>) {
  return mutate((db) => {
    const a = db.assets.find((x) => x.id === id);
    if (!a) throw new Error('Asset not found');
    const before = { ...a };
    Object.assign(a, patch, { updatedAt: Date.now() });
    const fmt = db.settings.dateFormat;
    if (patch.expirationDate !== undefined && before.expirationDate !== a.expirationDate) {
      log(db, 'asset.expiration', 'asset', a.id, a.name, tr('Expiration {from} → {to}', { from: formatDate(before.expirationDate, fmt), to: formatDate(a.expirationDate, fmt) }));
      // keep auto renewal task in sync
      const cat = db.categories.find((c) => c.id === a.categoryId);
      const tpl = renewalTaskFor(a, cat, db.settings);
      const open = db.tasks.find((t) => t.assetId === a.id && t.autoRenewal && !t.done);
      if (open && tpl) Object.assign(open, { dueDate: tpl.dueDate, updatedAt: Date.now() });
    }
    if (patch.providerId !== undefined && before.providerId !== a.providerId) log(db, 'asset.provider', 'asset', a.id, a.name, tr('Provider {from} → {to}', { from: provName(db, before.providerId), to: provName(db, a.providerId) }));
    if (patch.categoryId !== undefined && before.categoryId !== a.categoryId) log(db, 'asset.category', 'asset', a.id, a.name, tr('Category {from} → {to}', { from: catName(db, before.categoryId), to: catName(db, a.categoryId) }));
    const changed = (Object.keys(patch) as (keyof Asset)[]).filter(
      (k) => !['expirationDate', 'providerId', 'categoryId', 'updatedAt', 'pinned', 'snoozedUntil'].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(a[k]),
    );
    if (changed.length) {
      const labels = changed.map((k) => (k === 'password' ? 'password' : k === 'custom' ? 'custom fields' : k.replace(/([A-Z])/g, ' $1').toLowerCase()));
      log(db, 'asset.edited', 'asset', a.id, a.name, tr('Updated {fields}', { fields: labels.slice(0, 4).map((l) => tr(l)).join(', ') + (labels.length > 4 ? '…' : '') }));
    }
    return a;
  });
}

export function deleteAssets(ids: string[]) {
  return mutate((db) => {
    const set = new Set(ids);
    for (const a of db.assets.filter((x) => set.has(x.id))) log(db, 'asset.deleted', 'asset', a.id, a.name, tr('Deleted'));
    db.assets = db.assets.filter((a) => !set.has(a.id));
    // keep task history but unlink it
    for (const t of db.tasks) if (t.assetId && set.has(t.assetId)) t.assetId = undefined;
    db.settings.pinOrder = db.settings.pinOrder.filter((k) => !ids.some((id) => k === `asset:${id}`));
  });
}

export function duplicateAsset(id: string) {
  return mutate((db) => {
    const a = db.assets.find((x) => x.id === id);
    if (!a) throw new Error('Asset not found');
    const now = Date.now();
    const copy: Asset = { ...structuredClone(a), id: uid(), name: `${a.name} (copy)`, pinned: false, renewals: [], createdAt: now, updatedAt: now };
    db.assets.push(copy);
    log(db, 'asset.created', 'asset', copy.id, copy.name, tr('Duplicated from {name}', { name: a.name }));
    return copy;
  });
}

export function bulkUpdateAssets(ids: string[], patch: Partial<Asset>, addTags: string[] = []) {
  return mutate((db) => {
    const set = new Set(ids);
    for (const a of db.assets) {
      if (!set.has(a.id)) continue;
      const before = { ...a };
      Object.assign(a, patch, { updatedAt: Date.now() });
      if (addTags.length) a.tags = Array.from(new Set([...a.tags, ...addTags]));
      if (patch.categoryId && before.categoryId !== a.categoryId) log(db, 'asset.category', 'asset', a.id, a.name, tr('Category {from} → {to}', { from: catName(db, before.categoryId), to: catName(db, a.categoryId) }));
      else if (patch.providerId !== undefined && before.providerId !== a.providerId) log(db, 'asset.provider', 'asset', a.id, a.name, tr('Provider {from} → {to}', { from: provName(db, before.providerId), to: provName(db, a.providerId) }));
      else log(db, 'asset.edited', 'asset', a.id, a.name, tr('Bulk edited'));
    }
  });
}

export interface RenewInput {
  newExpiration: ISODate;
  newPrice?: number;
  note?: string;
  completeTasks: boolean;
}

export function renewAsset(id: string, r: RenewInput) {
  return mutate((db) => {
    const a = db.assets.find((x) => x.id === id);
    if (!a) throw new Error('Asset not found');
    const fmt = db.settings.dateFormat;
    a.renewals.unshift({
      id: uid(),
      at: Date.now(),
      previousExpiration: a.expirationDate,
      newExpiration: r.newExpiration,
      previousPrice: a.renewalPrice ?? a.purchasePrice,
      newPrice: r.newPrice,
      note: r.note,
    });
    a.expirationDate = r.newExpiration;
    if (r.newPrice !== undefined && !Number.isNaN(r.newPrice)) a.renewalPrice = r.newPrice;
    a.snoozedUntil = undefined;
    a.updatedAt = Date.now();
    log(db, 'asset.renewed', 'asset', a.id, a.name, tr('Renewed until {date}', { date: formatDate(r.newExpiration, fmt) }));
    const open = db.tasks.filter((t) => t.assetId === a.id && !t.done && (t.autoRenewal || /renew/i.test(t.title)));
    if (r.completeTasks) {
      for (const t of open) {
        t.done = true;
        t.completedAt = Date.now();
        log(db, 'task.completed', 'task', t.id, t.title, tr('Completed on renewal of {name}', { name: a.name }));
      }
    }
    // schedule the next renewal task if a rule applies
    if (!db.tasks.some((t) => t.assetId === a.id && t.autoRenewal && !t.done)) {
      const t = renewalTaskFor(a, db.categories.find((c) => c.id === a.categoryId), db.settings);
      if (t) db.tasks.push(t);
    }
  });
}

export function snoozeAsset(id: string, until: ISODate) {
  return mutate((db) => {
    const a = db.assets.find((x) => x.id === id);
    if (a) a.snoozedUntil = until;
  });
}

/* ---------------- Pins ---------------- */

export function togglePin(kind: 'asset' | 'task', id: string) {
  return mutate((db) => {
    const list = kind === 'asset' ? db.assets : db.tasks;
    const item = list.find((x) => x.id === id);
    if (!item) return;
    item.pinned = !item.pinned;
    const key = `${kind}:${id}`;
    db.settings.pinOrder = db.settings.pinOrder.filter((k) => k !== key);
    if (item.pinned) db.settings.pinOrder.push(key);
  });
}

export function setPinOrder(order: string[]) {
  return mutate((db) => {
    db.settings.pinOrder = order;
  });
}

/* ---------------- Tasks ---------------- */

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'done' | 'completedAt' | 'pinned'> & Partial<Pick<Task, 'pinned'>>;

export function createTask(input: TaskInput) {
  return mutate((db) => {
    const now = Date.now();
    const t: Task = { ...input, pinned: !!input.pinned, id: uid(), done: false, createdAt: now, updatedAt: now };
    db.tasks.push(t);
    const asset = t.assetId ? db.assets.find((a) => a.id === t.assetId) : undefined;
    log(db, 'task.created', 'task', t.id, t.title, asset ? tr('Linked to {name}', { name: asset.name }) : tr('Created'));
    return t;
  });
}

export function updateTask(id: string, patch: Partial<Task>) {
  return mutate((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) throw new Error('Task not found');
    const meaningful = Object.keys(patch).some((k) => !['subtasks', 'pinned'].includes(k));
    Object.assign(t, patch, { updatedAt: Date.now() });
    if (meaningful) log(db, 'task.edited', 'task', t.id, t.title, tr('Edited'));
    return t;
  });
}

export function toggleTask(id: string) {
  return mutate((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : undefined;
    t.updatedAt = Date.now();
    log(db, t.done ? 'task.completed' : 'task.reopened', 'task', t.id, t.title, t.done ? tr('Completed') : tr('Reopened'));
    if (t.done) {
      const next = spawnRecurring(t);
      if (next && !db.tasks.some((x) => !x.done && x.title === next.title && x.dueDate === next.dueDate)) {
        db.tasks.push(next);
        log(db, 'task.created', 'task', next.id, next.title, tr('Next {r} occurrence', { r: tr(t.recurrence) }) + (next.dueDate ? ' · ' + formatDate(next.dueDate, db.settings.dateFormat) : ''));
      }
    }
  });
}

export function deleteTasks(ids: string[]) {
  return mutate((db) => {
    const set = new Set(ids);
    for (const t of db.tasks.filter((x) => set.has(x.id))) log(db, 'task.deleted', 'task', t.id, t.title, tr('Deleted'));
    db.tasks = db.tasks.filter((t) => !set.has(t.id));
    db.settings.pinOrder = db.settings.pinOrder.filter((k) => !ids.some((id) => k === `task:${id}`));
  });
}

/* ---------------- Providers ---------------- */

export type ProviderInput = Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>;

export function createProvider(input: ProviderInput) {
  return mutate((db) => {
    const now = Date.now();
    const p: Provider = { ...input, id: uid(), createdAt: now, updatedAt: now };
    db.providers.push(p);
    log(db, 'provider.created', 'provider', p.id, p.name, tr('Added provider'));
    return p;
  });
}

export function updateProvider(id: string, patch: Partial<Provider>) {
  return mutate((db) => {
    const p = db.providers.find((x) => x.id === id);
    if (!p) throw new Error('Provider not found');
    Object.assign(p, patch, { updatedAt: Date.now() });
    log(db, 'provider.edited', 'provider', p.id, p.name, tr('Edited provider'));
  });
}

export function deleteProvider(id: string) {
  return mutate((db) => {
    const p = db.providers.find((x) => x.id === id);
    db.providers = db.providers.filter((x) => x.id !== id);
    for (const a of db.assets) if (a.providerId === id) a.providerId = undefined;
    if (p) log(db, 'provider.deleted', 'provider', p.id, p.name, tr('Deleted provider'));
  });
}

/* ---------------- Categories ---------------- */

export function saveCategory(c: Category) {
  return mutate((db) => {
    const i = db.categories.findIndex((x) => x.id === c.id);
    if (i >= 0) db.categories[i] = c;
    else db.categories.push(c);
  });
}

export function deleteCategory(id: string, moveTo: string) {
  return mutate((db) => {
    db.categories = db.categories.filter((c) => c.id !== id);
    for (const a of db.assets) if (a.categoryId === id) a.categoryId = moveTo;
  });
}

export function reorderCategories(ids: string[]) {
  return mutate((db) => {
    const map = new Map(db.categories.map((c) => [c.id, c]));
    db.categories = ids.map((id) => map.get(id)!).filter(Boolean);
  });
}

/* ---------------- Settings & data ---------------- */

export function updateSettings(patch: Partial<Settings>) {
  return mutate((db) => {
    db.settings = { ...db.settings, ...patch };
  });
}

export function importData(raw: unknown, mode: 'merge' | 'replace'): Promise<ImportResult> {
  const incoming = normalizeDB(raw);
  return mutate((db) => {
    let res: ImportResult;
    if (mode === 'replace') {
      res = {
        // a restored backup's encrypted values only open with that backup's key material
        db: { ...incoming, settings: { ...incoming.settings, encryption: incoming.settings.encryption?.enabled ? incoming.settings.encryption : db.settings.encryption } },
        added: { assets: incoming.assets.length, tasks: incoming.tasks.length, providers: incoming.providers.length, categories: incoming.categories.length },
        duplicates: { assets: 0, tasks: 0, providers: 0 },
      };
    } else res = mergeImport(db, incoming);
    Object.assign(db, res.db);
    log(db, 'data.imported', 'data', undefined, tr('Backup'), tr(mode === 'replace' ? 'Restored {a} assets, {t} tasks' : 'Imported {a} assets, {t} tasks', { a: res.added.assets, t: res.added.tasks }) + (res.duplicates.assets + res.duplicates.tasks ? ' · ' + tr('{n} duplicates skipped', { n: res.duplicates.assets + res.duplicates.tasks }) : ''));
    return res;
  });
}

export function clearAllData() {
  return mutate((db) => {
    Object.assign(db, emptyDB());
  });
}

export function clearActivity() {
  return mutate((db) => {
    db.activity = [];
  });
}

export function replaceAll(next: DB) {
  return mutate((db) => {
    Object.assign(db, next);
  });
}
