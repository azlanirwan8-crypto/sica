import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

/* Nomor bagian wajib menaik di dalam berkas (norma penulisan dokumen SICA).
   Siklus ini menyisipkan 17 sebelum 16; naskah 17 dipindah ke ekor berkas tanpa mengubah isinya. */
const f = 'docs/AUDIT_READINESS.md';
let t = readFileSync(f, 'utf8');
const start = t.indexOf('## 17. Ketertelusuran pedoman per modul');
const end = t.indexOf('## 16. Riwayat tambahan (bagian 2)');
if (start < 0 || end < 0 || end < start) { console.error('penanda tidak ditemukan'); process.exit(1); }
const block = t.slice(start, end).replace(/\s+$/, '') + NL;
t = t.slice(0, start) + t.slice(end);
if (!t.endsWith(NL)) t += NL;
writeFileSync(f, t + NL + block, 'utf8');
console.log('pindah 17 ke ekor; panjang blok = ' + block.split(NL).length + ' baris');
