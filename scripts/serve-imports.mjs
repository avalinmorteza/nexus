// Tiny local-only server so the dashboard preview can fetch files from ./imports (dev use only).
import http from 'http';
import fs from 'fs';
import path from 'path';
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../imports');
http
  .createServer((req, res) => {
    const name = path.basename(decodeURIComponent((req.url || '').split('?')[0]));
    const file = path.join(dir, name);
    const origin = req.headers.origin || '';
    if (/^http:\/\/localhost:\d+$/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    if (!name.endsWith('.json') || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(fs.readFileSync(file));
  })
  .listen(4175, '127.0.0.1', () => console.log('serving imports on http://localhost:4175'));
