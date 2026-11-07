import { describe, expect, it } from 'vitest';
import { addDays, addMonths, countdownLabel, daysUntil, expiryStatus, formatDate, fromJalali, isValidISODate, jalaliMonthLength, monthMatrix, setCalendar, toJalali } from '../src/lib/dates';
import { setLang, t } from '../src/lib/i18n';
import { parseDateInput } from '../src/lib/dateparse';
import { defaultSettings, emptyDB } from '../src/lib/defaults';
import { assetsToCSV, keysCoveredBy, matchExpiryFilter, mergeImport, reminderDue, spawnRecurring, validateBackup } from '../src/lib/logic';
import { sampleDB } from '../src/lib/sample';
import { normalizeAsset, normalizeDB, normalizeTask } from '../src/lib/storage';

const T = '2026-11-06';
const asset = (exp?: string, extra = {}) => normalizeAsset({ id: 'a1', name: 'example.com', expirationDate: exp, ...extra });

describe('expiration status thresholds', () => {
  const cases: [number, string][] = [
    [45, 'normal'],
    [31, 'normal'],
    [30, 'warning'],
    [15, 'warning'],
    [4, 'warning'],
    [3, 'critical'],
    [2, 'critical'],
    [1, 'critical'],
    [0, 'critical'],
    [-1, 'expired'],
    [-5, 'expired'],
  ];
  for (const [d, s] of cases) it(`${d} days -> ${s}`, () => expect(expiryStatus(addDays(T, d), T)).toBe(s));
  it('no date -> none', () => expect(expiryStatus(undefined, T)).toBe('none'));
  it('invalid date -> none', () => expect(expiryStatus('2026-02-30', T)).toBe('none'));
});

describe('countdown labels', () => {
  it('today', () => expect(countdownLabel(T, T)).toBe('Expires today'));
  it('tomorrow', () => expect(countdownLabel(addDays(T, 1), T)).toBe('Expires tomorrow'));
  it('n days', () => expect(countdownLabel(addDays(T, 12), T)).toBe('12 days left'));
  it('expired', () => expect(countdownLabel(addDays(T, -5), T)).toBe('Expired 5 days ago'));
  it('yesterday', () => expect(countdownLabel(addDays(T, -1), T)).toBe('Expired yesterday'));
});

describe('date math is DST/timezone safe', () => {
  it('across US DST end (Nov 1 2026)', () => expect(daysUntil('2026-11-02', '2026-10-31')).toBe(2));
  it('across EU DST start (Mar 29 2026)', () => expect(daysUntil('2026-03-30', '2026-03-28')).toBe(2));
  it('across leap day', () => expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2));
  it('across year end', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'));
  it('month clamp', () => expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'));
  it('leap month clamp', () => expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'));
  it('validates dates', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
  });
  it('month matrix starts on week start', () => {
    setCalendar('gregorian');
    const m = monthMatrix(2026, 11, 1); // Nov 2026, Monday start
    expect(m[0][0]).toBe('2026-10-26');
    expect(m.flat()).toContain('2026-11-30');
  });
});

describe('Jalali (Shamsi) calendar', () => {
  it('converts known dates', () => {
    expect(toJalali('2026-11-06')).toEqual({ y: 1405, m: 8, d: 15 });
    expect(toJalali('2026-03-21')).toEqual({ y: 1405, m: 1, d: 1 }); // Nowruz 1405
    expect(toJalali('2025-03-21')).toEqual({ y: 1404, m: 1, d: 1 });
    expect(toJalali('2024-03-20')).toEqual({ y: 1403, m: 1, d: 1 });
    expect(fromJalali(1405, 8, 15)).toBe('2026-11-06');
    expect(fromJalali(1403, 12, 30)).toBe('2025-03-20'); // 1403 is leap
  });
  it('round-trips every day of several years', () => {
    let d = '2020-01-01';
    for (let i = 0; i < 365 * 8; i++) {
      const j = toJalali(d);
      expect(fromJalali(j.y, j.m, j.d)).toBe(d);
      d = addDays(d, 1);
    }
  });
  it('month lengths and leap years', () => {
    expect(jalaliMonthLength(1405, 1)).toBe(31);
    expect(jalaliMonthLength(1405, 7)).toBe(30);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });
  it('jalali month matrix + formatting', () => {
    setCalendar('jalali');
    const m = monthMatrix(1405, 8, 6); // Aban 1405, Saturday start
    expect(m.flat()).toContain(fromJalali(1405, 8, 1));
    expect(m.flat()).toContain(fromJalali(1405, 8, 30));
    expect(formatDate('2026-11-06', 'yyyy-MM-dd')).toBe('1405-08-15');
    expect(formatDate('2026-11-06')).toBe('Aban 15, 1405');
    setCalendar('gregorian');
    expect(formatDate('2026-11-06')).toBe('Nov 6, 2026');
  });
  it('parses typed dates in both calendars', () => {
    setCalendar('jalali');
    expect(parseDateInput('1405/08/15')).toBe('2026-11-06');
    expect(parseDateInput('۱۴۰۵/۰۸/۱۵')).toBe('2026-11-06');
    expect(parseDateInput('2026-11-06')).toBe('2026-11-06');
    expect(parseDateInput('1404/12/30')).toBeNull(); // 1404 not leap
    expect(parseDateInput('garbage')).toBeNull();
    setCalendar('gregorian');
  });
  it('expiration status is identical regardless of calendar', () => {
    setCalendar('jalali');
    expect(expiryStatus(addDays(T, 3), T)).toBe('critical');
    expect(expiryStatus(addDays(T, 30), T)).toBe('warning');
    setCalendar('gregorian');
  });
});

describe('i18n', () => {
  it('translates and interpolates; falls back to English', () => {
    setLang('fa');
    expect(countdownLabel(addDays(T, 12), T)).toBe('12 روز مانده');
    expect(t('Missing key {x}', { x: 1 })).toBe('Missing key 1');
    setLang('en');
    expect(countdownLabel(addDays(T, 12), T)).toBe('12 days left');
  });
});

describe('expiry filters', () => {
  it('30 and 7 day windows', () => {
    expect(matchExpiryFilter(asset(addDays(T, 30)), '30', T)).toBe(true);
    expect(matchExpiryFilter(asset(addDays(T, 31)), '30', T)).toBe(false);
    expect(matchExpiryFilter(asset(addDays(T, 7)), '7', T)).toBe(true);
    expect(matchExpiryFilter(asset(addDays(T, -1)), '7', T)).toBe(false);
    expect(matchExpiryFilter(asset(undefined), 'none', T)).toBe(true);
  });
});

describe('reminder scheduling', () => {
  const s = defaultSettings();
  it('fires the 30-day stage exactly at 30 days', () => {
    expect(reminderDue(asset(addDays(T, 31)), s, {}, T)).toBeNull();
    expect(reminderDue(asset(addDays(T, 30)), s, {}, T)?.threshold).toBe(30);
  });
  it('picks the most urgent missed stage and never duplicates', () => {
    const a = asset(addDays(T, 2));
    const due = reminderDue(a, s, {}, T)!;
    expect(due.threshold).toBe(3);
    const sent: Record<string, number> = {};
    for (const k of keysCoveredBy(a, s, due)) sent[k] = 1;
    expect(reminderDue(a, s, sent, T)).toBeNull();
    // next day: 1-day stage fires
    expect(reminderDue(a, s, sent, addDays(T, 1))?.threshold).toBe(1);
    // the 30/15/7 stages never fire afterwards
    expect(Object.keys(sent).some((k) => k.endsWith('|30'))).toBe(true);
  });
  it('expiration day and expired', () => {
    expect(reminderDue(asset(T), s, {}, T)?.threshold).toBe(0);
    expect(reminderDue(asset(addDays(T, -2)), s, {}, T)?.threshold).toBe('expired');
  });
  it('respects per-asset disable, snooze and custom schedule', () => {
    expect(reminderDue(asset(T, { notificationsEnabled: false }), s, {}, T)).toBeNull();
    expect(reminderDue(asset(T, { snoozedUntil: addDays(T, 1) }), s, {}, T)).toBeNull();
    expect(reminderDue(asset(addDays(T, 10), { reminderDays: [10] }), s, {}, T)?.threshold).toBe(10);
    expect(reminderDue(asset(addDays(T, 20), { reminderDays: [10] }), s, {}, T)).toBeNull();
  });
  it('global switch', () => expect(reminderDue(asset(T), { ...s, notificationsEnabled: false }, {}, T)).toBeNull());
  it('renewing changes the key so reminders restart', () => {
    const a = asset(addDays(T, 2));
    const d1 = reminderDue(a, s, {}, T)!;
    const renewed = { ...a, expirationDate: addDays(T, 367) };
    expect(reminderDue(renewed, s, { [d1.key]: 1 }, addDays(T, 337))?.key).not.toBe(d1.key);
  });
});

describe('recurring tasks', () => {
  it('monthly recurrence creates the next instance', () => {
    const t = normalizeTask({ id: 't1', title: 'Pay bill', dueDate: '2026-11-06', recurrence: 'monthly' });
    const n = spawnRecurring({ ...t, done: true }, T)!;
    expect(n.dueDate).toBe('2026-12-06');
    expect(n.done).toBe(false);
    expect(n.id).not.toBe(t.id);
  });
  it('catches up when long overdue', () => {
    const t = normalizeTask({ id: 't1', title: 'Weekly', dueDate: '2026-09-01', recurrence: 'weekly' });
    const n = spawnRecurring(t, T)!;
    expect(daysUntil(n.dueDate!, T)).toBeGreaterThanOrEqual(0);
    expect(daysUntil(n.dueDate!, T)).toBeLessThan(7);
  });
  it('shifts reminder time with due date', () => {
    const t = normalizeTask({ id: 't1', title: 'x', dueDate: '2026-11-06', reminderAt: '2026-11-06T09:30', recurrence: 'daily' });
    expect(spawnRecurring(t, T)!.reminderAt).toBe('2026-11-07T09:30');
  });
  it('non-recurring returns null', () => expect(spawnRecurring(normalizeTask({ id: 't', title: 'x' }), T)).toBeNull());
});

describe('import / export', () => {
  it('detects duplicate imports', () => {
    const cur = normalizeDB(sampleDB());
    const again = mergeImport(cur, normalizeDB(structuredClone(cur)));
    expect(again.added.assets).toBe(0);
    expect(again.duplicates.assets).toBe(cur.assets.length);
    expect(again.db.assets.length).toBe(cur.assets.length);
  });
  it('merges new items into an empty DB', () => {
    const r = mergeImport(emptyDB(), normalizeDB(sampleDB()));
    expect(r.added.assets).toBe(10);
    expect(r.added.providers).toBe(5);
  });
  it('validates backups', () => {
    expect(validateBackup({ app: 'nexus', data: sampleDB() }).ok).toBe(true);
    expect(validateBackup({ assets: 'nope' }).ok).toBe(false);
    expect(validateBackup({ assets: [{ id: 1 }] }).ok).toBe(false);
    expect(validateBackup(null).ok).toBe(false);
  });
  it('CSV never contains passwords', () => {
    const db = normalizeDB(sampleDB());
    db.assets[0].password = 'hunter2-secret';
    db.assets[0].notes = 'line, with "quotes"';
    const csv = assetsToCSV(db, T);
    expect(csv).not.toContain('hunter2-secret');
    expect(csv).toContain('"line, with ""quotes"""');
  });
  it('normalizes partial / corrupt data', () => {
    const db = normalizeDB({ assets: [{ id: 'x', name: 'y' }, null, { name: 'no id' }], settings: { theme: 'dark' } });
    expect(db.assets.length).toBe(1);
    expect(db.settings.theme).toBe('dark');
    expect(db.settings.reminderDays.length).toBeGreaterThan(0);
    expect(db.categories.length).toBeGreaterThan(5);
  });
});

describe('large database', () => {
  it('handles 5,000 assets quickly', () => {
    const db = emptyDB();
    for (let i = 0; i < 5000; i++) db.assets.push(normalizeAsset({ id: 'a' + i, name: `site-${i}.com`, expirationDate: addDays(T, (i % 400) - 30) }));
    const t0 = performance.now();
    const counts = { warn: 0, crit: 0 };
    for (const a of db.assets) {
      const s = expiryStatus(a.expirationDate, T);
      if (s === 'warning') counts.warn++;
      if (s === 'critical') counts.crit++;
      reminderDue(a, db.settings, {}, T);
    }
    expect(performance.now() - t0).toBeLessThan(500);
    expect(counts.crit).toBeGreaterThan(0);
  });
});
