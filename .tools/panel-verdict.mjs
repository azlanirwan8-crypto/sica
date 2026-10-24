import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const P = 'C:/SICA/docs/AUDIT_READINESS.md';
let s = readFileSync(P, 'utf8');

if (s.includes('## 15. Vonis dewan tim pakar')) { console.log('SKIP — §15 sudah ada'); process.exit(0); }

const OLD = '## 13. Riwayat tambahan (bagian 2)';
if (s.split(OLD).length !== 2) { console.log('MISS/AMBIG — heading riwayat bagian 2 tidak unik: ' + (s.split(OLD).length - 1)); process.exit(1); }

const SEC15 = [
  '## 15. Vonis dewan tim pakar independen — audit 360° 20 berkas `/docs` (2026-10-21)',
  '',
  '**Cara dewan ini bekerja.** Lima lensa dijalankan atas berkas yang sama, dan setiap vonis wajib menunjuk satu alat ukur yang tersimpan di `.tools/`. Tidak ada lensa yang boleh menyimpulkan dari bacaan semata; tidak ada angka yang ditulis kalau tidak ada perintah yang mencetaknya. Yang diminta dewan adalah kalimat "20 berkas 100% konsisten dan resmi dikunci" — dan bagian ini menjelaskan mengapa kalimat itu **tidak** bisa dikeluarkan hari ini, disertai bukti yang bisa dijalankan siapa pun.',
  '',
  '### 15.1 Lensa 1 — Principal System Architect (integrasi silang dokumen)',
  '',
  '| Tuntutan pillar 1 | Yang diukur | Angka hari ini | Vonis |',
  '|---|---|---|---|',
  '| PRD ↔ DATA_MODEL satu pemilik nama objek | `node .tools/ddl-owner.mjs` | 294 pernyataan `CREATE TABLE`, 294 nama unik, 0 duplikasi; 79 baris entitas `BLUEPRINT §4`, 51 di antaranya bersinggungan dengan DDL dan semuanya punya norma pemilik di `§4.1` | **tercapai di level dokumen** |',
  '| PRD ↔ API_SPEC satu register error | `node .tools/error-dup.mjs` | register §2.3 = 149 nomor, 149 unik, tidak ada lubang; 58 baris turunan diperiksa; 0 ketidakcocokan nomor↔nama; 0 nomor turunan yang tidak ada di register | **tercapai** |',
  '| RBAC ↔ BLUEPRINT_ROLE_BY_ROLE ↔ SECURITY (10 aksi pemilik → 6 verba kanonik) | `node .tools/rbac-count.mjs` | 161 (gel. 1–3) + 130 (gel. 4) + 10 (gel. 5) = **301** baris `usulan`, tanpa lubang nomor; normatif tidak diubah: 222 izin · 17 `ROLE_CODES` · 607 grant | **tercapai sebagai usulan**, BELUM sebagai katalog yang dipromosikan (`VCN-3`) |',
  '| INTEGRATIONS ↔ ARCHITECTURE/API_SPEC untuk Teams, SISTER, Feeder, VA, DJKI | `INTEGRATIONS §6.8` + `API_SPEC §4.19` + `ENV_CONTRACT §7` | sembilan rute kanal; kode 145–149 terdaftar dan belum pernah dipancarkan; muatan Graph/Zoom masih `[VERIFIKASI-VENDOR]`; `env-drift` = 9 variabel design-only | **kontrak ada, bentuk wire belum diverifikasi** — sengaja tidak diakui sebagai selesai |',
  '| DEPLOYMENT/ENV/MIGRATION ↔ SEED/AUDIT 100% sinkron | `heading-dup`, `env-drift`, `seed-count` | urutan heading 1→7 bersih setelah duplikasi `## 5`/`## 7` di `ENV_CONTRACT` dibersihkan; rujukan yatim = 0; sisi nyata `seed-count` = 0 untuk parameter, kamus, dan kanal | **sinkron pada nama dan alat**, belum pada berkas migrasi |',
  '',
  '**Temuan Lensa 1 yang ikut memperbaiki berkas, bukan hanya mencatat:** tabrakan kosakata modus di `classes` (dua kolom satu konsep), `class_sessions.delivery_type` (dua sumbu satu kolom), dan `attendance.reconcile.*` (dua ejaan satu objek di empat berkas) — semuanya ditutup di siklus ini, didaftar sebagai `RD-71` dan `RD-73`.',
  '',
  '### 15.2 Lensa 2 — Spesialis regulasi pendidikan tinggi (53/2023, IKU, SISTER 2.0, Feeder, 30/2021 PPKS, UU PDP, LKPS)',
  '',
  '- **Satu kosakata modus untuk kebutuhan regulasi.** `node .tools/vocab-audit.mjs` mencetak 16 daftar bernama, **0 selisih**, 2 alias terdaftar (`teachingMethod`, `deliveryType` — keduanya berjadwal lepas di `API_SPEC §4.4.1`), 0 nama hitam. Tag Feeder `F`/`O`/`M` kini punya jalan: `learning_modality` (kanonik) + `session_kind` (sumbu kedua) — tetapi **kamus `sifat_pembelajaran` kelas B belum di-*seed***, sehingga vonis `HADIR_ONLINE` belum boleh ikut kirim (`[VERIFIKASI-KAMUS]`, `PRD §5.15.3`).',
  '- **Ambang 75 % bukan angka sistem.** Ia parameter `attendance.online_min_join_ratio` (0,75; rentang 0,05–1,00; kelas `ACADEMIC`; dua penyetuju + MFA) dan ambang asinkron yang terpisah `attendance.async_min_watch_ratio` (0,80) — pemisahan ini penting secara regulasi karena "duduk di kelas daring" dan "menonton modul" adalah dua pembuktian berbeda (`RD-72`).',
  '- **Yang menahan pelaporan nasional, dinyatakan apa adanya:** `0021` (PMB, CP1 `pmb_program_quotas`), `0022` (kanal/VA), `0046` (matriks tarif), `0047`/`0048` (kamus + atribut), `0049`/`0050` (parameter + menu) belum berberkas migrasi; `feeder_environments` belum bernama di `§22`; PPKS M-41 dan klinik M-36 **tidak boleh diaktifkan** sebelum `TENANT_ENCRYPTION_MASTER_KEY` punya pemilik (`SEC-13`, `P-5`).',
  '',
  '### 15.3 Lensa 3 — Auditor enterprise IT (parity Sevima)',
  '',
  '`node .tools/coverage-47.mjs` atas 48 baris registri (47 modul + `APP`): **0 modul tanpa kartu**, 15 tanpa DDL di `DATA_MODEL §22`, 25 tanpa baris rute di `API_SPEC §7`, 28 tanpa blok layar di `UI_UX §18`, 16 tanpa baris izin di `RBAC §4.5.1`. Enam vonis `§5.13` dan register `§6.7` di `INTEGRATIONS` menutupi sebagian angka itu sebagai "memang tidak boleh menerbitkan" atau "dilayani modul induk".',
  '',
  '**Vonis jujur:** klaim "100% parity Sevima" **tidak** bisa dinyatakan. Yang bisa dinyatakan: tidak ada objek Sevima yang dipetakan tanpa rumah nama, dan setiap selisih punya baris `BENCH-*` dengan pemilik. Parity struktural tercapai di level spesifikasi; parity permukaan (layar + rute + DDL) masih 15/25/28/16 terbuka menurut angka di atas.',
  '',
  '### 15.4 Lensa 4 — Insinyur keamanan & kepatuhan (UU PDP 27/2022, SNI/ISO 27001)',
  '',
  '- **Kontrol baru kanal vicon:** `SECURITY §14` `SC-G5-01…10` + tiga temuan `SEC-32`/`SEC-33`/`SEC-34`, semuanya punya cara uji. Rahasia hanya lewat ENV/vault (`credential_ref` pointer), peserta dicocokkan lewat blind index, webhook diverifikasi sebelum disentuh antrean, muatan mentah ber-*expiry* dan terenkripsi, ambang & rantai kanal menuntut MFA + empat-mata.',
  '- **Kenyataan penegakan yang terukur dan tidak ditutup-tutupi:** `SEC-01` MFA fail-open, `SEC-09` helper `withModule` ada tetapi nol *call site*, `SEC-11` `holdsScoped` ada tetapi nol *call site*, `SEC-18` uji RLS masih *in-memory*, `SEC-29` `ATTENDANCE_HMAC_SECRET` masih global lewat `process.env`, `SEC-13`/`P-5` kunci master belum berpemilik. Gerbang `SEC-0` lulus **1 dari 8** butiran.',
  '- **Vonis:** spesifikasi keamanan sudah konsisten internal dan bisa diaudit; **bukti penegakan belum ada**. Karena itu dewan menolak menulis kalimat "aman untuk produksi" dan menggantinya dengan daftar penahan di §15.7.',
  '',
  '### 15.5 Lensa 5 — Principal business analyst (rantai data & pipeline nol-`hardcode`)',
  '',
  '- **Sepuluh rantai pemilik:** `node .tools/chain-audit.mjs` — 30 hop, **0 hop tanpa pendataan**: setiap hop punya peristiwa di katalog `§13.1` (60 peristiwa, 40 penerbit unik), atau punya baris register `§13.1.1` (18 peristiwa yang diminta, lengkap dengan penerbit + prasyarat objek), atau dinyatakan eksplisit sebagai hop non-peristiwa (M-31 → M-32 adalah *read-model*, dilarang menerbitkan menurut aturan butir 3).',
  '- **Lobang naratif yang tersisa:** hanya 24 dari 30 hop muncul di sebuah blok `§13.4`; rantai 9 (yudisium → PIN → SIVIL → tracer) tidak punya satu pun skenario. Didaftarkan sebagai `RD-76` — spesifikasinya ada, simulasi bisnisnya belum.',
  '- **Nol-`hardcode`:** `vocab-audit` hijau; `seed-count` membedakan spesifikasi (33 parameter / 61 kamus / 6 kanal) dari kenyataan (0 / 0 / 0); `placeholder-count` hijau — 54 token `TODO`/`TBD`/`FIXME`/`XXX` seluruhnya **kutipan**, **0** lubang spesifikasi.',
  '',
  '### 15.6 Gap baru siklus ini (`RD-71` … `RD-77`)',
  '',
  '| ID | Temuan | Berkas pemilik | Status |',
  '|---|---|---|---|',
  '| `RD-71` | `classes` memuat **dua** kolom modus (`delivery_mode` ONSITE/ONLINE_SYNC/ONLINE_ASYNC **dan** `learning_modality`), padahal `§21.10.2` sudah memvonis `ONLINE_SYNC`/`ONLINE_ASYNC` sebagai dua-sumbu-yang-dilebur; `class_sessions.delivery_type` melakukan kesalahan yang sama | `DATA_MODEL §4/§19`, `API_SPEC §4.2/§4.3.6` | **ditutup 2026-10-21** — `learning_modality` + `session_kind`, `vocab-audit` hijau |',
  '| `RD-72` | `attendance.async_min_watch_ratio` sudah **dirujuk** `INTEGRATIONS §5.7`/`§6.7` sebelum pernah didaftarkan, sementara ambang asinkron hidup sebagai `DEFAULT 80` di kolom | `DATA_MODEL §21.3`, `INTEGRATIONS`, `SEED_DATA` | **ditutup di dokumen** — baris 29 katalog, `DEFAULT` dilepas; belum ter-*seed* (`0049`) |',
  '| `RD-73` | Empat berkas memakai **kode izin yang tidak ada di katalog** (`attendance.reconcile.view`/`.decide`, `attendance.event.ingest`, `attendance.appeal.request`/`.decide`), dan `§6.7.6` merujuk `attendance.appeal.*` ke `§4.3` yang tidak memuatnya; 10 sel `Modul` di `§4.5.1` memakai nilai di luar 13 `PermissionModule` sah | `RBAC_MATRIX §4.5.2/§6.7.6`, `API_SPEC`, `UI_UX`, `ROADMAP` | **ditutup di dokumen** — baris 298–301, `reconciliation` menang, 15 ganti ejaan lewat `.tools/rename-reconcile.mjs`; promosi ke `PERMISSION_SPECS` masih `VCN-3` |',
  '| `RD-74` | Hop rantai pemilik tidak punya penerbit peristiwa; `hr.bkd.recap.approved` sudah dirujuk `RBAC` baris 173 sebelum tercetak di katalog | `ARCHITECTURE §13.1.1` | **terdaftar** (18 baris berpenerbit + berprasyarat), belum terpasang |',
  '| `RD-75` | Dua cacat kontrak ENV yang ditemukan alat baru: `ENV_CONTRACT §2` menunjuk `packages/config/src/env.ts` yang **tidak ada** (yang nyata `apps/web/src/config/env.ts`), dan `INTEGRATIONS §1.13` menaruh endpoint **per tenant** di variabel **per deployment** | `ENV_CONTRACT`, `INTEGRATIONS` | **sedang ditutup** — rujukan Feeder diralat ke `feeder_environments`/`§7`; heading `§2` masih menunggu pemilik berkas kontrak |',
  '| `RD-76` | **Alat ukur yang salah vonis, lagi.** `chain-audit` v1 mencocokkan pola hop terhadap kolom *konsumen* yang berisi kode modul, bukan kata bisnis → 7 rantai dilaporkan berlobang padahal peristiwanya ada; `vocab-audit` v1 menggabungkan konsep berbeda menjadi satu "kosakata" → 8 daftar palsu; `placeholder-count` v1 tidak memisahkan kutipan → 28 `TODO` dilaporkan sebagai lubang. Semua adalah pengulangan `RD-62` | `.tools/*` | **ditutup 2026-10-21** — ketiga alat ditulis ulang dengan register nama dan register alias; vonis sekarang keluar dari definisi, bukan dari kebetulan bentuk teks |',
  '| `RD-77` | Rantai 9 (yudisium → PIN → SIVIL → tracer) tidak muncul di satu pun blok skenario `ARCHITECTURE §13.4`; 6 dari 30 hop rantai pemilik tidak tersimulasi | `ARCHITECTURE §13.4` | **terdaftar**, belum ditulis |',
  '| `RD-78` | `heading-dup` lahir dari cacat proses sendiri: dua skrip sisip menempelkan blok yang sama **dua kali** di `ENV_CONTRACT` (`## 5` dan `## 7` kembar) dan tidak ada gerbang yang menangkapnya karena `check-docs` hanya menjaga konsistensi kolom tabel | `ENV_CONTRACT`, `.tools/heading-dup.mjs` | **ditutup** — duplikasi dihapus, urutan 1→7, gerbang baru dipasang |',
  '',
  '### 15.7 Vonis penguncian: **BERKUNCI BERSYARAT** (bukan "100% Locked")',
  '',
  '**Yang dinyatakan terkunci** — dan kunci itu dapat diuji, bukan dinyatakan: (1) registri 47 modul + `APP` dengan vonis tanggung-jawab-tunggal; (2) satu kosakata untuk provider kanal, satu untuk modus, satu untuk bentuk pertemuan, satu untuk status presensi, dengan register alias kalah yang menyebut jadwal pelepasannya; (3) satu register error 149 nomor tanpa lubang; (4) satu katalog parameter dan satu katalog kamus dengan kelas A/A′/B/C/D; (5) enam lapis penegakan + `FIELD_RULES`/`SERVER_ONLY` untuk kanal dan presensi; (6) sepuluh rantai pemilik yang setiap hop-nya punya peristiwa, baris register, atau vonis non-peristiwa; (7) **nol lubang spesifikasi** (`placeholder-count` hijau).',
  '',
  '**Yang menahan penguncian tanpa syarat** (tujuh penahan, masing-masing punya nomor dan pemilik — bukan kesan):',
  '1. **Nol implementasi permukaan.** `route-count`: 267 baris rute, `impl = 0`; `find apps/web/src -path "*conference*" -name route.ts` = 0.',
  '2. **Objek belum berberkas.** 7 berkas migrasi nyata vs 294 pernyataan DDL; `0047`/`0049`/`0050`/`0073`/`0074`/`0075` adalah nomor yang belum ada berkasnya (`seed-count`: sisi nyata 0 untuk parameter, kamus, kanal).',
  '3. **301 baris izin masih `usulan`.** Sebelum `gen-rbac-seed.mjs` dijalankan ulang, `API_SPEC §4.19` hanya bisa ditegakkan dengan mengarang string izin — pelanggaran `AGENTS §3.8` (pola `G-15`).',
  '4. **149 kode error belum pernah dipancarkan satu pun.** Register lengkap ≠ jalur error teruji.',
  '5. **Bentuk muatan vendor belum diverifikasi.** `INTEGRATIONS §6.8` menandai langganan Graph dan laporan kehadiran `[VERIFIKASI-VENDOR]`; SDK kanal belum menjadi dependensi nyata (`design-only`, `AGENTS §3.9`).',
  '6. **Penegakan keamanan belum terbukti.** `SEC-0` lulus 1/8; `SEC-01`/`SEC-09`/`SEC-11`/`SEC-18`/`SEC-29` terbuka; `TENANT_ENCRYPTION_MASTER_KEY` belum berpemilik (`SEC-13`, `P-5`).',
  '7. **Kamus kelas B nasional belum di-*seed*,** sehingga tag Feeder `O` untuk `HADIR_ONLINE` **tidak ikut kirim** dan tidak boleh diklaim sebagai fitur berjalan (`[VERIFIKASI-KAMUS]`).',
  '',
  '**Definisi selesai untuk membuka kunci tanpa syarat.** Urutannya tidak boleh dibalik (`AGENTS §3.11`): berkas migrasi `0047`→`0049`→`0050`→`0073`→`0074`→`0075`; promosi gelombang 5 ke `PERMISSION_SPECS` + `gen-rbac-seed --check` sebagai gerbang; deklarasi variabel kanal di `env.ts` + `.env.example`; seed dev idempoten yang membuat `seed-count` mencetak sisi nyata = sisi spesifikasi; satu rute kanal dan satu jalur rekonsiliasi dengan uji penolakan; lalu `chain-audit`, `vocab-audit`, `error-dup`, `rbac-count`, `ddl-owner`, `heading-dup`, `placeholder-count`, `env-drift`, `seed-count` dipasang sebagai gerbang CI, bukan sebagai rutinitas manual.',
  '',
  '**Satu kalimat yang tidak akan ditulis dewan ini:** "20 berkas `/docs` 100% konsisten, terintegrasi, dan resmi dikunci, siap masuk Phase 1." Konsistensi dan integrasi sudah terukur hijau pada dimensi yang bisa diukur; penguncian penuh tidak, karena tujuh penahan di atas adalah fakta berkas, bukan keraguan sikap. Menulis kalimat itu akan mengulang persis `RD-62`: mengklaim angka yang tidak diproduksi oleh alat.',
  '',
  '',
].join(NL);

s = s.replace(OLD, SEC15 + '## 16. Riwayat tambahan (bagian 2)');

const row = [
  '| 1.7 | 2026-10-21 | **§15: vonis dewan lima lensa atas 20 berkas `/docs` (audit 360°).** Delapan gap baru `RD-71`…`RD-78`, semuanya ditutup di level dokumen kecuali yang memang butuh berkas. Perbaikan nyata satu siklus: kosakata modus `classes`/`class_sessions` disatu-sumbukan (`vocab-audit` 16 daftar, 0 selisih), kode izin yatim di empat berkas menjadi baris katalog 298–301 dan 15 ganti ejaan `reconcile→reconciliation`, parameter ambang asinkron didaftarkan (§21.3 nomor 29) dengan `DEFAULT 80` dilepas dari kolom, `ENV_CONTRACT` dibersihkan dari heading kembar dan diberi penjaga baru `heading-dup`, serta tiga alat ukur ditulis ulang setelah terbukti salah vonis (`RD-76`). Angka akhir siklus: 301 baris izin `usulan`, 149 kode error, 294 `CREATE TABLE` unik, 267 baris rute (`impl = 0`), 54 token placeholder seluruhnya kutipan, rantai berlobang tanpa pendataan 0 dari 10. Vonis: **BERKUNCI BERSYARAT** dengan tujuh penahan bernomor di §15.7. |',
  '',
].join(NL);
s = s.replace(/\s+$/, NL) + row;

writeFileSync(P, s, 'utf8');
console.log('§15 disisipkan, riwayat bagian 2 menjadi §16, baris 1.7 ditambahkan');
const heads = s.split(NL).filter((l) => /^## \d/.test(l)).map((l) => l.replace(/^## /, '').split('.')[0].split(' ')[0]);
console.log('urutan heading tingkat-2: ' + heads.join(' → '));
