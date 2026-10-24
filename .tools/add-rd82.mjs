import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const P = 'C:/SICA/docs/AUDIT_READINESS.md';
const lines = readFileSync(P, 'utf8').split(NL);
const i = lines.findIndex((l) => l.startsWith('| `RD-81` |'));
if (i === -1) { console.log('baris RD-81 tidak ditemukan — tidak ada yang diubah'); process.exit(1); }
if (lines.some((l) => l.startsWith('| `RD-82` |'))) { console.log('SKIP — RD-82 sudah ada'); process.exit(0); }
lines.splice(i + 1, 0,
  '| `RD-82` | Setelah dimensi baru dipasang, gerbang itu sendiri langsung menemukan dua cacat lagi: **`### 2.20` mendahului `### 2.19`** di ROADMAP (urutan nomor terbalik sejak siklus lalu, tidak terlihat oleh siapa pun karena tidak ada alat yang memindai sub-heading), dan §15.8 milik dokumen ini sempat tersisip **sebelum** §15.7 — cacat yang saya timbulkan sendiri pada jam yang sama | `ROADMAP_TASKS` + `.tools/heading-dup.mjs` | **ditutup dalam siklus ini**: blok §2.19/§2.20 ditukar (urutan 2.1→2.21 naik, terverifikasi alat), §15.8 dipindah ke tempatnya, dan `heading-dup` diperluas dari hanya `##` menjadi `##`/`###`/`####` dengan pemeriksaan `sub-mundur` — supaya kelas cacat ini tidak bergantung pada kebetulan kedalaman heading |');
writeFileSync(P, lines.join(NL), 'utf8');
console.log('RD-82 ditambahkan sesudah RD-81 (baris ' + (i + 2) + ')');
