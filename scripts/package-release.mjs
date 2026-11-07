// Packages release/build into release/nexus-<version>.zip for the Chrome Web Store / Edge Add-ons.
// Run via: npm run release
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve('.');
const build = path.join(root, 'release', 'build');
const manifest = JSON.parse(fs.readFileSync(path.join(build, 'manifest.json'), 'utf8'));
const version = manifest.version;

// 1) third-party licenses shipped with the package
const lic = path.join(build, 'licenses');
fs.mkdirSync(lic, { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/@fontsource-variable/vazirmatn/LICENSE'), path.join(lic, 'Vazirmatn-OFL.txt'));
fs.writeFileSync(
  path.join(lic, 'README.txt'),
  [
    'NEXUS bundles these third-party components:',
    '- Vazirmatn font — SIL Open Font License 1.1 (Vazirmatn-OFL.txt)',
    '- React, React DOM — MIT License',
    '- Lucide icons — ISC License',
    '',
  ].join('\n'),
);

// 2) safety checks: nothing private or non-redistributable in the package
const files = [];
const walk = (d) => fs.readdirSync(d).forEach((f) => (fs.statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : files.push(path.join(d, f))));
walk(build);
const bad = files.filter((f) => /peyda|nexus-import|\.map$/i.test(f));
if (bad.length) throw new Error('Refusing to package — found: ' + bad.join(', '));
const text = files.filter((f) => /\.(js|css|html|json)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
// extra private strings (one per line) can live in imports/.private-needles.txt — that folder is never published
const privateNeedles = fs.existsSync(path.join(root, 'imports/.private-needles.txt'))
  ? fs.readFileSync(path.join(root, 'imports/.private-needles.txt'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  : [];
for (const needle of ['Peyda', ...privateNeedles]) {
  if (text.includes(needle)) throw new Error(`Refusing to package — build contains "${needle}"`);
}
if (!manifest.icons?.['128'] || !fs.existsSync(path.join(build, manifest.icons['128']))) throw new Error('Missing 128px icon');

// 3) zip (manifest.json must be at the zip root)
const zip = path.join(root, 'release', `nexus-${version}.zip`);
if (fs.existsSync(zip)) fs.rmSync(zip);
if (process.platform === 'win32') {
  // Windows PowerShell's Compress-Archive writes "\" in entry names, which stores reject — build entries with "/" explicitly.
  const ps = `
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$root = '${build}'
$z = [System.IO.Compression.ZipFile]::Open('${zip}', 'Create')
Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1).Replace('\\', '/')
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $_.FullName, $rel, 'Optimal')
}
$z.Dispose()`;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-q', zip, '.'], { cwd: build, stdio: 'inherit' });
}
const kb = (fs.statSync(zip).size / 1024).toFixed(0);
console.log(`\n✓ release/nexus-${version}.zip (${kb} KB, ${files.length + 2} files) — ready to upload`);
