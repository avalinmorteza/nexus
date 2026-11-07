import { useEffect, useState } from 'react';
import { setCalendar, type CalendarSystem } from '../lib/dates';
import { isRTL, setLang, type Lang } from '../lib/i18n';
import type { Theme } from '../lib/types';

export function useApplyTheme(theme: Theme | undefined) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || ((theme ?? 'system') === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/** Applies language + calendar. Module state is set synchronously so children render translated. */
export function useApplyLocale(lang: Lang | undefined, cal: CalendarSystem | undefined) {
  setLang(lang);
  setCalendar(cal);
  useEffect(() => {
    const l = lang || 'en';
    document.documentElement.lang = l;
    document.documentElement.dir = isRTL(l) ? 'rtl' : 'ltr';
  }, [lang]);
}

/** Simple hash router: #/route?key=value */
export function parseHash(h = window.location.hash): { route: string; params: URLSearchParams } {
  const s = h.replace(/^#\/?/, '');
  const [route, q] = s.split('?');
  return { route: route || 'overview', params: new URLSearchParams(q || '') };
}

export function useHashRoute() {
  const [st, setSt] = useState(() => parseHash());
  useEffect(() => {
    const fn = () => setSt(parseHash());
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return st;
}

export function go(route: string, params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  window.location.hash = `#/${route}${q}`;
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Match 'mod+k', 'mod+shift+p', '/' etc. */
export function matchShortcut(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop()!;
  const want = { mod: parts.includes('mod'), shift: parts.includes('shift'), alt: parts.includes('alt') };
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (want.mod !== mod || want.shift !== e.shiftKey || want.alt !== e.altKey) return false;
  if (key === 'space') return e.code === 'Space';
  return e.key.toLowerCase() === key || e.code.toLowerCase() === `key${key}`;
}

export function shortcutLabel(combo: string): string[] {
  return combo.split('+').map((p) => (p === 'mod' ? (isMac ? '⌘' : 'Ctrl') : p === 'shift' ? (isMac ? '⇧' : 'Shift') : p === 'alt' ? (isMac ? '⌥' : 'Alt') : p.toUpperCase()));
}

export function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem('nexus.ui.' + key);
      return s ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (x: T) => {
    setV(x);
    try {
      localStorage.setItem('nexus.ui.' + key, JSON.stringify(x));
    } catch {
      /* ignore */
    }
  };
  return [v, set];
}
