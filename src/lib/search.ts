import { t as tr, tn } from './i18n';
import type { Asset, DB, Provider, Task } from './types';

export type SearchKind = 'asset' | 'task' | 'provider' | 'category';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  matchField?: string;
  matchText?: string;
  score: number;
  asset?: Asset;
  task?: Task;
  provider?: Provider;
}

function scoreText(text: string, q: string): number {
  const t = text.toLowerCase();
  if (!t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return 60;
  if (t.includes(q)) return 40;
  return 0;
}

/** Search every text-ish field. Password/encrypted values are never searched. */
export function search(db: DB, query: string, limit = 50): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const cats = new Map(db.categories.map((c) => [c.id, c]));
  const provs = new Map(db.providers.map((p) => [p.id, p]));
  const hits: SearchHit[] = [];

  for (const a of db.assets) {
    const cat = cats.get(a.categoryId);
    const prov = a.providerId ? provs.get(a.providerId) : undefined;
    const fields: [string, string, number][] = [
      ['Name', a.name, 3],
      ['Provider', prov?.name || '', 1.5],
      ['Category', cat?.name || '', 1],
      ['Tags', a.tags.join(' '), 1.5],
      ['Login URL', a.loginUrl, 1],
      ['Website', a.purchaseUrl, 1],
      ['Username', a.username, 1],
      ['Notes', a.notes, 0.8],
    ];
    for (const f of cat?.fields || []) {
      if (f.type === 'password') continue;
      const v = a.custom[f.id];
      if (typeof v === 'string' || typeof v === 'number') fields.push([f.label, String(v), 0.9]);
    }
    let best = 0;
    let bf: [string, string, number] | undefined;
    for (const f of fields) {
      const s = scoreText(f[1], q) * f[2];
      if (s > best) {
        best = s;
        bf = f;
      }
    }
    if (best > 0) hits.push({ kind: 'asset', id: a.id, title: a.name, subtitle: [cat?.name, prov?.name].filter(Boolean).join(' · '), matchField: bf![0], matchText: bf![1], score: best, asset: a });
  }

  for (const t of db.tasks) {
    const fields: [string, string, number][] = [
      ['Title', t.title, 3],
      ['Description', t.description, 1],
      ['Tags', t.tags.join(' '), 1.5],
      ['Subtasks', t.subtasks.map((s) => s.title).join(' '), 0.8],
    ];
    let best = 0;
    let bf: [string, string, number] | undefined;
    for (const f of fields) {
      const s = scoreText(f[1], q) * f[2];
      if (s > best) {
        best = s;
        bf = f;
      }
    }
    if (best > 0) hits.push({ kind: 'task', id: t.id, title: t.title, subtitle: t.done ? tr('Completed task') : tr('Task'), matchField: bf![0], matchText: bf![1], score: best * (t.done ? 0.6 : 1), task: t });
  }

  for (const p of db.providers) {
    const fields: [string, string, number][] = [
      ['Name', p.name, 3],
      ['Website', p.website, 1],
      ['Notes', p.notes, 0.8],
      ['Contact', p.contact, 0.8],
    ];
    let best = 0;
    let bf: [string, string, number] | undefined;
    for (const f of fields) {
      const s = scoreText(f[1], q) * f[2];
      if (s > best) {
        best = s;
        bf = f;
      }
    }
    if (best > 0) {
      const n = db.assets.filter((a) => a.providerId === p.id).length;
      hits.push({ kind: 'provider', id: p.id, title: p.name, subtitle: tr('Provider') + ' · ' + tn(n, '{n} asset', '{n} assets'), matchField: bf![0], matchText: bf![1], score: best, provider: p });
    }
  }

  for (const c of db.categories) {
    const s = scoreText(c.name, q) * 2;
    if (s > 0) {
      const n = db.assets.filter((a) => a.categoryId === c.id).length;
      hits.push({ kind: 'category', id: c.id, title: c.name, subtitle: tr('Category') + ' · ' + tn(n, '{n} asset', '{n} assets'), matchField: 'Name', matchText: c.name, score: s });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Split text into [before, match, after] pieces for highlighting; also trims long text around the match. */
export function highlightParts(text: string, query: string, window = 60): { pre: string; hit: string; post: string } | null {
  const q = query.trim().toLowerCase();
  const i = text.toLowerCase().indexOf(q);
  if (!q || i < 0) return null;
  let start = 0;
  let pre = text.slice(0, i);
  if (pre.length > window) {
    start = i - window;
    pre = '…' + text.slice(start, i);
  }
  let post = text.slice(i + q.length);
  if (post.length > window) post = post.slice(0, window) + '…';
  return { pre, hit: text.slice(i, i + q.length), post };
}
