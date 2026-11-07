// Lightweight i18n: English source strings are the keys; other languages map them.
// No dependencies so it can be used by the service worker and pure logic modules.
import { FA } from './locales/fa';

export type Lang = 'en' | 'fa';

export const LANGUAGES: { value: Lang; label: string; dir: 'ltr' | 'rtl' }[] = [
  { value: 'en', label: 'English', dir: 'ltr' },
  { value: 'fa', label: 'فارسی', dir: 'rtl' },
];

const DICTS: Record<Lang, Record<string, string>> = { en: {}, fa: FA };

let current: Lang = 'en';

export function setLang(l: Lang | undefined) {
  current = l && DICTS[l] ? l : 'en';
}

export function getLang(): Lang {
  return current;
}

export function isRTL(l: Lang = current) {
  return LANGUAGES.find((x) => x.value === l)?.dir === 'rtl';
}

/** Default language for new installs: Persian if the browser is Persian, else English. */
export function detectLang(): Lang {
  try {
    const n = (typeof navigator !== 'undefined' && (navigator.language || '')) || '';
    return n.toLowerCase().startsWith('fa') ? 'fa' : 'en';
  } catch {
    return 'en';
  }
}

/** Translate. `{name}` placeholders are filled from vars. Missing keys fall back to English. */
export function t(key: string, vars?: Record<string, string | number | undefined>): string {
  let s = DICTS[current][key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k] ?? ''));
  return s;
}

/** Pick singular/plural English key, then translate. */
export function tn(n: number, one: string, many: string, vars: Record<string, string | number> = {}): string {
  return t(n === 1 ? one : many, { n, ...vars });
}
