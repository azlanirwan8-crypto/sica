/**
 * apply-ralat-115.mjs — mendaftarkan `RD-115` (usulan M-04 yang tercatat sebagai usulan M-02 lewat
 * kolom Entitlement yang salah) dan `PROGRESS §5.54`. Jangkar harus cocok tepat satu kali.
 * Penggunaan: node .tools/apply-ralat-115.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const RD = [
  '| `RD-115` | **Satu nama usulan M-02 yang tersisa setelah `RD-114` ternyata bukan milik M-02 sama sekali: ia `helpdesk.impact.update` milik M-04, dan ia masuk lewat kolom Entitlement yang salah.** Enam belas baris usulan `helpdesk.*` di `RBAC §4.5.6` menaruh `settings` di kolom Entitlement, padahal registri partisi `§4.5.1` mendaftarkan `(bukan SKU) helpdesk → M-04`. Lima belas baris selamat karena sel kutipannya menulis `API_SPEC 7.1 M-04`; yang keenam belas (`helpdesk.impact.update`) dikutip dari tabel `§7.32 Pelengkap CRUD yang MASIH BOLONG` yang tidak menulis token modul, jadi fallback SKU mengambil partisi `settings` dan pemiliknya: M-02. Ini kebocoran kelas sama dengan `RD-114` (atribusi berlebih, bukan nol) tetapi lewat jalur yang berbeda — fallback, bukan token dalam kalimat penarikan. Ditutup dua sisi: (a) KOREKSI ISI — 15 kolom Entitlement `settings` → `helpdesk` (dijalankan oleh `.tools/fix-helpdesk-ent.mjs`, dan mode `--cek`-nya dipasang sebagai GATE wajib di `gate-run` supaya kolom itu tidak bisa kembali salah tanpa ada yang sadar); (b) known-answer negatif di `module-readiness` menyimpan DAFTAR kode usulan per modul (`usulanDaftar`), bukan hanya jumlahnya: M-02 dilarang memuat kode `helpdesk.*` dan M-04 wajib memegang ≥15 nama. **Angka yang diluruskan:** M-02 `Izin 43 eksplisit / 49 ber-nomor / 1 usulan` (angka `1` yang saya publish di `RD-114` dan `PROGRESS §5.53` adalah sisa cacat ini, bukan usulan M-02) → `43 / 49 / 0`; M-04 usulan 14 → 15 (namanya kembali ke pemiliknya). Vonis tidak berubah: M-02 tetap `SPESIFIKASI SIAP` (ia memang tidak pernah mengklaim nama usulan itu), M-04 tetap `BELUM` karena nol baris menu §6. |',
].join(NL);

const VERSI = [
  '| 1.19 | 2026-10-21 | **Siklus keempatbelas — ralat kedua pada gejala yang sama: usulan M-04 menumpang partisi `settings` milik M-02.** Setelah `RD-114` menutup jalur token, satu nama usulan masih tertinggal di M-02; penelusuran `.tools/m02-leak-probe.mjs` menunjukkan penyebabnya kolom Entitlement `settings` pada baris `helpdesk.*` (registri §4.5.1: `(bukan SKU) helpdesk` = M-04). lima belas sel dibetulkan oleh `.tools/fix-helpdesk-ent.mjs` dan mode `--cek`-nya menjadi GATE wajib ke-30; known-answer negatif sekarang memeriksa DAFTAR kode, bukan hanya jumlah. Angka final M-02: `CRUD 12·23·10·2·5 · 0/52 handler · Menu 14 · Tabel 16 · Izin 43/49/0`. `gate-run`: 30 GATE + 11 INFO, FAIL=0; §20 diregenerasi dari alat. |',
].join(NL);

const SEC = [
  '### 5.54 Siklus 2026-10-21 (bagian 15) — ralat kedua pada gejala yang sama: satu nama usulan yang bukan milik M-02',
  '',
  '**Kenapa masih ada yang tersisa.** `RD-114` menutup jalur token (kalimat penolakan ruang nama), dan vonis M-02 masih mencetak `1 usulan`. Angka kecil itu tidak saya lewatkan: kalau atribusi sudah dibetulkan sebagian, sisa yang terlihat adalah petunjuk, bukan sisa yang boleh diterima. Probe yang sama (`m02-leak-probe.mjs`, kini ikut menelusuri jalur fallback) menunjuk satu nama: `helpdesk.impact.update`.',
  '',
  '**Akar masalah, dan ini kesalahan isi, bukan kesalahan alat.** Enam belas baris usulan `helpdesk.*` di `RBAC §4.5.6` menulis `settings` di kolom Entitlement. Registri partisi §4.5.1 sudah lama menyatakan yang benar: `(bukan SKU) helpdesk → M-04`. Lima belas baris tidak tertelan karena sel kutipannya kebetulan menyebut `M-04`; yang keenam belas dikutip dari tabel `API_SPEC §7.32` yang tidak menulis token modul, sehingga fallback mengambil partisi `settings` — dan `settings` adalah ruang nama M-02.',
  '',
  '**Perbaikan.** (1) Isi: `.tools/fix-helpdesk-ent.mjs` membetulkan 15 sel `settings` → `helpdesk`; mode `--cek`-nya saya pasang sebagai GATE wajib di `gate-run` (kini 30 penjaga + 11 penghitung), karena koreksi yang tidak ditegakkan akan kembali. (2) Alat: `module-readiness` tidak lagi hanya menghitung nama usulan per modul tetapi menyimpan DAFTAR-nya (`usulanDaftar`), dan known-answer negatif memeriksa daftar itu — M-02 dilarang memuat kode `helpdesk.*`, M-04 wajib memegang ≥15 nama. Known-answer yang hanya memeriksa jumlah buta terhadap nama yang salah rumah.',
  '',
  '**Angka yang diluruskan, termasuk angka saya sendiri satu sesi yang lalu.** M-02: `Izin 43 / 49 / 3` (`RD-114`) → `43 / 49 / 1` → **`43 / 49 / 0`**. Yang tercatat di `RD-114` sebagai "1 usulan milik M-02" sebenarnya milik M-04; M-04 kini `1 / 1 / 15`. Vonis tidak berubah untuk keduanya — dan itu justru yang penting: kesiapan M-02 tidak pernah bergantung pada nama curian, dan kesiapan M-04 bukan karena izin (melainkan nol baris menu §6).',
  '',
  '**Verifikasi.** `module-readiness --only=M-02,M-04` → M-02 `Menu 14 · Tabel 16 · Izin 43/49/0 · 0/52 handler`, status `SPESIFIKASI SIAP`; M-04 `Menu 0`, `BELUM`. Vonis nasional tetap 19 SIAP / 29 BELUM. `AUDIT_READINESS §20` diregenerasi dari keluaran alat. `gate-run`: 30 GATE + 11 INFO, FAIL=0.',
  '',
  '**Norma.** Sisa yang kecil setelah sebuah ralat bukan sisa yang boleh diterima — ia adalah gejala berikutnya. Dan known-answer harus memeriksa identitas (daftar nama), bukan hanya besaran (jumlah), karena jumlah yang benar bisa tersusun dari nama yang salah rumah.',
  '',
].join(NL);

const HISTORY = [
  '| 5.54 | 2026-10-21 | **Ralat kedua pada gejala yang sama — satu nama usulan M-04 tercatat sebagai milik M-02.** Penyebabnya isi: 16 baris `helpdesk.*` di `RBAC §4.5.6` menaruh `settings` di kolom Entitlement padahal registri §4.5.1 punya `(bukan SKU) helpdesk → M-04`; satu baris tanpa token modul jatuh ke partisi `settings` milik M-02. Perbaikan: `.tools/fix-helpdesk-ent.mjs` membetulkan 15 sel dan mode `--cek`-nya menjadi GATE wajib ke-30, `module-readiness` menyimpan `usulanDaftar` dan known-answer negatif memeriksa DAFTAR nama (bukan hanya jumlah). Angka final: M-02 `CRUD 12·23·10·2·5 · 0/52 handler · Menu 14 · Tabel 16 · Izin 43/49/0`; M-04 usulan 14 → 15. §20 diregenerasi; `gate-run` 30 GATE + 11 INFO, FAIL=0. Norma: sisa kecil setelah ralat adalah gejala berikutnya, dan known-answer wajib memeriksa identitas, bukan besaran. |',
].join(NL);

const IDX = [
  '| Penolak kolom Entitlement usulan yang salah ruang nama + penelusur jalur atribusi | RBAC_MATRIX.md | `.tools/fix-helpdesk-ent.mjs` (GATE `--cek` ke-30; membetulkan 15 sel `settings` → `helpdesk` yang membuat izin M-04 terhitung sebagai usulan M-02, `RD-115`) · `.tools/m02-leak-probe.mjs` (diagnostik: baris usulan mana yang memetakan resource/modul, termasuk lewat fallback partisi) | penjaga + diagnostik — sejak 2026-10-21 |',
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
    out.push(l);
    if (e && e.insertAfter) out.push(e.insertAfter);
  }
  writeFileSync(file, out.join(NL));
  return [lines.length, out.length];
};

const a = apply('docs/AUDIT_READINESS.md', [
  { nama: 'baris RD-114', match: (l) => l.startsWith('| `RD-114` |'), insertAfter: RD },
  { nama: 'baris versi 1.18', match: (l) => l.startsWith('| 1.18 | 2026-10-21 |'), insertAfter: VERSI },
]);
console.log('AUDIT_READINESS: RD-115 + versi 1.19 · baris ' + a[0] + ' → ' + a[1]);

const p = apply('docs/PROGRESS_REPORT.md', [
  { nama: 'heading §10', match: (l) => l.startsWith('## 10. Riwayat laporan (lanjutan)'), insertAfter: SEC + NL },
  { nama: 'baris riwayat 5.53', match: (l) => l.startsWith('| 5.53 | 2026-10-21 |'), insertAfter: HISTORY },
]);
console.log('PROGRESS_REPORT: §5.54 + riwayat 5.54 · baris ' + p[0] + ' → ' + p[1]);

const x = apply('docs/INDEX.md', [
  { nama: 'baris m02-leak-probe', match: (l) => l.startsWith('| Penelusur kebocoran atribusi:'), insertAfter: IDX },
]);
console.log('INDEX: baris penjaga atribusi ditulis · baris ' + x[0] + ' → ' + x[1]);
