import fs from 'node:fs';
import path from 'node:path';

const old = [
  '--sica-color-primary',
  '--sica-color-primary-hover',
  '--sica-color-primary-light',
  '--sica-color-secondary',
  '--sica-color-success',
  '--sica-color-info',
  '--sica-color-warning',
  '--sica-color-danger',
  '--sica-bg-card',
  '--sica-bg-body',
  '--sica-bg-sidebar',
  '--sica-border',
  '--sica-radius-pill',
  '--sica-text-sidebar-active',
  '--sica-text-sidebar',
];

const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(tsx?|css)$/.test(e.name)) files.push(full);
  }
}
walk('apps/web/src');

const bridgeStart = files.find((f) => f.endsWith('velzon-theme.css'));
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (f === bridgeStart && i >= 306 && i <= 340) return;
    for (const name of old) {
      // hanya laporkan PENGGUNAAN var(--nama), bukan definisi `--nama:` di bridge
      const used = line.includes('var(' + name + ')') || line.includes('var(' + name + ',');
      if (used) console.log(path.relative('.', f) + ':' + (i + 1) + ' memakai ' + name);
    }
  });
}
console.log('pemindaian selesai files=' + files.length);
