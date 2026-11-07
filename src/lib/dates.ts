import { getLang, t } from './i18n';
import type { DateFormat, ExpiryStatus, ISODate } from './types';

/**
 * All expiration math works on calendar dates (Y/M/D), never on wall-clock timestamps.
 * Differences are computed via Date.UTC so DST transitions and timezone offsets can't
 * produce off-by-one errors. Dates are always STORED as Gregorian ISO (YYYY-MM-DD);
 * the Jalali (Shamsi) calendar is a display / input layer on top.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function parseISO(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

/** Local Date at midnight for a calendar date. */
export function fromISO(s: ISODate): Date {
  const { y, m, d } = parseISO(s);
  return new Date(y, m - 1, d);
}

function utcDay(s: ISODate): number {
  const { y, m, d } = parseISO(s);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Whole calendar days from `from` to `to` (positive if `to` is later). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round(utcDay(to) - utcDay(from));
}

export function daysUntil(date: ISODate, today: ISODate = todayISO()): number {
  return diffDays(today, date);
}

export function addDays(date: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(date);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Add months, clamping to the last valid day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(date);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}

export function addYears(date: ISODate, n: number): ISODate {
  return addMonths(date, n * 12);
}

/* ---------------- Jalali (Shamsi) conversion — jalaali algorithm (Borkowski) ---------------- */

const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;
const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy: number) {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function toJalali(iso: ISODate): { y: number; m: number; d: number } {
  const { y, m, d } = parseISO(iso);
  const r = d2j(g2d(y, m, d));
  return { y: r.jy, m: r.jm, d: r.jd };
}

export function fromJalali(jy: number, jm: number, jd: number): ISODate {
  const g = d2g(j2d(jy, jm, jd));
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

export function isJalaliLeap(jy: number) {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/* ---------------- Calendar system abstraction (display layer) ---------------- */

export type CalendarSystem = 'gregorian' | 'jalali';
let calendar: CalendarSystem = 'gregorian';
export function setCalendar(c: CalendarSystem | undefined) {
  calendar = c === 'jalali' ? 'jalali' : 'gregorian';
}
export function getCalendar(): CalendarSystem {
  return calendar;
}

/** Y/M/D of an ISO date in the active calendar (month is 1-based). */
export function calParts(iso: ISODate): { y: number; m: number; d: number } {
  return calendar === 'jalali' ? toJalali(iso) : parseISO(iso);
}

export function calToISO(y: number, m: number, d: number): ISODate {
  return calendar === 'jalali' ? fromJalali(y, m, d) : `${y}-${pad(m)}-${pad(d)}`;
}

export function calMonthLength(y: number, m: number): number {
  return calendar === 'jalali' ? jalaliMonthLength(y, m) : new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function calAddMonths(y: number, m: number, n: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (((idx % 12) + 12) % 12) + 1 };
}

/** First and last ISO day of a calendar month. */
export function calMonthRange(y: number, m: number): { start: ISODate; end: ISODate } {
  return { start: calToISO(y, m, 1), end: calToISO(y, m, calMonthLength(y, m)) };
}

const G_MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const G_MONTHS_FA = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
const J_MONTHS_EN = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];
const J_MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const WD_FA_SHORT = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

/** Month name in the active calendar + language. m is 1-based. */
export function monthName(m: number, short = false): string {
  const fa = getLang() === 'fa';
  const list = calendar === 'jalali' ? (fa ? J_MONTHS_FA : J_MONTHS_EN) : fa ? G_MONTHS_FA : G_MONTHS_EN;
  const name = list[m - 1] || '';
  // only Gregorian English names abbreviate cleanly (Jan, Feb…); Jalali names stay whole
  return short && !fa && calendar === 'gregorian' ? name.slice(0, 3) : name;
}

/** Weekday name for JS day index (0 = Sunday). */
export function weekdayName(dow: number, short = false): string {
  if (getLang() === 'fa') return short ? WD_FA_SHORT[dow] : WD_FA[dow];
  return short ? WD_EN[dow].slice(0, 3) : WD_EN[dow];
}

/* ---------------- Status & labels ---------------- */

/**
 * Status rules:
 *  > 30 days  -> normal
 *  30..4      -> warning (yellow)
 *  3..0       -> critical (red)
 *  < 0        -> expired
 */
export function expiryStatus(date: ISODate | undefined, today: ISODate = todayISO()): ExpiryStatus {
  if (!date || !isValidISODate(date)) return 'none';
  const d = daysUntil(date, today);
  if (d < 0) return 'expired';
  if (d <= 3) return 'critical';
  if (d <= 30) return 'warning';
  return 'normal';
}

export function countdownLabel(date: ISODate | undefined, today: ISODate = todayISO()): string {
  if (!date || !isValidISODate(date)) return t('No expiration');
  const d = daysUntil(date, today);
  if (d === 0) return t('Expires today');
  if (d === 1) return t('Expires tomorrow');
  if (d > 1) return t('{n} days left', { n: d });
  if (d === -1) return t('Expired yesterday');
  return t('Expired {n} days ago', { n: -d });
}

export function shortCountdown(date: ISODate | undefined, today: ISODate = todayISO()): string {
  if (!date || !isValidISODate(date)) return '—';
  const d = daysUntil(date, today);
  if (d === 0) return t('Today');
  if (d === 1) return t('Tomorrow');
  if (d > 0) return t('{n}d', { n: d });
  return t('{n}d ago', { n: -d });
}

export function formatDate(date: ISODate | undefined, fmt: DateFormat = 'MMM d, yyyy'): string {
  if (!date || !isValidISODate(date)) return '—';
  const { y, m, d } = calParts(date);
  switch (fmt) {
    case 'yyyy-MM-dd':
      return `${y}-${pad(m)}-${pad(d)}`;
    case 'dd/MM/yyyy':
      return `${pad(d)}/${pad(m)}/${y}`;
    case 'MM/dd/yyyy':
      return `${pad(m)}/${pad(d)}/${y}`;
    default:
      return getLang() === 'fa' ? `${d} ${monthName(m)} ${y}` : `${monthName(m, true)} ${d}, ${y}`;
  }
}

/** "Friday, 15 Aban 1405" style header date. */
export function formatLongDate(date: ISODate): string {
  const { y, m, d } = calParts(date);
  const wd = weekdayName(fromISO(date).getDay());
  return getLang() === 'fa' ? `${wd}، ${d} ${monthName(m)} ${y}` : `${wd}, ${monthName(m)} ${d}, ${y}`;
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return t('just now');
  const m = Math.round(s / 60);
  if (m < 60) return t('{n}m ago', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('{n}h ago', { n: h });
  const d = Math.round(h / 24);
  if (d < 7) return t('{n}d ago', { n: d });
  return formatDate(toISODate(new Date(ts)));
}

/** Matrix of ISO dates (6 rows x 7) covering a month of the ACTIVE calendar (m is 1-based). */
export function monthMatrix(year: number, month: number, weekStart: number): ISODate[][] {
  const first = calToISO(year, month, 1);
  const offset = (fromISO(first).getDay() - weekStart + 7) % 7;
  const start = addDays(first, -offset);
  const rows: ISODate[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: ISODate[] = [];
    for (let c = 0; c < 7; c++) row.push(addDays(start, r * 7 + c));
    rows.push(row);
  }
  return rows;
}

export function startOfWeek(date: ISODate, weekStart: number): ISODate {
  const dow = fromISO(date).getDay();
  return addDays(date, -((dow - weekStart + 7) % 7));
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return t('Good night');
  if (h < 12) return t('Good morning');
  if (h < 18) return t('Good afternoon');
  return t('Good evening');
}
