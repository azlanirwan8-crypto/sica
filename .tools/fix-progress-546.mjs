// Sekali-jalan: memperbaiki kerusakan heading yang saya timbulkan sendiri di docs/PROGRESS_REPORT.md.
// Gagal cepat bila asersi posisi tidak terpenuhi; tidak menulis apa pun sebelum semua asersi lolos.
import { readFileSync, writeFileSync } from 'node:fs';

const F = 'docs/PROGRESS_REPORT.md';
const NL = '\n';
const src = readFileSync(F, 'utf8');
const L = src.split(NL);

const idx = (pred, from = 0) => { for (let i = from; i < L.length; i++) if (pred(L[i])) return i; return -1; };

const i547 = idx((l) => l.startsWith('### 5.47 '));
const i11a = idx((l) => l.startsWith('## 11. '), i547);
const i11b = idx((l) => l.startsWith('## 11. '), i11a + 1);
const iTail = idx((l) => l.startsWith('**Yang TIDAK berubah dan harus tetap disebut.**'));
const iFence = (() => { for (let i = iTail - 1; i >= 0; i--) if (L[i] === '```') return i; return -1; })();

const fail = (m) => { console.error('ASERSI GAGAL: ' + m); process.exit(1); };
if (i547 < 0) fail('heading ### 5.47 tidak ditemukan');
if (i11a < 0 || i11b < 0) fail('heading ## 11. tidak duplikat (butuh dua)');
if (iTail < 0 || iTail > i547) fail('paragraf sisipan tidak berada sebelum ### 5.47');
if (iFence < 0 || iFence > i547) fail('penutup blok perintah ### 5.45 tidak ditemukan');
const oldHead = '### 5.46 Siklus 2026-10-21 (bagian 7) — dua celah terukur ditutup: `ddl-gap` dan `perm-phantom`';
if (L.some((l) => l.startsWith('### 5.46 '))) fail('heading 5.46 masih ada, file tidak seperti yang diharapkan');
const iOldTail = idx((l) => l.startsWith('**Yang TIDAK berubah'), i11a);
if (iOldTail < 0 || iOldTail > i11b) fail('paragraf penutup §5.46 asli tidak ditemukan di badannya');

const newTail =
  '**Yang TIDAK berubah dan harus tetap disebut.** Berkas `.sql` di disk tetap **7** (`G-02`); baris katalog `API_SPEC §7` yang berstatus `implemented` tetap **0** dari 324 — dan angka ini penting dibedakan dari "tidak ada kode", karena handler yang nyata ada diukur oleh `.tools/handler-inventory.mjs` (`PROGRESS §5.47`), bukan oleh kalimat saya; `KURANG` CRUD diukur oleh pemiliknya sesudah `RD-100` (**15 dari 48**, bukan 40 — 40 adalah angka formula lama yang sudah saya cabut); dan **9** residu `.reject`/`.export` masih hidup di daftar tambahan §4.2/§4.3 (`G-15`), nol di antaranya dikutip rute.';

const cmd547 = [
  '',
  '**Perintah untuk memeriksa ulang sendiri (sisi kode).**',
  '',
  '```bash',
  'node .tools/handler-inventory.mjs   # rute nyata vs baris katalog, helper penegakan, SEC-07, dependensi, seed, mobile',
  'node .tools/crud-matrix.mjs         # vonis CRUD per modul (15 dari 48 sesudah RD-100) — pemilik angka ini',
  'node .tools/crud-bill.mjs           # tagihan per modul: verba mana yang kurang, dari keluaran crud-matrix',
  '```',
  '',
];

const head546 = [oldHead, ''];
let body546 = L.slice(i11a + 1, iOldTail);               // isi §5.46 tanpa paragraf penutup lama
while (body546.length && body546[0].trim() === '') body546.shift();
const tail546 = [newTail, ''];
const block547 = L.slice(i547, i11a);                    // §5.47 apa adanya
const pre = L.slice(0, iFence + 1);                     // sampai penutup blok perintah §5.45
const between = L.slice(iTail + 1, i547);               // baris kosong di antara keduanya
const post = L.slice(i11b);                             // heading ## 11. asli + tabel riwayat + EOF

const out = [...pre, ...between, ...head546, ...body546, ...tail546, ...block547, ...cmd547, ...post].join(NL);

// Penjaga bentuk hasil
const O = out.split(NL);
const count = (p) => O.filter(p).length;
if (count((l) => l.startsWith('### 5.46 ')) !== 1) fail('hasil: heading 5.46 bukan tepat 1');
if (count((l) => l.startsWith('### 5.47 ')) !== 1) fail('hasil: heading 5.47 bukan tepat 1');
if (count((l) => l.startsWith('## 11. Riwayat laporan')) !== 1) fail('hasil: ## 11. bukan tepat 1');
if (count((l) => l.startsWith('**Yang TIDAK berubah')) !== 1) fail('hasil: paragraf penutup ganda');
const a46 = O.findIndex((l) => l.startsWith('### 5.46 '));
const a47 = O.findIndex((l) => l.startsWith('### 5.47 '));
const a11 = O.findIndex((l) => l.startsWith('## 11. Riwayat laporan'));
if (!(a46 < a47 && a47 < a11)) fail('hasil: urutan §5.46 → §5.47 → §11 salah');
if (O[a46 + 2].indexOf('Yang diminta') < 0) fail('hasil: badan §5.46 tidak mengikuti heading-nya');

writeFileSync(F, out, 'utf8');
console.log('DIPULIHKAN: §5.46 heading dipulihkan di baris ' + (a46 + 1) +
  ', §5.47 di ' + (a47 + 1) + ', ## 11. tunggal di ' + (a11 + 1) +
  ' · paragraf penutup lama dibuang (' + (iOldTail + 1) + ') · baris ' + L.length + ' → ' + O.length);
