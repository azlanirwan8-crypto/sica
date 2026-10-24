// Sekali-jalan: menyisipkan blok §5.49 dan baris riwayat 5.49 ke PROGRESS_REPORT.
// Idempoten: kalau §5.49 atau baris | 5.49 | sudah ada, tidak ada yang ditulis.
import { readFileSync, writeFileSync } from 'node:fs';

const P = 'docs/PROGRESS_REPORT.md';
const L = readFileSync(P, 'utf8').split('\n');
const anchor = L.findIndex((l) => l.startsWith('## 11. Riwayat laporan (bagian 3)'));
if (anchor < 0) { console.error('ASERSI GAGAL — heading ## 11. tidak ditemukan'); process.exit(1); }

let changed = 0;
if (L.some((l) => l.startsWith('### 5.49 '))) {
  console.log('§5.49 sudah ada, dilewati');
} else {
  const blk = readFileSync('.tools/progress-549-block.md', 'utf8').replace(/\n+$/, '').split('\n');
  L.splice(anchor, 0, ...blk);
  changed++;
}

const rowIdx = L.findIndex((l) => l.startsWith('| 5.48 |'));
if (rowIdx < 0) { console.error('ASERSI GAGAL — baris riwayat 5.48 tidak ditemukan (penjangkar baris baru)'); process.exit(1); }
if (L.some((l) => l.startsWith('| 5.49 |'))) {
  console.log('baris 5.49 sudah ada, dilewati');
} else {
  L.splice(rowIdx + 1, 0, readFileSync('.tools/row-549.md', 'utf8').replace(/\n+$/, ''));
  changed++;
}

const h = L.findIndex((l) => l.startsWith('### 5.48 '));
const g = L.findIndex((l) => l.startsWith('### 5.49 '));
const i11 = L.findIndex((l) => l.startsWith('## 11. Riwayat laporan (bagian 3)'));
if (!(h >= 0 && g > h && i11 > g)) { console.error('ASERSI GAGAL — urutan §5.48 → §5.49 → ## 11. rusak'); process.exit(1); }

if (!changed) { console.log('tidak ada perubahan'); process.exit(0); }
writeFileSync(P, L.join('\n'), 'utf8');
console.log('§5.49 di baris ' + (g + 1) + ' · ## 11. di baris ' + (i11 + 1) + ' · baris berkas → ' + L.length);
