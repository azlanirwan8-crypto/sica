import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const b = readFileSync('C:/SICA/docs/API_SPEC.md', 'utf8').split(NL);
const start = b.findIndex((l) => /^### 7\.1\b/.test(l));
// Batas bawah bukan nama sub-bagian yang hardcode (dulu `### 7.23`): blok §7.25–§7.32 pernah
// dibaca atau tidak hanya karena POSISINYA di file, dan itu menghasilkan dua angka berbeda (267 vs 308).
// Aturan: seluruh isi `## 7.` sampai heading `## ` berikutnya, apa pun urutan sub-bagianya.
let end = b.length;
for (let i = start + 1; i < b.length; i++) { if (/^## /.test(b[i])) { end = i; break; } }
const METH = /^(GET|POST|PATCH|PUT|DELETE|WS)\b/;
// Tiga sub-bagian §7 bukan tabel rute: register kode error, rekap jumlah, dan aturan pakai.
// Dulu alat ini mengecualikannya dengan memotong di `### 7.23` — cara itu membuat posisi blok di file
// menentukan angka. Sekarang judul bagian yang menentukan, jadi memindah blok tidak mengubah hasil.
const BUKAN_TABEL_RUTE = /Rekap|Aturan pakai|Kode error|Pelengkap CRUD/;
const groups = new Map();
let cur = null;
for (let i = start; i < end; i++) {
  const h = b[i].match(/^#### (7\.\d+)([^\n]*)$/);
  if (h) { cur = h[1]; if (BUKAN_TABEL_RUTE.test(h[2] || '')) { cur = null; continue; } if (!groups.has(cur)) groups.set(cur, { rows: 0, spec: 0, block: 0, impl: 0, heads: [] }); continue; }
  if (/^### 7\.\d+/.test(b[i])) {
    const h2 = b[i].match(/^### (7\.\d+)([^\n]*)$/);
    cur = h2[1];
    if (BUKAN_TABEL_RUTE.test(h2[2] || '')) { cur = null; continue; }
    if (!groups.has(cur)) groups.set(cur, { rows: 0, spec: 0, block: 0, impl: 0, heads: [] });
    continue;
  }
  if (!cur || !b[i].startsWith('|')) continue;
  const c1 = (b[i].split('|')[1] || '').trim().replace(/`/g, '');
  if (!METH.test(c1)) continue;
  const g = groups.get(cur);
  g.rows++;
  const line = b[i];
  if (/implemented/.test(line)) g.impl++;
  else if (/spec-only/.test(line)) g.spec++;
  else if (/blocker/.test(line)) g.block++;
}
let tr = 0, ts = 0, tb = 0, ti = 0;
const rows = [];
for (const [k, v] of groups) {
  rows.push('| §7.' + k.split('.')[1] + ' | ' + v.rows + ' | ' + v.spec + ' | ' + v.block + ' | ' + v.impl + ' |');
  tr += v.rows; ts += v.spec; tb += v.block; ti += v.impl;
}
console.log('| Gugus | Baris | spec-only | blocker | implemented |' + NL + '|---|---:|---:|---:|---:|' + NL + rows.join(NL));
console.log('TOTAL rows=' + tr + ' spec=' + ts + ' blocker=' + tb + ' impl=' + ti + ' groups=' + groups.size);
console.log('unclassified=' + (tr - ts - tb - ti));
