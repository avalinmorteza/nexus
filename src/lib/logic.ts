// Pure business logic (no chrome / DOM). Unit-tested in tests/logic.test.ts.
import { addDays, addMonths, addYears, daysUntil, diffDays, expiryStatus, isValidISODate, todayISO } from './dates';
import type { Asset, Category, DB, ISODate, Recurrence, Settings, Task } from './types';
import { t } from './i18n';
import { uid } from './util';

/* ---------------- Reminder scheduling ---------------- */

export interface ReminderDue {
  key: string;
  threshold: number | 'expired';
  days: number;
}

/**
 * Decide whether an asset needs a notification right now.
 * The "stage" is the smallest configured threshold the asset has crossed. Each stage
 * fires at most once per expiration date (keyed by asset + date + stage), and when the
 * browser was closed for a while only the most urgent stage fires (no notification bursts).
 */
export function reminderDue(
  asset: Asset,
  settings: Settings,
  sent: Record<string, number>,
  today: ISODate = todayISO(),
): ReminderDue | null {
  if (!settings.notificationsEnabled || !asset.notificationsEnabled || asset.status !== 'active') return null;
  if (!asset.expirationDate || !isValidISODate(asset.expirationDate)) return null;
  if (asset.snoozedUntil && daysUntil(asset.snoozedUntil, today) > 0) return null;
  const days = daysUntil(asset.expirationDate, today);
  const schedule = (asset.reminderDays && asset.reminderDays.length ? asset.reminderDays : settings.reminderDays)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  if (days < 0) {
    if (days < -30) return null; // don't nag about long-expired assets
    const key = `${asset.id}|${asset.expirationDate}|expired`;
    return sent[key] ? null : { key, threshold: 'expired', days };
  }
  const stage = schedule.find((t) => days <= t);
  if (stage === undefined) return null;
  const key = `${asset.id}|${asset.expirationDate}|${stage}`;
  return sent[key] ? null : { key, threshold: stage, days };
}

/** Keys to mark as sent together with a stage so less-urgent stages never fire afterwards. */
export function keysCoveredBy(asset: Asset, settings: Settings, due: ReminderDue): string[] {
  const schedule = asset.reminderDays && asset.reminderDays.length ? asset.reminderDays : settings.reminderDays;
  const keys = [due.key];
  if (due.threshold === 'expired') {
    for (const t of schedule) keys.push(`${asset.id}|${asset.expirationDate}|${t}`);
  } else {
    for (const t of schedule) if (t >= due.threshold) keys.push(`${asset.id}|${asset.expirationDate}|${t}`);
  }
  return Array.from(new Set(keys));
}

export function reminderMessage(asset: Asset, days: number): string {
  if (days < 0) return days === -1 ? t('Expired yesterday.') : t('Expired {n} days ago.', { n: -days });
  if (days === 0) return t('Expires today.');
  if (days === 1) return t('Expires tomorrow.');
  return t('Expires in {n} days.', { n: days });
}

/* ---------------- Tasks ---------------- */

export function nextOccurrence(date: ISODate, r: Recurrence): ISODate {
  switch (r) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly':
      return addDays(date, 7);
    case 'monthly':
      return addMonths(date, 1);
    case 'yearly':
      return addYears(date, 1);
    default:
      return date;
  }
}

/** When completing a recurring task, create the next instance (history is preserved). */
export function spawnRecurring(task: Task, today: ISODate = todayISO()): Task | null {
  if (task.recurrence === 'none') return null;
  let due = task.dueDate && isValidISODate(task.dueDate) ? task.dueDate : today;
  due = nextOccurrence(due, task.recurrence);
  // if long overdue, catch up so the next one lands in the future
  let guard = 0;
  while (daysUntil(due, today) < 0 && guard++ < 1000) due = nextOccurrence(due, task.recurrence);
  const shift = task.dueDate && isValidISODate(task.dueDate) ? diffDays(task.dueDate, due) : 0;
  let reminderAt = task.reminderAt;
  if (reminderAt && task.dueDate) {
    const [d, t] = reminderAt.split('T');
    if (isValidISODate(d)) reminderAt = `${addDays(d, shift)}T${t || '09:00'}`;
  }
  const now = Date.now();
  return {
    ...task,
    id: uid(),
    dueDate: due,
    reminderAt,
    done: false,
    completedAt: undefined,
    subtasks: task.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
    createdAt: now,
    updatedAt: now,
  };
}

export function renewalTaskFor(asset: Asset, category: Category | undefined, settings: Settings): Task | null {
  if (!asset.expirationDate || !isValidISODate(asset.expirationDate)) return null;
  const rule = category?.autoTask?.enabled ? category.autoTask : settings.autoRenewalTask ? { daysBefore: settings.renewalTaskDays, title: 'Renew {name}' } : null;
  if (!rule) return null;
  const now = Date.now();
  return {
    id: uid(),
    title: t(rule.title).replace('{name}', asset.name),
    description: t('Automatically created renewal task for {name}.', { name: asset.name }),
    dueDate: addDays(asset.expirationDate, -Math.max(0, rule.daysBefore)),
    priority: 'high',
    tags: ['renewal'],
    done: false,
    assetId: asset.id,
    recurrence: 'none',
    subtasks: [],
    pinned: false,
    autoRenewal: true,
    createdAt: now,
    updatedAt: now,
  };
}

export type TaskSection = 'inbox' | 'today' | 'upcoming' | 'completed' | 'all' | 'linked';

export function filterTasks(tasks: Task[], section: TaskSection, today: ISODate = todayISO()): Task[] {
  switch (section) {
    case 'inbox':
      return tasks.filter((t) => !t.done && !t.dueDate);
    case 'today':
      return tasks.filter((t) => !t.done && !!t.dueDate && daysUntil(t.dueDate, today) <= 0);
    case 'upcoming':
      return tasks.filter((t) => !t.done && !!t.dueDate && daysUntil(t.dueDate, today) > 0);
    case 'completed':
      return tasks.filter((t) => t.done);
    case 'linked':
      return tasks.filter((t) => !t.done && !!t.assetId);
    default:
      return tasks.filter((t) => !t.done);
  }
}

const PRI = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
export function sortTasks(tasks: Task[]): Task[] {
  return tasks.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) return (b.completedAt || 0) - (a.completedAt || 0);
    const da = a.dueDate || '9999-99-99';
    const dbb = b.dueDate || '9999-99-99';
    if (da !== dbb) return da < dbb ? -1 : 1;
    return PRI[a.priority] - PRI[b.priority];
  });
}

/** Pinned keys in user order; items pinned without an order entry go last. */
export function pinnedKeys(db: DB): string[] {
  const all = [...db.assets.filter((a) => a.pinned).map((a) => `asset:${a.id}`), ...db.tasks.filter((t) => t.pinned).map((t) => `task:${t.id}`)];
  const ordered = db.settings.pinOrder.filter((k) => all.includes(k));
  return [...ordered, ...all.filter((k) => !ordered.includes(k))];
}

/* ---------------- Stats ---------------- */

export function stats(db: DB, today: ISODate = todayISO()) {
  let expiring = 0,
    critical = 0,
    expired = 0;
  for (const a of db.assets) {
    if (a.status !== 'active') continue;
    const s = expiryStatus(a.expirationDate, today);
    if (s === 'warning') expiring++;
    else if (s === 'critical') critical++;
    else if (s === 'expired') expired++;
  }
  return {
    total: db.assets.length,
    activeTasks: db.tasks.filter((t) => !t.done).length,
    expiring: expiring + critical,
    critical,
    expired,
  };
}

export type ExpiryFilter = 'all' | 'normal' | '30' | '7' | 'critical' | 'expired' | 'none';

export function matchExpiryFilter(a: Asset, f: ExpiryFilter, today: ISODate = todayISO()): boolean {
  if (f === 'all') return true;
  const s = expiryStatus(a.expirationDate, today);
  if (f === 'none') return s === 'none';
  if (f === 'expired') return s === 'expired';
  if (f === 'critical') return s === 'critical';
  if (f === 'normal') return s === 'normal';
  if (!a.expirationDate || s === 'none') return false;
  const d = daysUntil(a.expirationDate, today);
  return d >= 0 && d <= (f === '30' ? 30 : 7);
}

/* ---------------- Import / export ---------------- */

export interface ImportResult {
  db: DB;
  added: { assets: number; tasks: number; providers: number; categories: number };
  duplicates: { assets: number; tasks: number; providers: number };
}

const assetSig = (a: Asset) => `${a.name.trim().toLowerCase()}|${a.categoryId}|${a.expirationDate || ''}`;
const taskSig = (t: Task) => `${t.title.trim().toLowerCase()}|${t.dueDate || ''}|${t.assetId || ''}`;

/** Merge an incoming (already normalized) backup into current data, skipping duplicates by id or signature. */
export function mergeImport(current: DB, incoming: DB): ImportResult {
  const out: DB = structuredClone(current);
  const added = { assets: 0, tasks: 0, providers: 0, categories: 0 };
  const duplicates = { assets: 0, tasks: 0, providers: 0 };

  const catIds = new Set(out.categories.map((c) => c.id));
  const catNames = new Map(out.categories.map((c) => [c.name.toLowerCase(), c.id]));
  const catMap = new Map<string, string>();
  for (const c of incoming.categories) {
    if (catIds.has(c.id)) catMap.set(c.id, c.id);
    else if (catNames.has(c.name.toLowerCase())) catMap.set(c.id, catNames.get(c.name.toLowerCase())!);
    else {
      out.categories.push(c);
      catMap.set(c.id, c.id);
      added.categories++;
    }
  }

  const provIds = new Set(out.providers.map((p) => p.id));
  const provNames = new Map(out.providers.map((p) => [p.name.toLowerCase(), p.id]));
  const provMap = new Map<string, string>();
  for (const p of incoming.providers) {
    if (provIds.has(p.id)) {
      provMap.set(p.id, p.id);
      duplicates.providers++;
    } else if (provNames.has(p.name.toLowerCase())) {
      provMap.set(p.id, provNames.get(p.name.toLowerCase())!);
      duplicates.providers++;
    } else {
      out.providers.push(p);
      provMap.set(p.id, p.id);
      added.providers++;
    }
  }

  const assetIds = new Set(out.assets.map((a) => a.id));
  const assetSigs = new Set(out.assets.map(assetSig));
  const assetMap = new Map<string, string>();
  for (const a0 of incoming.assets) {
    const a = { ...a0, categoryId: catMap.get(a0.categoryId) || a0.categoryId, providerId: a0.providerId ? provMap.get(a0.providerId) || a0.providerId : undefined };
    if (assetIds.has(a.id) || assetSigs.has(assetSig(a))) {
      duplicates.assets++;
      const existing = out.assets.find((x) => x.id === a.id || assetSig(x) === assetSig(a));
      if (existing) assetMap.set(a.id, existing.id);
      continue;
    }
    out.assets.push(a);
    assetIds.add(a.id);
    assetSigs.add(assetSig(a));
    assetMap.set(a.id, a.id);
    added.assets++;
  }

  const taskIds = new Set(out.tasks.map((t) => t.id));
  const taskSigs = new Set(out.tasks.map(taskSig));
  for (const t0 of incoming.tasks) {
    const t = { ...t0, assetId: t0.assetId ? assetMap.get(t0.assetId) || t0.assetId : undefined };
    if (taskIds.has(t.id) || taskSigs.has(taskSig(t))) {
      duplicates.tasks++;
      continue;
    }
    out.tasks.push(t);
    taskIds.add(t.id);
    taskSigs.add(taskSig(t));
    added.tasks++;
  }
  return { db: out, added, duplicates };
}

export interface BackupValidation {
  ok: boolean;
  errors: string[];
  counts?: { assets: number; tasks: number; providers: number; categories: number };
}

export function validateBackup(data: unknown): BackupValidation {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') return { ok: false, errors: ['File is not a JSON object.'] };
  const d = (data as any).app === 'nexus' && (data as any).data ? (data as any).data : data;
  for (const k of ['assets', 'tasks', 'providers', 'categories']) {
    if (d[k] !== undefined && !Array.isArray(d[k])) errors.push(`"${k}" must be an array.`);
  }
  if (!Array.isArray(d.assets) && !Array.isArray(d.tasks)) errors.push('No assets or tasks found in this file.');
  (Array.isArray(d.assets) ? d.assets : []).forEach((a: any, i: number) => {
    if (!a || typeof a.id !== 'string' || typeof a.name !== 'string') errors.push(`Asset #${i + 1} is missing id or name.`);
    else if (a.expirationDate && !isValidISODate(a.expirationDate)) errors.push(`Asset "${a.name}" has an invalid expiration date.`);
  });
  (Array.isArray(d.tasks) ? d.tasks : []).forEach((t: any, i: number) => {
    if (!t || typeof t.id !== 'string' || typeof t.title !== 'string') errors.push(`Task #${i + 1} is missing id or title.`);
  });
  return {
    ok: errors.length === 0,
    errors: errors.slice(0, 12),
    counts: {
      assets: Array.isArray(d.assets) ? d.assets.length : 0,
      tasks: Array.isArray(d.tasks) ? d.tasks.length : 0,
      providers: Array.isArray(d.providers) ? d.providers.length : 0,
      categories: Array.isArray(d.categories) ? d.categories.length : 0,
    },
  };
}

export function unwrapBackup(data: any): unknown {
  return data && data.app === 'nexus' && data.data ? data.data : data;
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export never includes passwords or password-type custom fields. */
export function assetsToCSV(db: DB, today: ISODate = todayISO()): string {
  const cats = new Map(db.categories.map((c) => [c.id, c]));
  const provs = new Map(db.providers.map((p) => [p.id, p.name]));
  const header = ['Name', 'Category', 'Provider', 'Status', 'Purchase Date', 'Expiration Date', 'Days Remaining', 'Purchase Price', 'Renewal Price', 'Currency', 'Login URL', 'Purchase Website', 'Username', 'Tags', 'Notes'];
  const rows = db.assets.map((a) => [
    a.name,
    cats.get(a.categoryId)?.name || a.categoryId,
    a.providerId ? provs.get(a.providerId) || '' : '',
    a.status,
    a.purchaseDate || '',
    a.expirationDate || '',
    a.expirationDate && isValidISODate(a.expirationDate) ? daysUntil(a.expirationDate, today) : '',
    a.purchasePrice ?? '',
    a.renewalPrice ?? '',
    a.currency,
    a.loginUrl,
    a.purchaseUrl,
    a.username,
    a.tags.join('; '),
    a.notes,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
