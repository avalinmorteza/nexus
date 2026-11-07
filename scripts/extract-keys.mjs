import fs from 'fs'; import path from 'path';
const files = []; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'locales') walk(p); } else if (/\.(ts|tsx)$/.test(f)) files.push(p); } }; walk('src');
const keys = new Set();
const lit = `(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')`;
const reT = new RegExp(`\\b(?:tr|t)\\(\\s*${lit}`, 'g');
const reTn = new RegExp(`\\btn\\([^,]+,\\s*${lit}\\s*,\\s*${lit}`, 'g');
for (const f of files) { const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(reT)) keys.add((m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
  for (const m of s.matchAll(reTn)) { keys.add(m[1] ?? m[2]); keys.add(m[3] ?? m[4]); }
  // top-level label arrays / maps translated at render
  for (const m of s.matchAll(/\blabel: '([^']+)'/g)) keys.add(m[1]);
  for (const m of s.matchAll(/^\s+(?:expirations|today|activity|quick|monthly): ['"]([^'"]+)['"]/gm)) keys.add(m[1]);
}
fs.writeFileSync('scripts/i18n-keys.json', JSON.stringify([...keys].filter(Boolean).sort(), null, 0));
console.log(keys.size);
