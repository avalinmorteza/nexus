import fs from 'fs';
const keys = JSON.parse(fs.readFileSync('scripts/i18n-keys.json','utf8'));
const src = fs.readFileSync('src/lib/locales/fa.ts','utf8');
const have = new Set();
for (const m of src.matchAll(/^\s+(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z_]\w*)):/gm)) have.add((m[1] ?? m[2] ?? m[3]).replace(/\\'/g,"'"));
const miss = keys.filter(k => !have.has(k) && /[A-Za-z]{2,}/.test(k));
console.log(miss.length + ' missing'); console.log(JSON.stringify(miss));
