import { readFileSync, writeFileSync } from 'node:fs';
const f = '.tools/route-count.mjs';
let t = readFileSync(f, 'utf8');
const pairs = [
  ['const METH = /^(GET|POST|PATCH|PUT|DELETE|WS)\\b/;',
   'const METH = /^(GET|POST|PATCH|PUT|DELETE|WS)\\b/;\n// Tiga sub-bagian §7 bukan tabel rute: register kode error, rekap jumlah, dan aturan pakai.\n// Dulu alat ini mengecualikannya dengan memotong di `### 7.23` — cara itu membuat posisi blok di file\n// menentukan angka. Sekarang judul bagian yang menentukan, jadi memindah blok tidak mengubah hasil.\nconst BUKAN_TABEL_RUTE = /Rekap|Aturan pakai|Kode error|Pelengkap CRUD/;'],
  ['  const h = b[i].match(/^#### (7\\.\\d+)/);\n  if (h) { cur = h[1]; if (!groups.has(cur)) groups.set(cur, { rows: 0, spec: 0, block: 0, impl: 0, heads: [] }); continue; }',
   '  const h = b[i].match(/^#### (7\\.\\d+)([^\\n]*)$/);\n  if (h) { cur = h[1]; if (BUKAN_TABEL_RUTE.test(h[2] || \'\')) { cur = null; continue; } if (!groups.has(cur)) groups.set(cur, { rows: 0, spec: 0, block: 0, impl: 0, heads: [] }); continue; }'],
  ['    const h2 = b[i].match(/^### (7\\.\\d+)/);\n    cur = h2[1];',
   '    const h2 = b[i].match(/^### (7\\.\\d+)([^\\n]*)$/);\n    cur = h2[1];\n    if (BUKAN_TABEL_RUTE.test(h2[2] || \'\')) { cur = null; continue; }'],
];
for (const [a, b] of pairs) {
  if (!t.includes(a)) { console.error('ANCHOR route-count hilang: ' + a.slice(0, 40)); continue; }
  t = t.replace(a, b);
}
writeFileSync(f, t, 'utf8');
console.log('route-count diperbarui');
