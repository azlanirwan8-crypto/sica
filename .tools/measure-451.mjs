import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const src = readFileSync('C:/SICA/docs/RBAC_MATRIX.md', 'utf8');
const lines = src.split(NL);
const start = lines.findIndex((l) => l.startsWith('#### 4.5.1'));
const end = lines.findIndex((l) => l.startsWith('### 4.6 '));
if (start === -1 || end === -1) { console.log('MISS section'); process.exit(1); }

const rows = [];
for (let i = start; i < end; i++) {
  const m = lines[i].match(/^\|\s*(\d+)\s*\|/);
  if (m) rows.push({ n: Number(m[1]), line: lines[i] });
}
const nums = rows.map((r) => r.n);
console.log('rows=' + rows.length + ' min=' + Math.min(...nums) + ' max=' + Math.max(...nums));
const dup = nums.filter((v, i) => nums.indexOf(v) !== i);
console.log('dup=' + (dup.length ? dup.join(',') : 'none'));
const gaps = [];
for (let v = Math.min(...nums); v <= Math.max(...nums); v++) if (!nums.includes(v)) gaps.push(v);
console.log('gaps=' + (gaps.length ? gaps.join(',') : 'none'));

let hi = -1;
for (let i = start; i < end; i++) if (/^\| # \| Permission \| Modul \|/.test(lines[i])) { hi = i; break; }
if (hi === -1) { console.log('MISS header'); process.exit(1); }
const header = lines[hi].split('|').slice(1, -1).map((c) => c.trim());
console.log('columns=' + JSON.stringify(header));
const moduleIdx = header.findIndex((h) => /^modul$/i.test(h));
console.log('module column index=' + moduleIdx + ' name=' + header[moduleIdx]);

const tally = new Map();
for (const r of rows) {
  const cells = r.line.split('|').slice(1, -1).map((c) => c.trim());
  const mod = cells[moduleIdx];
  tally.set(mod, (tally.get(mod) ?? 0) + 1);
}
const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, v] of sorted) console.log(String(v).padStart(4) + '  ' + k);
console.log('distinct=' + sorted.length);
