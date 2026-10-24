import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const p = 'C:/SICA/docs/ROADMAP_TASKS.md';
let s = readFileSync(p, 'utf8');

const L = [
  '### 2.20 Gelombang ketujuh — gugus `M47-*`: 47 modul bisnis + SuperApp dijabarkan top-down (2026-10-20)',
  '',
  '> **Apa yang bagian ini tambah dan apa yang tidak.** Pemilik produk memberi 47 modul bisnis (`M-01`…`M-47`) + 1 SuperApp dan minta roadmap top-down per peran. Registri induk, pemetaan entitlement, dan vonis deduplikasi sudah ditulis di [PRD §5.12](file:///c:/SICA/docs/PRD.md) dan §5.13; objek dan nomor di [DATA_MODEL §22](file:///c:/SICA/docs/DATA_MODEL.md); peristiwa dan rantai di [ARCHITECTURE §13](file:///c:/SICA/docs/ARCHITECTURE.md); rute di [API_SPEC §7](file:///c:/SICA/docs/API_SPEC.md); izin di [RBAC_MATRIX §4.5.1](file:///c:/SICA/docs/RBAC_MATRIX.md); layar di [UI_UX_DESIGN §17–§18](file:///c:/SICA/docs/UI_UX_DESIGN.md); kontrol di [SECURITY_COMPLIANCE §13](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md); adapter di [INTEGRATIONS §6](file:///c:/SICA/docs/INTEGRATIONS.md). **Bagian ini tidak menambah spesifikasi**; ia hanya menaruh pekerjaan pada urutan yang benar. Karena itu `M47-*` adalah **irisan pelaksanaan**, bukan sistem penomoran keempat: ID yang masuk tiket, sprint, dan pesan commit tetap `R-*`, `W-*`, `SEC-*`, `DOC-0`, `MDE-*`, `SPE-*`, `ENT-*`, `LFC-*`, sedangkan `M47-*` menunjuk kombinasi semuanya — pola yang sama dipakai §2.18 untuk Fase 1A/1B.',
  '',
  '**Angka yang menjadi dasar urutan (diukur 2026-10-20, bukan dikutip dari laporan agen).** 234 FR unik, 75 di antaranya lahir di `PRD §5.14`; 22 nomor migrasi baru `0051`–`0072` dengan **nol** berkas nyata (`ls packages/database/migrations/` = 7); register `RBAC §4.5` kini sampai baris **291** (130 baris baru, seluruhnya berstatus usulan; 222 normatif, 17 `ROLE_CODES`, 607 grant **tidak berubah**); register kode error `API_SPEC §2.3` = baris **1…144** tanpa duplikat, di mana 119–144 adalah gugus ini; 42 peristiwa kanonik; ALG-19…ALG-24; `SC-G4-01…36`; temuan kode baru `SEC-26`…`SEC-31`. Tally cakupan `PRD §5.12.1`: 11 `PENUH`, 23 `SEBAGIAN`, 14 `NOL` dari 48 baris.',
  '',
  '#### 2.20.1 Sembilan irisan eksekusi',
  '',
  [
    '| Irisan | Isi yang boleh dimulai | Lapisan | Modul `M-xx` | Nomor yang sudah punya pemilik | Gerbang yang harus sudah lewat |',
    '|---|---|---|---|---|---|',
    '| `M47-0` | Pondasi penegakan: delapan butir `SEC-0`, `DOC-0`, promosi izin 146–161 dan 162–291 ke `PERMISSION_SPECS`, primitif `allowedActions` | prasyarat semuanya | M-01, M-02, M-03, M-05 | `API_SPEC §2.3` baris 144; `SPE-3`, `SPE-15` | Tidak ada dokumen yang menunggu. Justru baris ini yang menahan yang lain (`G-18`, `G-23`) |',
    '| `M47-1` | Data master, parameter, dan menu dinamis sebagai satu mesin: `0047`–`0050` diterapkan lalu layar `/admin/pengaturan/*` dibuka | `R-2` | M-02, M-03 | `MDE-1`…`MDE-12`, `SPE-1`…`SPE-11` | `M47-0`; `0011`/`0012`; 66 kunci parameter `PRD §5.14.5` wajib punya `consumerEvidence` sebelum ada layarnya |',
    '| `M47-2` | Inti akademik yang sudah `PENUH` diangkat menjadi nyata: kurikulum OBE, KRS War dan perwalian, jadwal dan ruang, moda, presensi, nilai dan KHS | `R-3a`, `R-4` | M-12, M-13, M-14, M-15, M-18, M-19 | ALG-1…ALG-18; `0036`–`0046` | `M47-1`; vonis 8 dan 9 `PRD §5.13` (satu penulis jadwal, satu penulis vonis kehadiran); ambang dibaca dari parameter, bukan `>= 75` di service |',
    '| `M47-3` | Keuangan penuh: komponen biaya, matriks tarif, VA multi-kanal, rekonsiliasi, cicilan, dispensasi | `R-3b` | M-10, M-11 (sebagian) | `0021`, `0022`, `0046`, `ENT-4`, `ENT-5`; vonis 5 | `M47-2` karena tagihan butuh enrollment nyata; `DOC-0` kosakata ledger; BR-K2 memaksa pemohon berbeda dari penyetuju |',
    '| `M47-4` | Siklus mahasiswa hilir: TA dan RAMA, kemahasiswaan dan SKKM, KKN/PKL/magang, MBKM, simulasi lulus | `R-4` | M-20, M-24, M-25, M-26, M-38 | `0045`, `0064`, `0066`; ALG-4, ALG-6, ALG-16; vonis 1 dan 2 | `M47-2`; hanya satu konverter kredit, sehingga usulan M-25 dan M-29 masuk lewat gerbang ALG-16, bukan jalur kedua |',
    '| `M47-5` | Layanan yang hari ini `NOL` dan tidak menyentuh data kelas khusus: helpdesk, e-library, aset, humas dan event, asrama dan kantin | `R-2` lalu `R-5` | M-04, M-39, M-40, M-42, M-43 | `0051`, `0065`–`0068`, `0070`; `API_SPEC §7.1`, §7.11–§7.15 | `M47-1` (kamus dan parameter lebih dulu); vonis 6 melarang PBJ menulis kartu aset, vonis 3 memaksa bebas pustaka menjadi sinyal |',
    '| `M47-6` | SDM, riset, dan luaran: HRIS dan payroll, SISTER, LPPM dan Litabmas, jurnal, HAKI | `R-3b`, `R-6a` | M-06, M-07, M-08, M-21, M-22, M-44 | `0053`–`0055`, `0061`–`0063`; ALG-19, ALG-21, ALG-24; vonis 7 | `M47-3` karena pencairan hanya lewat jurnal M-10; keputusan katalog `hris` terhadap `hr_bkd` di `PRD §5.12.4` harus diputus pemilik sebelum satu migrasi ditulis; SISTER adalah transport tanpa hak tulis angka BKD |',
    '| `M47-7` | Pendapatan eksternal: CRM PMB, e-procurement, dana abadi, career center, KUI dan mobilitas | `R-6a` | M-28, M-29, M-45, M-46, M-47 | `0053`, `0057`–`0060`, `0069`; ALG-20, ALG-23, ALG-24; vonis 6, 12, 13 | `M47-3` dan `M47-6`; lead dilarang membuat pendaftar kedua (`crm.lead.converted` memanggil service M-09); 32 tanda `[VERIFIKASI-RESMI]` di `INTEGRATIONS §6` lulus lebih dulu |',
    '| `M47-8` | Data kelas khusus dan permukaan real-time: PPKS, klinik dan rekam medis, proctoring M-17, SSE dan WebSocket, verifikasi publik PIN/SIVIL | `R-6b` | M-17, M-35, M-36, M-41 | `0052`, `0071`, `0072`; `SC-G4-01`…`SC-G4-36`; `API_SPEC §7.10`, §7.13, §7.20, §7.21 | Gerbang paling keras: `SEC-01` dan `SEC-31` (MFA nyata), `SC-G4-11` (kunci dan RLS), vonis 14 (isi kasus tidak terbaca Admin IT), ALG-22 dinyatakan design-only sampai model lokal nyata. Penahan rilis didaftar di `SECURITY §13.8` |',
    '',
  ].join(NL),
  '',
  '**Cara memakai tabel ini di rapat produk.** Bila pemilik menyebut M-41, jawabannya bukan "kerjakan M-41", melainkan: M-41 berada di `M47-8`; gerbangnya `SC-G4-11`, `SEC-30`, dan vonis 14; dan sampai ketiganya lewat, yang boleh dikerjakan hanyalah DDL, kontrak, dan layar dengan keadaan `hiddenByDesign`. Inilah alasan `AGENTS §3.11` ada: skema, izin, rute, layar, baru kode — bukan sebaliknya.',
  '',
  '#### 2.20.2 Yang tidak berubah karena 47 modul muncul',
  '',
  '- **Urutan `SEC-0` lalu `DOC-0` lalu `R-1…R-7` tetap.** Empat puluh tujuh modul tidak membeli hak menulis rute di atas guard yang masih fail-open; `M47-0` menjadi irisan pertama justru karena itu.',
  '- **Satu vonis, satu penulis.** Empat belas butir `PRD §5.13` berlaku untuk seluruh gugus ini. Tidak ada modul baru yang boleh membuka jalur tulis kedua ke `invoices`, `grades`, `enrollments`, `class_schedules`, `attendances`, `mbkm_conversions`, atau `student_clearance`.',
  '- **Angka silang tidak disalin.** Bagian ini menyebut angka beserta tanggal ukur dan alatnya; pemilik angkanya tetap `API_SPEC §2.3`, `RBAC_MATRIX §4.5`, `DATA_MODEL §14.7`, `PRD §5.12.1`. Norma ini lahir dari `RD-55`, dan `RD-61` di `AUDIT_READINESS §14` adalah pelanggaran terbaru yang saya temukan pada pekerjaan saya sendiri.',
  '- **Zero-hardcoding.** Opsi baru (jenis HKI, skema hibah, status akreditasi LAM, kanal VA, mata uang ISO 4217) masuk kamus atau `reference_dictionary_entries`, bukan enum. Ambang baru (SLA tiket, plafon cicilan dompet, jendela pencairan hibah, TTL tantangan MFA) masuk `master_system_parameters` dengan kelas risiko, kecuali yang sudah punya tabel struktural.',
  '',
  '#### 2.20.3 Baris siap-eksekusi pertama setelah dokumen terkunci',
  '',
  '**`SEC-0` tetap nomor satu, dan itu bukan opini roadmap.** Terukur hari ini: `grep -c "delete(" apps/web/src/middleware.ts` = 0; `grep -rn timingSafeEqual apps/web/src` hanya menyentuh dua berkas yang bukan QR; `accuracyMeters` tidak ikut didestruksi di `attendance/qr/scan/route.ts:93` sementara `:217` mengembalikan `accuracyVerified: true`; `violatesSoD()` di `packages/contracts/src/authz.ts:674` tidak punya satu pun pemanggil; dan `auth/mfa/verify` menerima enam digit apa pun. Enam hal itu tidak menunggu dokumen apa pun karena kontraknya sudah tertulis: `API_SPEC §2.3` baris 144 dan §4.1.2, `SECURITY §13.3`, `RBAC §4.5.1`.',
  '',
  'Setelah `SEC-0` hijau, urutan pertama gugus 47 modul adalah **`M47-1`**, bukan modul baru yang paling menarik, karena `MDE-*` dan `SPE-*` adalah hulunya: `0049_system_parameters.sql`, lalu `0050_menu_parameter_permissions.sql`, lalu promosi izin, lalu `GET /settings/effective`, lalu layar `/admin/pengaturan/*`. Berikutnya `M47-2` mengangkat inti akademik yang sudah `PENUH` menjadi nyata, dan `M47-8` (PPKS, klinik, proctoring) dikerjakan **terakhir** karena gerbang kepatuhannya paling berat.',
  '',
  '**Satu kalimat yang harus ada supaya bagian ini tidak terbaca sebagai kemajuan:** seluruh angka di §2.20 adalah **spesifikasi**. Berkas migrasi `0051`–`0072` belum ada, 130 izin baru belum dipromosikan, 26 kode error belum pernah dipancarkan, dan 42 peristiwa belum punya penerbit. Yang berubah siklus ini adalah kelengkapan kontrak, bukan perilaku sistem.',
  '',
];

const anchor = NL + '### 2.19 Rantai lifecycle';
const i = s.indexOf(anchor);
if (i === -1 || s.lastIndexOf(anchor) !== i) { console.log('anchor MISS/AMBIG'); process.exit(1); }
s = s.slice(0, i) + NL + L.join(NL) + s.slice(i + NL.length);
writeFileSync(p, s, 'utf8');
console.log('roadmap-2.20: OK lines=' + L.length);
