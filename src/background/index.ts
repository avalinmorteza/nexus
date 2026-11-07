// NEXUS service worker: reminder scheduler (chrome.alarms) + notifications.
// Runs independently of the popup/dashboard, so reminders fire while they are closed.
import { addDays, daysUntil, formatDate, setCalendar, todayISO } from '../lib/dates';
import { setLang, t as tr, tn } from '../lib/i18n';
import { DB_KEY, localizeDB } from '../lib/defaults';
import { keysCoveredBy, reminderDue, reminderMessage } from '../lib/logic';
import { loadDB, loadNotify, saveDB, saveNotify } from '../lib/storage';
import type { NotificationLogEntry, NotifyState } from '../lib/types';
import { uid } from '../lib/util';

const CHECK_ALARM = 'nexus-check';

function applyLocale(db: { settings: { language: any; calendar: any } }) {
  setLang(db.settings.language);
  setCalendar(db.settings.calendar);
}
const TASK_PREFIX = 'nexus-task:';
const MAX_LOG = 300;

async function ensureAlarms() {
  const a = await chrome.alarms.get(CHECK_ALARM);
  // every 30 minutes; also re-checked on startup and whenever data changes
  if (!a) await chrome.alarms.create(CHECK_ALARM, { periodInMinutes: 30, delayInMinutes: 0.5 }); // 30s is Chrome's minimum
}

function pushLog(n: NotifyState, e: Omit<NotificationLogEntry, 'id' | 'at'>) {
  n.log.unshift({ ...e, id: uid(), at: Date.now() });
  if (n.log.length > MAX_LOG) n.log.length = MAX_LOG;
}

let checking: Promise<void> | null = null;
function checkExpirations() {
  // serialize so concurrent triggers can't double-send
  if (!checking) checking = runCheck().finally(() => (checking = null));
  return checking;
}

async function runCheck() {
  const db = await loadDB();
  applyLocale(db);
  const n = await loadNotify();
  const today = todayISO();
  let changed = false;
  const cats = new Map(localizeDB(db).categories.map((c) => [c.id, c.name]));
  for (const asset of db.assets) {
    const due = reminderDue(asset, db.settings, n.sent, today);
    if (!due) continue;
    for (const k of keysCoveredBy(asset, db.settings, due)) n.sent[k] = Date.now();
    changed = true;
    const title = `${asset.name}`;
    // never include credentials or notes in notification text
    const message = `${cats.get(asset.categoryId) || tr('Asset')} · ${reminderMessage(asset, due.days)}`;
    const id = `asset:${asset.id}:${uid()}`;
    try {
      await chrome.notifications.create(id, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title,
        message,
        priority: due.days <= 3 ? 2 : 0,
        requireInteraction: due.days <= 1,
        buttons: [{ title: tr('Snooze 1 day') }, { title: tr('Open in NEXUS') }],
      });
    } catch (e) {
      console.warn('[nexus] notification failed', (e as Error)?.message);
    }
    pushLog(n, { kind: 'expiration', itemId: asset.id, title, message });
  }

  // prune sent keys for assets that no longer exist
  const ids = new Set(db.assets.map((a) => a.id));
  for (const k of Object.keys(n.sent)) if (!ids.has(k.split('|')[0]) && !k.startsWith('task|') && !k.startsWith('digest|')) delete n.sent[k];

  // optional morning digest
  if (db.settings.dailyDigest && db.settings.notificationsEnabled && new Date().getHours() >= 8) {
    const key = `digest|${today}`;
    if (!n.sent[key]) {
      n.sent[key] = Date.now();
      const dueToday = db.tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today).length;
      if (dueToday > 0) {
        const message = tn(dueToday, '{n} task due today or overdue.', '{n} tasks due today or overdue.');
        await chrome.notifications.create(`digest:${today}`, { type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title: 'NEXUS · ' + tr('Today'), message });
        pushLog(n, { kind: 'digest', title: 'Today', message });
      }
      changed = true;
    }
  }
  if (changed) await saveNotify(n);
  await updateBadge();
}

async function updateBadge() {
  const db = await loadDB();
  const today = todayISO();
  // critical (≤3 days) plus recently expired (last 30 days) — matches what reminders cover
  const urgent = db.assets.filter((a) => {
    if (a.status !== 'active' || !a.expirationDate) return false;
    const d = daysUntil(a.expirationDate, today);
    return d <= 3 && d >= -30;
  }).length;
  await chrome.action.setBadgeText({ text: urgent ? String(urgent) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#FF3B30' });
}

/** One alarm per task reminder, using exact `when` timestamps. */
async function scheduleTaskAlarms() {
  const db = await loadDB();
  const existing = (await chrome.alarms.getAll()).filter((a) => a.name.startsWith(TASK_PREFIX));
  const wanted = new Map<string, number>();
  if (db.settings.taskReminders && db.settings.notificationsEnabled) {
    for (const t of db.tasks) {
      if (t.done || !t.reminderAt) continue;
      const when = new Date(t.reminderAt).getTime(); // local time
      if (Number.isFinite(when) && when > Date.now() - 60_000) wanted.set(TASK_PREFIX + t.id + '|' + t.reminderAt, when);
    }
  }
  for (const a of existing) if (!wanted.has(a.name)) await chrome.alarms.clear(a.name);
  for (const [name, when] of wanted) if (!existing.some((a) => a.name === name)) await chrome.alarms.create(name, { when: Math.max(when, Date.now() + 1000) });
}

async function fireTaskReminder(alarmName: string) {
  const [id, at] = alarmName.slice(TASK_PREFIX.length).split('|');
  const db = await loadDB();
  applyLocale(db);
  const t = db.tasks.find((x) => x.id === id);
  if (!t || t.done || t.reminderAt !== at) return;
  const n = await loadNotify();
  const key = `task|${id}|${at}`;
  if (n.sent[key]) return;
  n.sent[key] = Date.now();
  const message = t.dueDate ? tr('Due {date}', { date: formatDate(t.dueDate) }) : tr('Task reminder');
  await chrome.notifications.create(`task:${id}:${uid()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: t.title,
    message,
    buttons: [{ title: tr('Mark done') }, { title: tr('Open in NEXUS') }],
  });
  pushLog(n, { kind: 'task', itemId: id, title: t.title, message });
  await saveNotify(n);
}

async function openDashboard(hash = '') {
  const url = chrome.runtime.getURL('dashboard.html');
  // runtime.getContexts finds our own open dashboard tab without needing the "tabs" permission
  try {
    const ctx = await (chrome.runtime as any).getContexts?.({ contextTypes: ['TAB'] });
    const hit = (ctx || []).find((c: any) => typeof c.documentUrl === 'string' && c.documentUrl.startsWith(url) && c.tabId >= 0);
    if (hit) {
      await chrome.tabs.update(hit.tabId, { active: true, url: url + hash });
      if (hit.windowId >= 0) await chrome.windows.update(hit.windowId, { focused: true });
      return;
    }
  } catch {
    /* fall through */
  }
  await chrome.tabs.create({ url: url + hash });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarms();
  await checkExpirations();
  await scheduleTaskAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarms();
  await checkExpirations();
  await scheduleTaskAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CHECK_ALARM) await checkExpirations();
  else if (alarm.name.startsWith(TASK_PREFIX)) await fireTaskReminder(alarm.name);
});

let debounce: ReturnType<typeof setTimeout> | undefined;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[DB_KEY]) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    checkExpirations();
    scheduleTaskAlarms();
  }, 1500);
});

chrome.notifications.onClicked.addListener(async (nid) => {
  const [kind, id] = nid.split(':');
  chrome.notifications.clear(nid);
  if (kind === 'asset') await openDashboard(`#/assets?open=${id}`);
  else if (kind === 'task') await openDashboard(`#/tasks?open=${id}`);
  else await openDashboard('#/tasks');
});

chrome.notifications.onButtonClicked.addListener(async (nid, idx) => {
  const [kind, id] = nid.split(':');
  chrome.notifications.clear(nid);
  if (idx === 1) {
    await openDashboard(kind === 'asset' ? `#/assets?open=${id}` : `#/tasks?open=${id}`);
    return;
  }
  const db = await loadDB();
  if (kind === 'asset') {
    const a = db.assets.find((x) => x.id === id);
    if (!a) return;
    a.snoozedUntil = addDays(todayISO(), 1);
    // allow the current stage to fire again once the snooze ends
    const n = await loadNotify();
    const due = reminderDue({ ...a, snoozedUntil: undefined }, db.settings, {}, todayISO());
    if (due) delete n.sent[due.key];
    await saveNotify(n);
    await saveDB(db);
  } else if (kind === 'task') {
    const t = db.tasks.find((x) => x.id === id);
    if (!t || t.done) return;
    t.done = true;
    t.completedAt = Date.now();
    db.activity.unshift({ id: uid(), type: 'task.completed', itemType: 'task', itemId: t.id, itemName: t.title, summary: 'Completed from notification', at: Date.now() });
    await saveDB(db);
  }
});

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'open-dashboard') openDashboard();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'nexus:open-dashboard') {
    openDashboard(typeof msg.hash === 'string' ? msg.hash : '').then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'nexus:check') {
    checkExpirations().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'nexus:test-notification') {
    chrome.notifications.create(`test:${uid()}`, { type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title: 'NEXUS', message: tr('Notifications are working.') }, () => {
      const err = chrome.runtime.lastError;
      sendResponse(err ? { ok: false, error: err.message } : { ok: true });
    });
    return true;
  }
  if (msg?.type === 'nexus:reset-sent') {
    loadNotify()
      .then((n) => saveNotify({ ...n, sent: {} }))
      .then(() => checkExpirations())
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

ensureAlarms();
