import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

const OWNER = [
  ['Dosen', 'M-04 M-06 M-07 M-08 M-13 M-16 M-18 M-19 M-20 M-21 M-22 M-39 M-44'],
  ['Mahasiswa', 'M-04 M-10 M-11 M-13 M-16 M-17 M-18 M-19 M-20 M-24 M-25 M-26 M-27 M-28 M-38 M-39 M-41 M-42 M-43 SuperApp'],
  ['Kaprodi/Dekan', 'M-07 M-12 M-13 M-14 M-19 M-20 M-25 M-30 M-31 M-37 M-38 M-44'],
  ['Staff BAAK/BAUK/Sarpras', 'M-09 M-10 M-11 M-14 M-15 M-23 M-30 M-33 M-35 M-40 M-46'],
  ['Rektorat/Eksekutif', 'M-10 M-29 M-31 M-32 M-36 M-37 M-44 M-45 M-47'],
  ['Super Admin/Admin IT', 'M-01 M-02 M-03 M-04 M-05 M-34 M-35 M-40'],
];

const ui = readFileSync(D + 'UI_UX_DESIGN.md', 'utf8').split(NL);
const blocks = [];
let cur = null;
for (const l of ui) {
  const h = l.match(/^#### 17\.2\.(\d+)\s+(.+?)\s*\((\d+)\s*kartu/);
  if (h) { cur = { no: h[1], title: h[2], claimed: Number(h[3]), cards: new Set() }; blocks.push(cur); continue; }
  if (/^### 17\.3/.test(l)) break;
  const m = l.match(/^\|\s*(M-\d{2}|APP)\s*\|/);
  if (m && cur) cur.cards.add(m[1]);
}

const map = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
console.log('| Peran (pemilik) | blok §17.2 | diklaim | terukur | cocok dgn permintaan | kurang | berlebih |');
console.log('|---|---|---:|---:|---:|---|---|');
let bad = 0;
OWNER.forEach(([role, list], i) => {
  const b = blocks[i];
  const want = list.split(/\s+/).map((x) => (x === 'SuperApp' ? 'APP' : x));
  const have = b ? b.cards : new Set();
  const missing = want.filter((w) => !have.has(w));
  const extra = [...have].filter((h) => !want.includes(h));
  const countOk = b && b.claimed === have.size;
  if (missing.length || extra.length || !countOk) bad++;
  console.log('| ' + role + ' | ' + (b ? b.title.slice(0, 26) : '—') + ' | ' + (b ? b.claimed : '—') + ' | ' + have.size +
    ' | ' + want.filter((w) => have.has(w)).length + '/' + want.length + ' | ' + (missing.join(',') || '—') +
    ' | ' + (extra.join(',') || '—') + (b && !countOk ? ' (klaim jumlah salah)' : '') + ' |');
});
console.log('');
console.log('blok=' + blocks.length + ' total kartu=' + blocks.reduce((a, b) => a + b.cards.size, 0) +
  ' · peran tidak sinkron = ' + bad + ' dari ' + OWNER.length);
