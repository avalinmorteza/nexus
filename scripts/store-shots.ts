// Generates Chrome Web Store screenshots (1280x800) of the RELEASE build with sample data.
// Requires `npx vite preview --mode release --port 4174` running. Run: npx vite-node scripts/store-shots.ts
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sampleDB } from '../src/lib/sample';
import type { DB } from '../src/lib/types';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('Chrome not found');

const harnessDir = path.resolve('release/build/__shots');
const outDir = path.resolve('release/store');
fs.mkdirSync(harnessDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const base = sampleDB();
const act = (fa: boolean): DB['activity'] =>
  base.assets.slice(0, 5).map((a, i) => ({
    id: 'act' + i,
    type: i === 1 ? 'asset.renewed' : 'asset.created',
    itemType: 'asset',
    itemId: a.id,
    itemName: a.name,
    summary: i === 1 ? (fa ? 'تمدید تا ۱۴۰۶' : 'Renewed until Nov 2027') : fa ? 'به دسته‌ها اضافه شد' : 'Added to Domains',
    at: Date.now() - (i + 1) * 3600_000 * 3,
  }));

const shots: { name: string; hash: string; settings: Partial<DB['settings']>; fa: boolean }[] = [
  { name: '1-overview-fa', hash: '#/overview', fa: true, settings: { language: 'fa', calendar: 'jalali', weekStart: 6, theme: 'light', userName: 'مرتضی' } },
  { name: '2-shamsi-calendar-fa', hash: '#/calendar', fa: true, settings: { language: 'fa', calendar: 'jalali', weekStart: 6, theme: 'light' } },
  { name: '3-assets-en', hash: '#/assets', fa: false, settings: { language: 'en', calendar: 'gregorian', weekStart: 1, theme: 'light' } },
  { name: '4-overview-dark-en', hash: '#/overview', fa: false, settings: { language: 'en', calendar: 'gregorian', weekStart: 1, theme: 'dark', userName: 'Alex' } },
  { name: '5-tasks-fa', hash: '#/tasks?section=all', fa: true, settings: { language: 'fa', calendar: 'jalali', weekStart: 6, theme: 'light' } },
];

for (const s of shots) {
  const db: DB = { ...base, activity: act(s.fa), settings: { ...base.settings, ...s.settings } };
  fs.writeFileSync(
    path.join(harnessDir, `${s.name}.html`),
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}iframe{border:0;width:1280px;height:800px;display:block}</style>
<script>localStorage.clear();localStorage.setItem('nexus_db', ${JSON.stringify(JSON.stringify(db))});</script>
<iframe src="/dashboard.html${s.hash}"></iframe>`,
  );
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-shot-'));
  const out = path.join(outDir, `screenshot-${s.name}.png`);
  if (fs.existsSync(out)) fs.rmSync(out);
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
    '--window-size=1280,800',
    '--virtual-time-budget=6000',
    `--screenshot=${out}`,
    `http://localhost:4174/__shots/${s.name}.html`,
  ]);
  fs.rmSync(profile, { recursive: true, force: true });
  console.log('✓', path.basename(out), fs.statSync(out).size, 'bytes');
}
fs.rmSync(harnessDir, { recursive: true, force: true });
