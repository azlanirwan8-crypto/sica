import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];
const job = (file, label, a, b) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const i = s.indexOf(a);
  if (i === -1) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(file + ' ' + label + ': AMBIG'); return; }
  writeFileSync(p, s.slice(0, i) + b + s.slice(i + a.length), 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

job('PROGRESS_REPORT.md', 'ralat-row-7-8',
  '`.tools/measure-451.mjs` atas kolom ketiga baris 162–291 |',
  [
    '`.tools/measure-451.mjs` atas kolom ketiga baris 162–291 |',
    '| 7 | Satu nama tabel, dua `CREATE TABLE` | `fee_tariff_groups` didefinisikan dua kali: §5 inti (`scheme`, CHECK `FLAT_UKT`/`PER_SKS`/`MIXED`) dan §19.4 lengkap (`component`, `billing_basis`, `gl_account_code`, `feeder_cost_kind`; migrasi `0046`). §5 dicabut dan diganti pointer → `RD-63` | pemindaian nama `CREATE TABLE` di `DATA_MODEL`: sebelum **291 pernyataan / 290 unik / 1 duplikat**, sesudah **290 / 290 / nol**. Dibuktikan juga tabel ini belum diterapkan: `grep -c` atas tujuh berkas migrasi = **0** |',
    '| 8 | Peta field bersaing dengan pemilik DDL | 79 baris entitas di `BLUEPRINT §4`, **51** di antaranya sudah punya `CREATE TABLE` di `DATA_MODEL`, memakai kosakata kolom yang berbeda (`scheme_id`, `route_code`, `gate_actions`) tanpa menyatakan siapa pemiliknya → konvensi ditulis di kepala §4.1 → `RD-64` | `.tools/ddl-owner.mjs` (gerbang baru): melaporkan jumlah bersinggungan dan menolak nama ganda. Status sekarang: **HIJAU** |',
  ].join(NL));

console.log(rep.join(NL));
