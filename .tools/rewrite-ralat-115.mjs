/**
 * rewrite-ralat-115.mjs — menulis ulang catatan `RD-115` / `PROGRESS §5.54` / riwayat / `INDEX`
 * dengan narasi yang BENAR: perbaikan pertama saya (memindahkan kolom Entitlement) ditolak penjaga
 * yang sah, dan akar masalahnya urutan bukti di alat, bukan sel dokumen.
 * Penggunaan: node .tools/rewrite-ralat-115.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const RD = [
  '| `RD-115` | **Yang salah adalah urutan bukti alat, bukan sel dokumen — dan penjaga yang menolak "perbaikan" saya itulah yang membuktikannya.** Setelah `RD-114` (token di dalam kalimat penarikan), vonis M-02 masih mencetak `1 usulan`. Probe (`m02-leak-probe.mjs`, yang untuk itu ditambahkan penelusuran jalur fallback) menunjuk satu nama: `helpdesk.impact.update` milik M-04. Dugaan pertama saya: enam belas baris usulan `helpdesk.*` di `RBAC §4.5.6` "salah" menulis `settings` di kolom Entitlement padahal registri §4.5.1 punya `(bukan SKU) helpdesk → M-04`; saya pindahkan 15 sel itu ke `helpdesk`. **Penjaga wajib `perm-usulan-audit` menolak 15 baris** — dan ia benar: kolom itu tertutup pada 13 nilai `PERMISSION_MODULES` (`G-29`), `helpdesk` bukan salah satunya, jadi `settings` adalah satu-satunya nilai SAH. Dokumen tidak salah; yang salah adalah fallback `module-readiness`, yang memakai sel Entitlement (kosakata tertutup 13 nilai) sebagai penanda pemilik, padahal baris usulan §4.5.6 tidak punya kolom `Modul` dan resource-nya tertulis pada kode itu sendiri. Perbaikan yang benar: untuk baris usulan tanpa token, **resource dari kode didahulukan** (partisi §4.5.1, termasuk ruang nama `(bukan SKU)`), baru sel Entitlement; perubahan isi dibalik (`fix-helpdesk-ent.mjs --balik`) dan mode `--cek`-nya dipasang sebagai GATE supaya kesalahan saya tidak diulang. known-answer negatif kini memeriksa DAFTAR kode per modul (`usulanDaftar`): M-02 dilarang memuat `helpdesk.*`, M-04 wajib memegang ≥15. **Radius terukur:** dari 48 modul hanya dua angka yang berubah — M-04 `14 → 15` usulan, M-02 `1 → 0`; vonis nasional tetap 19 SIAP / 29 BELUM. M-02 final: `CRUD 12·23·10·2·5 · 0/52 handler · Menu 14 · Tabel 16 · Izin 43/49/0`. **Norma:** kalau penjaga menolak koreksi saya, penolakannya adalah BUKTI — periksa apakah nilai yang saya sebut "salah" adalah satu-satunya nilai yang sah sebelum menuduh dokumennya. |',
].join(NL);

const VERSI = [
  '| 1.19 | 2026-10-21 | **Siklus keempatbelas — ralat kedua pada gejala yang sama, dan kali ini yang saya betulkan adalah alatnya, bukan dokumennya.** Sisa `1 usulan` di M-02 telusuri sampai `helpdesk.impact.update` (M-04). Koreksi pertama saya (15 kolom Entitlement `settings` → `helpdesk`) DITOLAK penjaga sah `perm-usulan-audit`: kolom itu dibatasi 13 nilai `PERMISSION_MODULES` (`G-29`) sehingga `settings` satu-satunya nilai legal. Akar sebenarnya: fallback `module-readiness` memakai sel Entitlement sebagai penanda pemilik, sedangkan baris usulan §4.5.6 menulis resource-nya di dalam kode. Attribut usulan kini mendahulukan resource, koreksi isi dibalik dan dijaga `fix-helpdesk-ent --cek` (GATE ke-30), known-answer negatif memeriksa daftar nama. Radius: M-04 `14→15`, M-02 `1→0`, yang lain tidak bergerak; M-02 final `CRUD 12·23·10·2·5 · 0/52 handler · Menu 14 · Tabel 16 · Izin 43/49/0`; vonis nasional 19 SIAP / 29 BELUM; `gate-run` 30 GATE + 11 INFO, FAIL=0. |',
].join(NL);

const SEC = [
  '### 5.54 Siklus 2026-10-21 (bagian 15) — ralat kedua pada gejala yang sama: yang salah urutan bukti, bukan sel dokumen',
  '',
  '**Sisa yang tidak boleh diterima.** `RD-114` menutup jalur token (kalimat penolakan ruang nama), dan M-02 masih mencetak `1 usulan`. Angka sekecil itu adalah gejala berikutnya, bukan sisa yang wajar. Probe yang sama, diperluas ke jalur fallback, menunjuk satu nama: `helpdesk.impact.update` — milik M-04.',
  '',
  '**Kesalahan pertama saya, dan penjaga yang menangkapnya.** Dugaan saya: baris-baris usulan `helpdesk.*` di `RBAC §4.5.6` "salah" menulis `settings` di kolom Entitlement, padahal registri §4.5.1 mendaftarkan `(bukan SKU) helpdesk → M-04`. Saya pindahkan 15 sel itu ke `helpdesk`. `perm-usulan-audit` — penjaga wajib — langsung menolak 15 pelanggaran, dan **ia yang benar**: kolom itu dibatasi ke 13 nilai `PERMISSION_MODULES` (`G-29`), `helpdesk` bukan salah satunya, jadi `settings` adalah satu-satunya nilai SAH untuk baris itu. Dokumen tidak pernah salah; koreksi saya yang salah.',
  '',
  '**Akar yang sebenarnya.** `RBAC §4.5.6` tidak punya kolom `Modul`. Untuk baris yang juga tidak menulis token `M-xx`, `module-readiness` jatuh ke sel Entitlement — sebuah kosakata tertutup 13 nilai yang memang TIDAK BISA menyebut `helpdesk`. Padahal resource pemilik aksi itu tertulis pada kode itu sendiri (`helpdesk.*`). Perbaikan: untuk baris usulan tanpa token, **resource dari kode didahulukan** (dipetakan lewat partisi §4.5.1, termasuk ruang nama `(bukan SKU)`), sel Entitlement hanya jadi cadangan. Nomor usulan M-04 yang lain tidak berubah karena 14 barisnya sudah menulis `M-04` pada sel kutipan.',
  '',
  '**Isi dikembalikan, dan kesalahan saya dijaga.** `.tools/fix-helpdesk-ent.mjs --balik` mengembalikan 15 sel ke `settings`; mode `--cek`-nya saya pasang sebagai GATE wajib di `gate-run` (kini 30 penjaga + 11 penghitung) supaya "perbaikan" yang salah itu tidak bisa diulang tanpa ditolak. known-answer negatif di `module-readiness` tidak lagi memeriksa jumlah, tetapi DAFTAR nama (`usulanDaftar`): M-02 dilarang memuat kode `helpdesk.*`, M-04 wajib memegang ≥15. Versi pertama `--cek` saya sendiri cacat — ia menjalankan mutasi lebih dulu lalu menghitung hasil mutasinya, sehingga selalu MERAH; itu diperbaiki setelah dites, bukan setelah dipercaya.',
  '',
  '**Radius terukur.** Dari 48 modul hanya dua angka yang bergerak: M-04 `14 → 15` usulan (namanya kembali ke pemiliknya) dan M-02 `1 → 0`. Vonis nasional tetap **19 SIAP / 29 BELUM**. M-02 final: `CRUD 12·23·10·2·5` dari 52 rute, `0/52` handler, `Menu 14`, `Tabel 16`, `Izin 43 eksplisit / 49 ber-nomor / 0 usulan`, FR 15/15 ter dikutip AC.',
  '',
  '**Norma.** Kalau penjaga menolak koreksi saya, penolakannya adalah bukti — periksa lebih dulu apakah nilai yang saya sebut "salah" merupakan satu-satunya nilai yang sah. Ini kali ketiga dalam dua hari alat/atribusi saya yang salah sementara dokumennya benar (`RD-111`, `RD-114`, `RD-115`), dan untuk ketiganya yang berubah adalah alatnya.',
  '',
].join(NL);

const HISTORY = [
  '| 5.54 | 2026-10-21 | **Ralat kedua pada gejala yang sama — dan kali ini yang dibetulkan adalah urutan bukti alat, bukan sel dokumen.** Sisa `1 usulan` M-02 adalah `helpdesk.impact.update` milik M-04. Koreksi pertama saya (15 kolom Entitlement `settings` → `helpdesk`) ditolak penjaga sah `perm-usulan-audit`: kolom itu tertutup pada 13 nilai `PERMISSION_MODULES` (`G-29`), jadi `settings` adalah satu-satunya nilai legal. Akar sebenarnya: fallback `module-readiness` memakai sel Entitlement untuk baris §4.5.6 yang tidak punya kolom `Modul`; kini resource dari kode didahulukan, koreksi isi dibalik (`fix-helpdesk-ent --balik`) dan `--cek`-nya menjadi GATE ke-30, known-answer negatif memeriksa DAFTAR nama. Radius: hanya M-04 `14→15` dan M-02 `1→0`; vonis nasional tetap 19 SIAP / 29 BELUM; M-02 final `CRUD 12·23·10·2·5 · 0/52 handler · Menu 14 · Tabel 16 · Izin 43/49/0`. `gate-run` 30 GATE + 11 INFO, FAIL=0. Norma: penolakan penjaga terhadap koreksi saya adalah bukti, bukan gangguan. |',
].join(NL);

const IDX = [
  '| Penolak ruang nama kolom Entitlement baris usulan + penelusur jalur atribusi | RBAC_MATRIX.md | `.tools/fix-helpdesk-ent.mjs` (GATE `--cek` ke-30; menolak nilai di luar 13 `PERMISSION_MODULES` — `G-29` — dan `--balik` mengembalikan koreksi saya yang salah, `RD-115`) · `.tools/m02-leak-probe.mjs` (diagnostik: baris usulan mana yang memetakan resource/modul, termasuk lewat fallback partisi) | penjaga + diagnostik — sejak 2026-10-21 |',
].join(NL);

const F1 = 'docs/AUDIT_READINESS.md';
const f1 = readFileSync(F1, 'utf8').split(NL);
const rep = (arr, startRe, text) => {
  const i = arr.findIndex((l) => startRe.test(l));
  if (i < 0 || arr.filter((l) => startRe.test(l)).length !== 1) { console.error('MERAH — jangkar ' + startRe + ' tidak unik/tidak ada.'); process.exit(1); }
  arr[i] = text;
  return arr;
};
rep(f1, /^\| `RD-115` \|/, RD);
rep(f1, /^\| 1\.19 \| 2026-10-21 \|/, VERSI);
writeFileSync(F1, f1.join(NL));
console.log('AUDIT_READINESS: RD-115 + versi 1.19 ditulis ulang');

const F2 = 'docs/PROGRESS_REPORT.md';
const f2 = readFileSync(F2, 'utf8').split(NL);
const i554 = f2.findIndex((l) => l.startsWith('### 5.54 '));
if (i554 < 0 || f2.filter((l) => l.startsWith('### 5.54 ')).length !== 1) { console.error('MERAH — heading §5.54 tidak unik/tidak ada.'); process.exit(1); }
const i10 = f2.findIndex((l) => l.startsWith('## 10. Riwayat laporan (lanjutan)'));
let end = i10 - 1;
while (end > i554 && f2[end].trim() === '') end--;
f2.splice(i554, end - i554 + 1, SEC);
rep(f2, /^\| 5\.54 \| 2026-10-21 \|/, HISTORY);
writeFileSync(F2, f2.join(NL));
console.log('PROGRESS_REPORT: §5.54 + riwayat 5.54 ditulis ulang');

const F3 = 'docs/INDEX.md';
const f3 = readFileSync(F3, 'utf8').split(NL);
rep(f3, /^\| Penolak kolom Entitlement usulan/, IDX);
writeFileSync(F3, f3.join(NL));
console.log('INDEX: baris penjaga atribusi ditulis ulang');
