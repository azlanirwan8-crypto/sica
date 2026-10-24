import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
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
const tail = (file, text, label) => {
  const p = D + file;
  const s = readFileSync(p, 'utf8');
  writeFileSync(p, s.replace(/\n*$/, NL) + text, 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* 1 — recap API_SPEC §5.15 */
job('API_SPEC.md', 'recap-144',
  '| Kode error terdaftar di §2.3 | **118** | 65 lama + 13 engine gelombang 1 (66–78) + 13 engine gelombang 2 & objek institusi (79–91) + **15** kamus/atribut kustom dan sisa keadaan gelombang 2 (92–106) + **12** mesin parameter (§4.16), menu dinamis & grant (§4.17), presensi multi-modus (§4.18) = 107–118.',
  '| Kode error terdaftar di §2.3 | **144** | 65 lama + 13 engine gelombang 1 (66–78) + 13 engine gelombang 2 & objek institusi (79–91) + **15** kamus/atribut kustom dan sisa keadaan gelombang 2 (92–106) + **12** mesin parameter (§4.16), menu dinamis & grant (§4.17), presensi multi-modus (§4.18) = 107–118 + **26** gugus 47 modul (§7.22) dan `MFA_NOT_IMPLEMENTED` (baris 144) = 119–144. Terukur dengan `grep` atas baris §2.3 yang bermula kode HTTP: 144 bernomor, **144 unik**, tanpa lubang. Yang asli dipakai pemancar `error.code` hari ini tetap **12** (baris 1, 3, 5, 6, 10, 11, 12, 13, 14, 15, 27, 28).');

/* 2 — RD-61 di AUDIT_READINESS */
job('AUDIT_READINESS.md', 'rd61',
  '### 14.2 Status `SEC-0` setelah inspeksi 2026-10-20',
  [
    '### 14.1b Temuan atas pekerjaan saya sendiri',
    '',
    '| ID | Temuan | Kelas | Titik aksi |',
    '|---|---|---|---|',
    '| RD-61 | **Kolom `Modul` pada `RBAC_MATRIX §4.5.1` tidak dapat menjadi gerbang entitlement untuk 47 modul.** Terukur dengan memotong bagian §4.5.1 lalu menghitung kolom ketiga dari 130 baris bernomor 162–291: hanya **4** dari **13** nilai `PermissionModule` yang sah ([authz.ts:93-97](file:///c:/SICA/packages/contracts/src/authz.ts)) yang terpakai — **82** `academic`, **31** `finance`, **14** `audit`, **3** `settings`. Artinya izin untuk M-06 HRIS, M-07 BKD, M-08 SISTER, M-20 Tugas Akhir, M-39 e-Library, M-42 Asrama dan M-44 LPPM semuanya berbunyi `academic`. Kolom itu mengelompokkan katalog untuk uji struktur, bukan mencatat modul tempat sesuatu dijual, sehingga gerbang `withModule` bagi gugus modul baru itu **tidak dapat** dibaca darinya; satu-satunya jalan adalah peta prefiks `MODULE_PREFIX_ALIASES` + `menu_items.module_code` + grant eksplisit. Cacat ini tidak terlihat selama register §4.5 masih berhenti di baris 161 dengan 19 modul entitlement, dan langsung muncul begitu 130 baris ditambahkan di atasnya | MAJOR (kontrak izin) | Perluasan `PERMISSION_MODULES` adalah keputusan produk (`G-10`/`G-23`/`G-29`), bukan pekerjaan dokumen sepihak. Sementara itu `SPE-3` wajib memetakan prefiks → modul jual secara eksplisit untuk 130 baris itu, dan uji katalog menolak izin tanpa rumah |',
    '',
    '**Cara temuan ini terjadi, dan itu bagian dari isinya.** Saat memeriksa baris izin SISTER (174–177) saya melihat nilainya `academic` dan menyimpulkan itu salah — karena katalog entitlement melabeli `hr_bkd` sebagai "SDM / BKD / SISTER" ([0004_entitlement_modules.sql:89](file:///c:/SICA/packages/database/migrations/0004_entitlement_modules.sql)). Saya ubah keempat baris itu menjadi `hr_bkd`, lalu mengukur `PERMISSION_MODULES` dan menemukan bahwa kolom itu memang **harus** salah satu dari 13 nilai: `hr_bkd` adalah kode entitlement, bukan kode modul izin. Agen yang menulisnya benar, koreksi saya yang salah, dan keempat baris sudah saya revert kembali ke `academic`. Pelajaran yang dicatat di sini bukan "jangan mengoreksi", melainkan: bedakan **kode entitlement** (sumbu penjualan, `tenant_modules.code`) dari **kode modul izin** (sumbu katalog `PERMISSION_MODULES`) — keduanya bernama mirip, dan tabrakannya persis seperti yang baru saja saya lakukan terhadap dokumen sendiri. Vonis dua-sumbu di `PRD §5.12` kini menyebut perbedaan ini secara eksplisit, dan `GLOSSARY §10` menuliskan keduanya sebagai istilah yang berbeda.',
    '',
    '### 14.2 Status `SEC-0` setelah inspeksi 2026-10-20',
  ].join(NL));

/* 3 — ralat tally di riwayat AUDIT_READINESS baris 1.5 */
job('AUDIT_READINESS.md', 'history-15-tally',
  '(tally terukur: 11 PENUH / 21 SEBAGIAN / 16 NOL)',
  '(tally terukur: 11 PENUH / 23 SEBAGIAN / 14 NOL — angka ini dihitung ulang dari tabel `PRD §5.12` setelah deduplikasi vonis; yang ditulis sebelumnya, 21/16, adalah tally sebelum tabel final)');

/* 4 — riwayat AUDIT_READINESS */
tail('AUDIT_READINESS.md', [
  '| 1.6 | 2026-10-20 | §14.1b dan penutupan gelombang ketujuh: registri 48 modul (`PRD §5.12`) + 14 vonis deduplikasi (`§5.13`) + `§5.12.4` (tabrakan `sister` terhadap `hr_bkd` pada katalog terapan `0004:90`); 119 tabel dan 22 nomor migrasi `0051`–`0072` di `DATA_MODEL §22`; 42 peristiwa + vonis jalur real-time di `ARCHITECTURE §13`; 267 baris rute dan register error sampai 144 di `API_SPEC §7`; 130 baris izin 162–291 + 17 pasangan empat-mata di `RBAC_MATRIX`; grid peran 73 baris dan 12 blok layar di `UI_UX §17–§18`; `SC-G4-01…36` dan `SEC-26…31` di `SECURITY §13`; 16 adapter `INTEGRATIONS §6`; gugus `M47-0…M47-8` di `ROADMAP §2.20`. `RD-61` didaftarkan setelah saya salah mengoreksi kolom modul dan membatalkan koreksi itu sendiri. |',
  '',
].join(NL), 'audit-row-16');

/* 5 — INDEX: peta gelombang ketujuh */
job('INDEX.md', 'index-wave6-number',
  '| Endpoint parameter, menu, presensi multi-modus | API_SPEC.md | §4.16–§4.18; register §2.3 = 118 | spesifikasi |',
  '| Endpoint parameter, menu, presensi multi-modus | API_SPEC.md | §4.16–§4.18 (angka register §2.3 dihitung di API_SPEC, tidak disalin ke sini) | spesifikasi |');
job('INDEX.md', 'index-wave7',
  '| Kontradiksi yang ditutup | AUDIT_READINESS.md | §12.1 (C-1…C-6) | diputus |',
  [
    '| Kontradiksi yang ditutup | AUDIT_READINESS.md | §12.1 (C-1…C-6) | diputus |',
    '| **Registri 47 modul bisnis + SuperApp dan pemetaan entitlement** | PRD.md | §5.12 (48 baris) + §5.12.4 (tabrakan `sister`) + §5.13 (14 vonis) | norma |',
    '| Kebutuhan bisnis modul yang sebelumnya nol | PRD.md | §5.14.1–§5.14.9 (75 FR, 66 kunci parameter, 20 kamus, 21 uji penolakan) | spesifikasi |',
    '| Skema 21 modul baru | DATA_MODEL.md | §22 (119 tabel, `0051`–`0072`, §22.9 register, §22.11 query CI) | spesifikasi |',
    '| Rantai data, peristiwa, dan jalur real-time | ARCHITECTURE.md | §13.1 (42 peristiwa), §13.2 (SSE/WebSocket), §13.4 (5 skenario), §13.5–§13.6 (ALG-19…24, vonis) | spesifikasi |',
    '| Endpoint 47 modul dan kode error baru | API_SPEC.md | §7.1–§7.24; register §2.3 = 144 | spesifikasi |',
    '| Partisi izin dan sub-detail modul baru | RBAC_MATRIX.md | §4.5.1 (baris 162–291), §6.7, §7.6 (17 pasangan) | usulan |',
    '| Dashboard grid per peran + layar modul | UI_UX_DESIGN.md | §17 (73 baris peran-kartu), §18 (12 blok), §17.6 (vonis grafik) | spesifikasi |',
    '| Kepatuhan kelas data khusus | SECURITY_COMPLIANCE.md | §13 (SC-G4-01…36, SEC-26…31, §13.8 penahan) | spesifikasi |',
    '| Adapter sistem nasional | INTEGRATIONS.md | §6.1, §6.5 (kamus), §6.7 register + 32 `[VERIFIKASI-RESMI]` | spesifikasi |',
    '| Urutan eksekusi gelombang ketujuh | ROADMAP_TASKS.md | §2.20 (`M47-0`…`M47-8`), §2.20.3 baris pertama | terjadwal |',
  ].join(NL));

/* 6 — GLOSSARY: istilah baru */
tail('GLOSSARY.md', [
  '',
  '## 10. Leksikon gelombang ketujuh — 47 modul (2026-10-20)',
  '',
  '| Istilah | Arti yang dipakai di dokumen ini |',
  '|---|---|',
  '| Modul bisnis (`M-xx`) | Label produk dan pengelompokan menu untuk 47 modul + SuperApp. **Bukan** enum, **bukan** kode entitlement, **bukan** izin. Rumah datanya `menu_items` (`DATA_MODEL §21.7`), registri normanya `PRD §5.12.1`. |',
  '| Kode entitlement | Gerbang jual dan partisi izin: 19 nilai nyata di `packages/contracts/src/entitlement.ts` + kandidat di `PRD §5.12.1`. Sumbu ini berbeda dari `PERMISSION_MODULES` (13 nilai katalog izin) — melihat keduanya sebagai satu hal adalah sumber `RD-61`. |',
  '| Kode modul izin (`PermissionModule`) | Nilai tempat sebuah izin dikumpulkan untuk uji katalog: hanya 13 nilai. Kolom `Modul` di `RBAC §4.5.1` memakai kosakata ini, sehingga tidak dapat dipakai untuk menyimpulkan modul jual. |',
  '| SuperApp | Permukaan mobile (Flutter), bukan SKU. Merender modul yang sama dari `menu_items` dengan `layer` MOBILE/BOTH; tidak menghitung angka akademik di perangkat. |',
  '| Vonis tanggung jawab tunggal | Satu objek punya satu penulis; modul lain hanya memancarkan sinyal. Empat belas butir di `PRD §5.13`, ditegakkan lewat `403 CROSS_MODULE_WRITE_FORBIDDEN` (baris 119). |',
  '| Peristiwa kanonik | Nama `modul.entitas.aksi` di katalog `ARCHITECTURE §13.1` (42 butir). Payload tidak memuat PII yang tidak dibutuhkan konsumen. |',
  '| `hiddenByDesign` | Keadaan layar yang menyatakan isi sengaja tidak ditampilkan (M-36 kasus PPKS, M-41 rekam medis), bukan error dan bukan `disabled`. |',
  '| Transport, bukan pemilik fakta | Peran M-08 (SISTER) dan adapter kirim mana pun: menyimpan kemasan, watermark, dan jejak kirim; tidak pernah memiliki angka yang dikirim. |',
  '| Irisan `M47-*` | Penomoran pelaksanaan sembilan irisan di `ROADMAP §2.20`. Tidak menggantikan `R-*`/`W-*`/`SPE-*`/`MDE-*`; ia menunjuk kombinasinya. |',
  '',
].join(NL), 'glossary-10');

console.log(rep.join(NL));
