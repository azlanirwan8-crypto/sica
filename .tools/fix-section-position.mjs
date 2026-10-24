/**
 * fix-section-position.mjs — pemindahan umum: kalau sebuah sub-bagian `### 5.x` jatuh DI BAWAH
 * heading `## 10. Riwayat laporan` (hasil samping dari applier yang menyisip setelah heading),
 * kembalikan ke depan §10. Dipakai dua kali: §5.53 (`RD-114`) dan §5.54 (`RD-115`).
 * Penggunaan: node .tools/fix-section-position.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const F = 'docs/PROGRESS_REPORT.md';
const lines = readFileSync(F, 'utf8').split(NL);

const iHead10 = lines.findIndex((l) => l.startsWith('## 10. Riwayat laporan (lanjutan)'));
if (iHead10 < 0) { console.error('MERAH — heading §10 tidak ditemukan.'); process.exit(1); }
const next = lines[iHead10 + 1] || '';
if (!/^### 5\.\d+ /.test(next)) { console.log('tidak ada yang dipindahkan — §10 sudah bersih.'); process.exit(0); }
const iStart = iHead10 + 1;
const label = next.match(/^### (5\.\d+)/)[1];
let iTab = -1;
for (let i = iStart; i < lines.length; i++) if (lines[i].startsWith('| Siklus |')) { iTab = i; break; }
if (iTab < 0) { console.error('MERAH — tabel riwayat sesudah blok tidak ditemukan.'); process.exit(1); }
let end = iTab - 1;
while (end > iStart && lines[end].trim() === '') end--;
const block = lines.slice(iStart, end + 1);
const rest = [...lines.slice(0, iHead10), ...block, '', lines[iHead10], ...lines.slice(end + 1)];
const out = [];
for (const l of rest) {
  if (l.trim() === '' && out.length >= 2 && out[out.length - 1].trim() === '' && out[out.length - 2].trim() === '') continue;
  out.push(l);
}
writeFileSync(F, out.join(NL));
console.log('§' + label + ' dipindahkan ke depan §10 · baris ' + lines.length + ' → ' + out.length + ' · blok ' + block.length + ' baris');
