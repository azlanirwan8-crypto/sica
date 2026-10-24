import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

/* Perbaiki urutan: §15.8 tersisip SEBELUM §15.7 — saya membuat tepat cacat yang baru saja
   saya pasangkan gerbangnya, karena gerbang itu hanya memeriksa heading tingkat-2.
   Blok §15.8 dipindah ke akhir §15, tepat sebelum `## 16.` */
const P = 'C:/SICA/docs/AUDIT_READINESS.md';
let lines = readFileSync(P, 'utf8').split(NL);
const start = lines.findIndex((l) => l.startsWith('### 15.8 '));
const end = lines.findIndex((l, i) => i > start && /^### 15\.7 /.test(l));
const tail = lines.findIndex((l) => /^## 16\./.test(l));
if (start === -1 || end === -1 || tail === -1) { console.log('anchor tidak ditemukan (start=' + start + ' end=' + end + ' tail=' + tail + '); tidak ada yang diubah'); process.exit(1); }
const block = lines.slice(start, end);
const rest = lines.slice(0, start).concat(lines.slice(end));
const at = rest.findIndex((l) => /^## 16\./.test(l));
lines = rest.slice(0, at).concat(block, [''], rest.slice(at));
writeFileSync(P, lines.join(NL), 'utf8');
console.log('§15.8 dipindah setelah §15.7 (blok ' + block.length + ' baris)');
console.log('urutan §15.x: ' + lines.filter((l) => /^### 15\.\d/.test(l)).map((l) => l.match(/15\.\d/)[0]).join(' → '));
