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
  s = s.slice(0, i) + b + s.slice(i + a.length);
  writeFileSync(p, s, 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* A — PRD: daftar usulan kehilangan `career`; selisih 19 nyata dijelaskan */
job('PRD.md', 'prd-career',
  '(`asset`, `clinic`, `crm`, `endowment`,',
  '(`asset`, `career`, `clinic`, `crm`, `endowment`,');
job('PRD.md', 'prd-parent-portal',
  'lihat §5.12.4, ditambah **19** yang nyata hari ini.',
  'lihat §5.12.4, ditambah **19** yang nyata hari ini (`MODULE_CODES` di [packages/contracts/src/entitlement.ts:9-16](file:///c:/SICA/packages/contracts/src/entitlement.ts); satu di antaranya, `parent_portal`, tidak punya baris `M-xx` karena ia add-on orang tua dan bukan modul kampus — karena itu kolom ketiga tabel di atas menampilkan 18 nama nyata, bukan 19).');

/* B — AUDIT_READINESS §12.4: angka placeholder diganti hasil ukur + alatnya */
job('AUDIT_READINESS.md', 'placeholder-ralat',
  'Ukuran akhir setelah ralat: `scan-nonlatin` `nonLatinHits=0` (25 berkas), `check-docs` `TABEL KONSISTEN` (24 dokumen + AGENTS.md), `TODO` tersisa 8 dan semuanya kutipan penanda kode nyata (`TBD`/`FIXME` = 0).',
  'Ukuran akhir setelah ralat: `scan-nonlatin` `nonLatinHits=0` (25 berkas), `check-docs` `TABEL KONSISTEN` (24 dokumen + AGENTS.md). **Angka placeholder di baris ini sudah dua kali basi dan kini dipindahkan ke alat ukur.** Ukur `node .tools/placeholder-count.mjs` pada 2026-10-21: `TODO` **21** pada 15 baris di 6 dokumen, `TBD` **6**, `FIXME` **5**, `XXX` **1** — **seluruhnya kutipan**, bukan placeholder dokumen: tiap kemunculan adalah penanda `TODO` yang memang ada di berkas `route.ts` nyata, atau kalimat yang sedang melaporkan hitungan itu sendiri. Vonisnya tidak berubah (nol placeholder spesifikasi), angka laporannya berubah setiap kali dokumen bertambah, dan karena itu angka ini tidak lagi ditulis tangan di tempat lain. Lihat `RD-62`.');

/* C — riwayat 1.6: frasa "16 adapter" dipertajam jadi tiga objek yang terukur */
job('AUDIT_READINESS.md', 'history-16-adapters',
  '16 adapter `INTEGRATIONS §6`;',
  '15 sistem nasional/eksternal (`INTEGRATIONS §6.1`), 6 adapter design-only (`§6.4`) dan 16 baris register (`§6.7`) di `INTEGRATIONS §6`;');

/* D — RD-62 di sebelah RD-61 */
job('AUDIT_READINESS.md', 'rd62',
  'Sementara itu `SPE-3` wajib memetakan prefiks → modul jual secara eksplisit untuk 130 baris itu, dan uji katalog menolak izin tanpa rumah |',
  [
    'Sementara itu `SPE-3` wajib memetakan prefiks → modul jual secara eksplisit untuk 130 baris itu, dan uji katalog menolak izin tanpa rumah |',
    '| RD-62 | **Alat ukur saya lebih sering salah daripada dokumen yang saya ukur.** Dua kejadian dalam satu siklus. (a) Siklus 5.38 memublikangkan "`TODO` 8 pada 5 dokumen; `TBD`/`FIXME` 0". Ukuran ulang 2026-10-21: `TODO` **21** pada 15 baris di 6 dokumen, `TBD` **6**, `FIXME` **5**, `XXX` **1**. Vonisnya tetap sama (semuanya kutipan, nol placeholder spesifikasi) tetapi angka publikasinya sudah tidak benar sejak gelombang ketujuh menambah baris. (b) Penghitung naif yang hanya menerima sel pertama berupa satu kata metode (`GET`, `POST`, …) mengembalikan **206** baris untuk `API_SPEC §7`, padahal tabel §7.23 mengklaim **267**; saya nyaris mendaftarkan selisih 61 baris itu sebagai temuan dokumen. Setelah cara ukur §7.23 dibaca (satu baris metode gabungan dihitung satu baris, bukan tiga), skrip menghasilkan **267 · 82 `spec-only` · 185 `blocker` · 0 `implemented`** dan cocok **per gugus**, bukan hanya total. Yang cacat di sini alat ukur pertama saya, bukan dokumennya | MINOR (higiene pengukuran) | Norma baru, lanjutan langsung `RD-55`: **setiap angka yang diterbitkan di `/docs` wajib punya skrip pengukur yang ikut tersimpan di `.tools/`, dan tempat lain menunjuk skripnya, bukan menyalin hasilnya.** Untuk placeholder: `.tools/placeholder-count.mjs`. Untuk baris rute: `.tools/route-count.mjs`. Untuk kolom Modul §4.5.1: `.tools/measure-451.mjs`. Sebelum menulis "angka ini salah", jalankan dulu alat ukur pemilik angkanya |',
  ].join(NL));

console.log(rep.join(NL));
