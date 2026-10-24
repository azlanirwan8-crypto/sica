import fs from 'node:fs';
import path from 'node:path';

const root = 'apps/web/src';
const needles = ['bg-primary', 'text-primary', 'border-primary', 'bg-destructive', 'text-destructive', 'ring-primary', 'from-primary', 'via-primary', 'to-primary'];
const counts = new Map(needles.map((n) => [n, 0]));
const perFile = new Map();

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (!/\.(tsx|ts)$/.test(e.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const n of needles) {
      const c = (text.match(new RegExp('(?<![a-z-])' + n.replace(/[-]/g, '\\-') + '(?![a-z-])', 'g')) || []).length;
      if (c) {
        counts.set(n, counts.get(n) + c);
        if (!perFile.has(n)) perFile.set(n, []);
        perFile.get(n).push(path.basename(full) + ':' + c);
      }
    }
  }
}
walk(root);
for (const n of needles) console.log(n.padEnd(18) + String(counts.get(n)).padStart(4) + '  ' + (perFile.get(n) || []).slice(0, 12).join(' '));
