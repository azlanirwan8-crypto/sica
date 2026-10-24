import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? '.';
const checks = [
  ['stale token --sica-color-', /--sica-color-/g],
  ['font-black/font-extrabold', /\bfont-(black|extrabold)\b/g],
  ['gray-* ramp', /\bgray-[0-9]00\b/g],
  ['bg-white opak', /\bbg-white\b/g],
  ['text-black', /\btext-black\b/g],
  ['hex warna', /#[0-9a-fA-F]{6}\b/g],
  ['outline-none tanpa ring', /outline-none(?!.*ring)/g],
  ['spinner animate-spin', /animate-spin/g],
];
const totals = new Map(checks.map(([n]) => [n, 0]));
const perFile = [];
let files = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (!/\.(tsx|ts)$/.test(e.name)) continue;
    files++;
    const text = fs.readFileSync(full, 'utf8');
    const row = { file: full, hits: {} };
    for (const [name, re] of checks) {
      const m = text.match(re);
      if (m && m.length) {
        row.hits[name] = m.length;
        totals.set(name, totals.get(name) + m.length);
      }
    }
    if (Object.keys(row.hits).length) perFile.push(row);
  }
}
walk(root);
for (const r of perFile) console.log(r.file.replace(/\\/g, '/') + '  ' + JSON.stringify(r.hits));
console.log('---');
for (const [name] of checks) console.log(name + ' = ' + totals.get(name));
console.log('tsFilesScanned = ' + files);
