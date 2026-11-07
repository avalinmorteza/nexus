import { calParts, fromJalali, isValidISODate, toJalali } from './dates';

const pad = (n: number) => String(n).padStart(2, '0');

export const toLatinDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));

/** Numeric Y/M/D of an ISO date in the active calendar, for date fields. */
export function displayDate(iso: string): string {
  if (!isValidISODate(iso)) return '';
  const { y, m, d } = calParts(iso);
  return `${y}/${pad(m)}/${pad(d)}`;
}

/**
 * Parse typed input. Accepts Y/M/D or Y-M-D with Latin or Persian digits.
 * Years below 1700 are read as Jalali (Shamsi), others as Gregorian — so either can be typed in any mode.
 * Returns an ISO (Gregorian) date or null.
 */
export function parseDateInput(raw: string): string | null {
  const s = toLatinDigits(raw.trim());
  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (y < 1700) {
    const iso = fromJalali(y, mo, d);
    const back = toJalali(iso); // rejects e.g. Esfand 30 in a non-leap year
    return back.y === y && back.m === mo && back.d === d ? iso : null;
  }
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  return isValidISODate(iso) ? iso : null;
}
