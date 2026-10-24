import fs from 'node:fs';
import path from 'node:path';

const root = 'apps/web';
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(root);

for (const f of files) {
  if (!/\.(tsx|ts|css|js)$/.test(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (/velzon-theme/.test(l)) console.log(path.relative(root, f) + ':' + (i + 1) + '  ' + l.trim().slice(0, 120));
  });
}
console.log('--- postcss config ---');
for (const cand of ['postcss.config.js', 'postcss.config.mjs', 'postcss.config.json']) {
  const p = path.join(root, cand);
  if (fs.existsSync(p)) console.log(cand + ' ADA:\n' + fs.readFileSync(p, 'utf8'));
}
const rp = path.join('apps', 'web', 'src', 'app', 'globals.css');
console.log('--- globals.css 12 baris pertama ---');
fs.readFileSync(rp, 'utf8').split('\n').slice(0, 12).forEach((l, i) => console.log((i + 1) + ': ' + l));
