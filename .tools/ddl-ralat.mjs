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

/* 1 — BLUEPRINT §4.1: satu kalimat konvensi pemilik DDL */
job('BLUEPRINT_ENTERPRISE.md', 'bp-convention',
  'Setiap tabel domain **wajib** membawa `tenant_id uuid NOT NULL`',
  [
    '**Pemilik nama (ditetapkan 2026-10-21 setelah pengukuran, `RD-64`).** Kolom `Field` di bawah adalah **bidang pembanding** — bukti apa yang ada di layar Sevima / skema Feeder / aturan regulasi — bukan spesifikasi kolom SICA. Dari 79 nama entitas di §4, **51** sudah punya `CREATE TABLE` di `DATA_MODEL.md`; untuk 51 nama itu `DATA_MODEL` adalah satu-satunya pemilik bentuk kolom, dan §4 tidak boleh dibaca sebagai definisi kedua. Yang tidak ada di `DATA_MODEL` (28 nama, umumnya berpenanda 🧩) adalah permintaan objek baru: ia harus masuk `DATA_MODEL` lebih dulu sebelum masuk migrasi. Gerbang mesin: `node .tools/ddl-owner.mjs` — ia menolak (a) nama `CREATE TABLE` yang didefinisikan dua kali dan (b) nama §4 yang bentuknya disebut di dua dokumen tanpa pointer pemilik.',
    '',
    'Setiap tabel domain **wajib** membawa `tenant_id uuid NOT NULL`',
  ].join(NL));

/* 2 — RD-63 dan RD-64 di AUDIT_READINESS */
job('AUDIT_READINESS.md', 'rd-63-64',
  'Sebelum menulis "angka ini salah", jalankan dulu alat ukur pemilik angkanya |',
  [
    'Sebelum menulis "angka ini salah", jalankan dulu alat ukur pemilik angkanya |',
    '| RD-63 | **Satu nama tabel, dua `CREATE TABLE` yang saling meniadakan.** Pemindaian seluruh `CREATE TABLE` di `DATA_MODEL` (291 pernyataan, 290 nama unik) menemukan tepat satu nama yang didefinisikan dua kali: `fee_tariff_groups` — di §5 sebagai sketsa inti (`scheme` dengan CHECK `FLAT_UKT`/`PER_SKS`/`MIXED`) dan di §19.4 sebagai bentuk lengkap (`component`, `billing_basis`, `payable_to`, `gl_account_code`, `feeder_cost_kind`, `version`; migrasi `0046`). §5 menyebut dirinya "ringkas namun mengikat" dan §19.4 ditunjuk oleh `tuition_tariff_matrix.fee_group_id`, jadi keduanya mengikat sekaligus bertabrakan: `CHECK` pertama menolak kosakata komponen yang dipakai matriks tarif, dan migrasi kedua gagal berjalan. Kelas cacat persis yang dilarang permintaan pemilik ("dilarang duplikasi tabel DB"). Diperiksa juga: tabel ini **belum pernah diterapkan** — `grep -c fee_tariff_groups` atas tujuh berkas migrasi = **0**, sehingga pencabutan tidak mengubah keadaan DB | MAJOR (satu nama, dua kebenaran) | §5 diganti pointer ke §19.4; ukuran setelah ralat: **290 pernyataan / 290 unik / nol duplikasi**. Gerbang: `.tools/ddl-owner.mjs` wajib hijau sebelum migrasi `0046` dan sebelum `0051`–`0072` ditulis |',
    '| RD-64 | **Peta field `BLUEPRINT §4` bersaing dengan pemilik DDL.** Terukur: §4 memuat 79 baris entitas dan **51** di antaranya punya `CREATE TABLE` di `DATA_MODEL` (contoh: `enrollments`, `grades`, `invoices`, `class_schedules`, `fee_tariff_groups`). Kolom `Field` di §4 memakai kosakata pembanding Sevima (`scheme_id`, `route_code`, `gate_actions jsonb`) yang tidak sama dengan kolom hasil rancangan `DATA_MODEL`, dan tidak ada satu pun baris yang menyatakan siapa pemiliknya | MAJOR (dua sumber kebenaran) | Konvensi ditulis di kepala §4.1: `Field` = bukti benchmark, dan untuk 51 nama itu `DATA_MODEL` pemilik tunggal. 28 nama tanpa DDL diperlakukan sebagai **permintaan objek baru** (masuk `DATA_MODEL` lebih dulu, pola `AGENTS §3.11`). Gerbang mesin `.tools/ddl-owner.mjs` memeriksa keduanya |',
  ].join(NL));

console.log(rep.join(NL));
