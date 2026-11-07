import { t } from './i18n';

export function uid(): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

export function clsx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

export function money(n: number | undefined, currency: string): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  // Iranian Toman has no ISO code; 'IRT' is the common convention
  if (currency === 'IRT') return `${new Intl.NumberFormat('en-US').format(n)} ${t('Toman')}`;
  try {
    return new Intl.NumberFormat('en-US',{ style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

/** Extract a bare hostname from a URL-ish string or asset name. */
export function domainOf(s: string | undefined): string {
  if (!s) return '';
  const t = s.trim();
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function normalizeUrl(s: string | undefined): string {
  if (!s) return '';
  const t = s.trim();
  if (!t) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

export function isSafeHttpUrl(s: string | undefined): boolean {
  try {
    const u = new URL(normalizeUrl(s));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function openUrl(s: string | undefined) {
  if (!isSafeHttpUrl(s)) return false;
  window.open(normalizeUrl(s), '_blank', 'noopener,noreferrer');
  return true;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseTags(s: string): string[] {
  return Array.from(new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)));
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
