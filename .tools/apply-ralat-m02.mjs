/**
 * apply-ralat-m02.mjs — mendaftarkan `RD-114` (atribusi M-02 yang dicemari catatan penarikan saya
 * sendiri) dan menambah `PROGRESS §5.53`. Setiap jangkar harus cocok tepat satu kali; kalau tidak,
 * alat berhenti tanpa menulis apa pun.
 * Penggunaan: node .tools/apply-ralat-m02.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const RD =
  '| `RD-114` | **Laporan M-02 mencetak lima menu milik M-01 dan menghitung dua nama yang sudah saya tarik sendiri sebagai usulan aktif — sumbernya teks anotasi saya, bukan dokumen yang salah.** `module-readiness` membangun peta `resource → modul` dari SETIAP baris katalog yang menulis token `M-xx`. Dua baris usulan §4.5.6 (`platform.import.validate`, `platform.import.commit`) saya beri vonis: ruang namanya DITOLAK, impor data master adalah pekerjaan M-02 dan sudah dipromosikan sebagai `master.import.*` (319/320). Kalimat itu menolak namespace `platform`, tetapi token `M-02` di dalamnya tetap terbaca sebagai label → `platform` terpetakan ke M-02 → setiap baris §6.2 yang mengutip kode `platform.*` tercetak sebagai menu M-02 (`Platform → Paket & Modul [C R U D]`, `Provisioning Tenant [C R U]`, `Kuota & Flag [U]`, `Statistik Agregat [R]`, `Break-Glass [C]`) dan kedua nama yang ditarik itu dihitung sebagai usulan (3, padahal 1). Angka yang saya publish pada 2026-10-21 (`Menu 19 · Izin 43/49/3`) salah dan dicabut di sini; yang terukur setelah perbaikan: `Menu 14 · Izin 43/49/1`. Ditutup tiga sisi: (a) baris usulan yang sel vonisnya menulis `DITOLAK` dikeluarkan dari atribusi DAN penghitungan, dengan jumlah yang dikeluarkan dicetak di footer (terukur 2) supaya tidak ada yang hilang diam-diam; (b) known-answer NEGATIF pertama dipasang — `platform` wajib memuat M-01 dan wajib TIDAK memuat M-02, `settings` wajib memuat M-02; (c) `AUDIT_READINESS §20` diregenerasi dari alat. **Norma:** token di dalam kalimat yang menegasi token itu tetap terbaca sebagai token — catatan penarikan tidak boleh duduk di baris yang sama dengan kode yang ditariknya kecuali alat diajari mengenali penarikan, dan alat atribusi tanpa known-answer negatif hanya menguji setengah kesalahan yang mungkin. Pola sama `RD-91` (tuduhan palsu karena alat), tapi penyebabnya kali ini kalimat saya sendiri. |';

const VERSI =
  '| 1.18 | 2026-10-21 | **Siklus ketigabelas (lanjutan) — ralat atribusi M-02 yang ditemukan setelah laporan dicetak.** Lima baris `Platform → …` di daftar menu M-02 ditelusuri sampai dua baris usulan §4.5.6 yang ruangnya justru DITOLAK; penyebabnya bukan dokumen, melainkan alat yang membaca token di dalam kalimat penarikan. Perbaikan di `.tools/module-readiness.mjs` (pengecualian baris `DITOLAK` + footer jumlah yang dikeluarkan + known-answer negatif dua arah), `§20` diregenerasi, dan angka M-02 yang benar menjadi `Menu 14 · Izin 43/49/1` (sebelumnya 19 · 43/49/3). Vonis nasional tidak berubah: **19 SIAP / 29 BELUM**, `gate-run` 29 GATE + 11 INFO, FAIL=0. |';

const SEC = [
  '### 5.53 Siklus 2026-10-21 (bagian 14) — ralat diri sendiri: lima menu M-01 yang tercetak sebagai menu M-02',
  '',
  '**Yang memicunya.** Setelah laporan M-02 keluar, saya membaca daftar menunya sendiri dengan curiga: `Platform → Paket & Modul`, `Provisioning Tenant`, `Kuota & Flag`, `Statistik Agregat`, `Break-Glass` bukan milik Master Parameter — itu permukaan M-01. Grep `docs/RBAC_MATRIX.md` membuktikan baris §6.2-nya menulis `M-01` secara eksplisit, jadi daftarnya yang salah, bukan matriksnya.',
  '',
  '**Akar masalah, dan itu bagian yang tidak enak.** Bukan dokumen: alat. `module-readiness` memetakan `resource → modul` dari setiap baris katalog yang menulis token `M-xx`. Dua baris usulan §4.5.6 (`platform.import.validate/.commit`) saya beri catatan yang MENOLAK ruang nama `platform.import.*` — dan di dalam penolakan itu ada frasa yang menyebut M-02 beserta nomor kanoniknya (319/320). Kalimatnya menolak, tokennya tetap terbaca label: `platform` masuk peta sebagai M-02, dan semua menu yang mengutip kode `platform.*` ikut mengalir ke modul yang sedang saya kaji. Dua nama yang sudah ditarik juga tetap dihitung sebagai usulan aktif.',
  '',
  '**Angka yang saya cabut.** M-02 `Menu 19 · Izin 43/49/3` (diprint 2026-10-21) → yang benar `Menu 14 · Izin 43/49/1`. Tabel `AUDIT_READINESS §20` ikut membawa angka lama dan sudah diganti dari keluaran alat, bukan diketik ulang.',
  '',
  '**Perbaikan (tiga sisi, bukan satu).** (1) Baris usulan yang sel vonisnya memuat `DITOLAK` dikeluarkan dari atribusi dan dari penghitungan, dan jumlah yang dikeluarkan dicetak di baris ringkas (terukur `2`) supaya "dikeluarkan" tidak pernah berarti "hilang diam-diam". (2) Known-answer **negatif** untuk pertama kalinya: `platform` wajib memuat M-01 dan wajib TIDAK memuat M-02; `settings` wajib memuat M-02. Known-answer selama ini hanya menguji arah positif — itu sebabnya atribusi berlebih tidak pernah tertangkap, dan itu celah pada metode saya, bukan pada satu modul. (3) `.tools/m02-leak-probe.mjs` menjadi penelusur satu perintah untuk pertanyaan "baris usulan mana yang membuat resource X terpetakan ke modul Y" (`RD-95`: satu pertanyaan, satu alat).',
  '',
  '**Verifikasi.** `module-readiness --only=M-02` → `Menu 14`, usulan 1, status tetap `SPESIFIKASI SIAP`. Vonis nasional tidak berubah: 19 SIAP / 29 BELUM; kelas handler `DB=6 DB_MOCK=1 NONE=41`. `apply-module-readiness.mjs` menulis ulang §20 (96 baris modul, penjaga jumlah). `gate-run`: 29 GATE + 11 INFO, FAIL=0.',
  '',
  '**Norma yang diambil.** Catatan penarikan tidak boleh duduk pada baris yang sama dengan kode yang ditariknya, kecuali alat diajari mengenali penarikan — dan setiap alat atribusi wajib punya known-answer negatif, karena kesalahan yang paling mahal bukan "nol" tetapi "milik orang lain tercatat sebagai milikmu".',
  '',
].join(NL);

const HISTORY = [
  '| 5.53 | 2026-10-21 | **Ralat diri sendiri setelah laporan M-02 dicetak — lima menu M-01 tercetak sebagai menu M-02, dan penyebabnya alat + kalimat saya sendiri.** Akarnya: `module-readiness` membaca token `M-02` yang duduk di dalam catatan PENOLAKAN ruang nama (`platform.import.*`), sehingga `platform` terpetakan ke M-02. Angka yang saya cabut: `Menu 19 · Izin 43/49/3` → `Menu 14 · Izin 43/49/1`. Perbaikan tiga sisi: baris `DITOLAK` dikeluarkan dari atribusi dan penghitungan (jumlah yang dikeluarkan dicetak di ringkas), known-answer **negatif** pertama dipasang (`platform` → M-01 ya / M-02 tidak, `settings` → M-02 ya), dan `.tools/m02-leak-probe.mjs` menjadi penelusurnya. §20 diregenerasi dari alat; vonis nasional tetap 19 SIAP / 29 BELUM; `gate-run` 29 GATE + 11 INFO, FAIL=0. Norma: alat atribusi tanpa known-answer negatif hanya menguji setengah kesalahan yang mungkin — kesalahan termahal bukan nol, tapi milik orang lain yang tercatat sebagai milikmu. |',
].join(NL);

const apply = (file, edits) => {
  const lines = readFileSync(file, 'utf8').split(NL);
  for (const e of edits) e.n = lines.filter((l) => e.match(l)).length;
  for (const e of edits) {
    if (e.n === 0) { console.error('MERAH — jangkar ' + e.nama + ' tidak ditemukan di ' + file + '. Tidak ada yang ditulis.'); process.exit(1); }
    if (e.n > 1) { console.error('MERAH — jangkar ' + e.nama + ' cocok ' + e.n + ' kali di ' + file + '. Tidak ada yang ditulis.'); process.exit(1); }
  }
  const out = [];
  for (const l of lines) {
    const e = edits.find((x) => x.match(l));
    if (!e) { out.push(l); continue; }
    if (e.replaceWith) { out.push(e.replaceWith(l)); continue; }
    out.push(l);
    if (e.insertAfter) out.push(e.insertAfter);
  }
  writeFileSync(file, out.join(NL));
  return [lines.length, out.length];
};

const a = apply('docs/AUDIT_READINESS.md', [
  { nama: 'baris RD-113', match: (l) => l.startsWith('| `RD-113` |'), insertAfter: RD },
  { nama: 'baris versi 1.17', match: (l) => l.startsWith('| 1.17 | 2026-10-21 |'), insertAfter: VERSI },
]);
console.log('AUDIT_READINESS: RD-114 + versi 1.18 ditulis · baris ' + a[0] + ' → ' + a[1]);

const p = apply('docs/PROGRESS_REPORT.md', [
  { nama: 'heading §10', match: (l) => l.startsWith('## 10. Riwayat laporan (lanjutan)'), insertAfter: SEC + NL },
  { nama: 'baris riwayat 5.52', match: (l) => l.startsWith('| 5.52 | 2026-10-21 |'), replaceWith: (l) => l + NL + HISTORY },
]);
console.log('PROGRESS_REPORT: §5.53 + riwayat 5.53 ditulis · baris ' + p[0] + ' → ' + p[1]);
