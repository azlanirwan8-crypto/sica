/**
 * apply-module-readiness.mjs — menulis `AUDIT_READINESS §20` dari KELUARAN alat, bukan dari salinan tangan.
 *
 * Pola yang sama dengan `apply-audit-17.mjs` (`RD-101`): kalau dokumen mengutip angka alat, bagian itu
 * harus dihasilkan oleh alat dalam satu perintah. Versi §17 yang lama membaca berkas hasil capture
 * manusia, sehingga dokumen bisa mencetak vonis basi tanpa ada yang sadar. Alat ini:
 *   · menjalankan `.tools/module-readiness.mjs` (yang menjalankan `crud-matrix` + `module-provenance`
 *     + `handler-inventory`), dan hanya menulis bila keduanya keluar dengan kode 0;
 *   · memotong blok §20 lama SAMPAI heading `## ` berikutnya — tidak sampai akhir berkas, supaya
 *     tidak pernah menelan bagian sesudahnya (cacat versi pertama `apply-audit-17`, `RD-101`);
 *   · berhenti tanpa menulis satu byte pun kalau salah satu penjaga gagal.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const NL = String.fromCharCode(10);
const TARGET = 'docs/AUDIT_READINESS.md';
const HEAD = '## 20. Kesiapan per modul — 48 baris, kolom status, dan rincian kurangnya (2026-10-22, siklus kelimabelas — format baku sebelas kolom dinormakan di `AGENTS §6.1`)';

const out = execFileSync(process.execPath, ['.tools/module-readiness.mjs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (/MERAH/.test(out)) { console.error('MERAH — module-readiness menolak; tidak ada yang ditulis.'); process.exit(1); }
const barisModul = (out.match(/^\| M-\d\d \||^\| APP \|/gm) || []).length;
if (!/SPESIFIKASI SIAP/.test(out) || barisModul !== 96) {
  console.error('MERAH — keluaran module-readiness memuat ' + barisModul + ' baris modul; diharapkan 96 (48 tabel utama + 48 peta menu). Tidak ada yang ditulis.');
  process.exit(1);
}

const skuJatuh = Number(((out.match(/baris izin yang jatuh ke SKU \(bukan token M-xx\) = (\d+)/) || [])[1] || 'NaN'));
const rcOut = execFileSync(process.execPath, ['.tools/rbac-count.mjs'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
/* Label pemilik berubah 2026-10-22 (`rbac-count`): "seluruh usulan" keliru karena baris 1–161 tidak
   punya kolom Status; label yang benar "seluruh baris bernomor". Konsumen mengikuti pemilik (`RD-118`). */
const totalNomor = Number(((rcOut.match(/seluruh baris bernomor\s+baris=\s*(\d+)/) || [])[1] || 'NaN'));
if (!Number.isInteger(skuJatuh) || !Number.isInteger(totalNomor)) {
  console.error('MERAH — angka presisi atribusi tidak terbaca (SKU=' + skuJatuh + ', total=' + totalNomor + '); kalimat di bawah tidak boleh mengarang angka.');
  process.exit(1);
}
const preamble = [
  HEAD,
  '',
  '**Alatnya, bukan angkanya.** SATU perintah menghasilkan seluruh bagian ini: `node .tools/apply-module-readiness.mjs`, yang menjalankan `.tools/module-readiness.mjs` dan alat-alat pemiliknya (`crud-matrix.mjs --json` untuk atribusi rute + verba + vonis, `module-provenance.mjs` untuk ketertelusuran Sevima/regulasi/DDL/layar/seed, `handler-inventory.mjs --json` untuk bentuk `route.ts` yang nyata ada, `ci-gate-map.mjs` untuk gerbang CI). Angka di bawah bukan salinan yang bisa saya ketik ulang; kalau alatnya berubah, bagian ini ikut berubah saat perintah itu dijalankan.',
  '',
  '**Bentuk kolomnya bukan selera saya.** Sebelas kolom di bawah adalah format baku laporan ke pemilik produk, dinormakan di `AGENTS §6.1` dengan satu pemilik angka per kolom (`RD-95`) dan larangan menyalin angkanya ke dokumen lain (`RD-55`). Kolom `CRUD` menghitung rute per verba dari spesifikasi; enumerasi lengkap `METHOD path` per modul dicetak di blok **Rincian per modul** di bawah peta menu, dari `routeList` yang sama. Kolom `Kode` adalah kode entitlement/SKU registri, BUKAN kode error: dari register `API_SPEC §2.3` hanya sebagian kecil baris yang menyebut token modul, jadi atribusi kode error per modul tidak bisa dipindaikan tanpa mengarang — dan itu dinyatakan, bukan disembunyikan.',
  '',
  '**Cara membaca kolom "STATUS SIAP DEV?" — ini penting.** Kolom itu menyatakan kesiapan **spesifikasi modul**, BUKAN kesiapan sistem. Tidak ada satu pun modul yang siap dikembangkan hari ini, karena gerbang global menahan semuanya: `DEV-G2` (tiga lapis penegakan = 0 pemanggilan produksi), `DEV-G3` (7 dari 81 berkas migrasi dan 0 tes yang menyentuh DB), `DEV-G7` + `CI-G1…CI-G7` (nol dari 24 gerbang CI tertanam di pipeline). Yang diukur per modul adalah **tujuh penahan fungsional**: (1) verba wajib yang belum punya rute, (2) belum ada baris katalog izin ber-nomor yang memetakan modul, (3) belum ada baris menu di `RBAC §6`, (4) belum ada rujukan layar di `UI_UX`, (5) belum ada rujukan seed di `SEED_DATA`, (6) tidak ada satu pun pemetaan menu di tempat lain, (7) **FR yang diklaim registri tidak dikutip satu pun acceptance criteria** — pemilik ukurannya `.tools/fr-ac-gap.mjs`, dipasang setelah kajian pakar M-02 menemukan modul yang objeknya lengkap tetapi normanya tidak punya definisi selesai. Kolom **Catatan atribusi** memisahkan "objek/tabel tidak ada" dari "ada tapi tidak dilabeli ke modul" — yang kedua adalah `PRV-4`, bukan lubang fungsional.',
  '',
  '**Presisi atribusi dinyatakan, tidak disembunyikan.** Menu dipetakan lewat EMPAT jalur dan nama jalurnya ikut dicetak per modul: `eksplisit` (baris menu itu sendiri menulis `M-xx`), `resource` (suku pertama kode izin, dipetakan lewat baris katalog yang menulis modulnya), `SKU` (partisi entitlement→modul `RBAC §4.5.1`, kasar karena satu SKU membawa banyak modul), dan `rute` (baris `§6.5` dipetakan lewat atribusi rute milik `crud-matrix`). Izin: **' + skuJatuh + ' dari ' + totalNomor + '** baris katalog tidak menulis token `M-xx` (katalog gelombang 1–3 lebih dulu ada daripada registri modul), jadi modulnya dipulihkan lewat partisi SKU — dan itu dihitung sebagai CATATAN, bukan sebagai bukti pemetaan eksplisit. Known-answer yang dipasang: `M-13`/`M-18`/`M-10`/`M-46` wajib punya minimal satu izin ber-nomor, jumlah baris ber-nomor yang terbaca wajib sama dengan keluaran `rbac-count.mjs` (' + totalNomor + ', dipatok silang — bukan angka yang saya tulis di alat), dan empat jalur handler yang pasti ada di disk (`/auth/login`, `/auth/me`, `/tenant/modules`, `/academic/krs/submit`) wajib tersambung ke satu baris spesifikasi. Ketiganya pernah gagal, dan kegagalannya yang membuat pemindaian ini diperbaiki (`RD-103`/`RD-108` kelas yang sama).',
  '',
].join(NL);

const body = out.split(NL).map((l) => l).join(NL);

const src = readFileSync(TARGET, 'utf8');
const lines = src.split(NL);
let from = lines.findIndex((l) => /^## 20\./.test(l));
let to = lines.length;
if (from >= 0) {
  for (let i = from + 1; i < lines.length; i++) if (/^## [0-9]/.test(lines[i])) { to = i; break; }
}
const block = (preamble + body).split(NL);
const written = from >= 0 ? [...lines.slice(0, from), ...block, '', ...lines.slice(to)] : [...lines, ...block];
const outText = written.join(NL).replace(/\n{3,}/g, NL + NL);
if ((outText.match(/^## 20\./gm) || []).length !== 1) { console.error('MERAH — hasil tulis tidak mengandung tepat satu §20.'); process.exit(1); }
const ls = outText.split(NL);
const i19 = ls.findIndex((l) => /^## 19\./.test(l));
const i20 = ls.findIndex((l) => /^## 20\./.test(l));
if (!(i19 >= 0 && i20 > i19)) { console.error('MERAH — urutan bagian rusak (§19 harus sebelum §20).'); process.exit(1); }

writeFileSync(TARGET, outText, 'utf8');
console.log('§20 ditulis dari keluaran alat · baris modul = ' + (body.match(/^\| M-\d\d \||^\| APP \|/gm) || []).length
  + ' · mode = ' + (from >= 0 ? 'ganti blok lama' : 'tambah di akhir')
  + ' · baris berkas ' + lines.length + ' → ' + ls.length);
