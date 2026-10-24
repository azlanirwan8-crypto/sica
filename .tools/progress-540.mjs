import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const P = 'C:/SICA/docs/PROGRESS_REPORT.md';
let s = readFileSync(P, 'utf8');
if (s.includes('### 5.40 Siklus 2026-10-21')) { console.log('SKIP — §5.40 sudah ada'); process.exit(0); }

const BLOCK = [
  '### 5.40 Siklus 2026-10-21 — dewan lima lensa atas 20 berkas `/docs`, dan tiga alat ukur yang saya tulis ulang karena salah vonis',
  '',
  '**Permintaan yang masuk.** Audit 360° dan sinkronisasi langsung 20 berkas `/docs` dengan enam pilar (integrasi silang, satu sumber kebenaran + sepuluh rantai, nol-`hardcode`, engine lokal nol-kunci, kanal vicon MS Teams + fallback + presensi otomatis ≥ 75 %, grid Velzon per peran), lalu "PROGRESS_REPORT dan ROADMAP_TASKS menampilkan status 100% Locked Documentation" dan "laporan eksekutif yang mengonfirmasi 20 berkas 100% konsisten, terintegrasi, dan resmi dikunci". Enam pilar pertama dikerjakan dan diukur. Kalimat penguncian **tidak** ditulis apa adanya; alasannya ada di `AUDIT_READINESS §15.7` bersama tujuh penahan bernomor.',
  '',
  '**5.40.1 Yang berubah di berkas, per berkas.**',
  '',
  '- `PRD.md` §5.15 (kanal vicon: register provider, pemisahan parameter/rahasia, proyeksi `HADIR_ONLINE`, FR-VIC-01…07, BR-VIC-01…05, AC-VIC-1…4, lima penolakan).',
  '- `DATA_MODEL.md` §21.10 (`conference_provider`, empat objek kanal + bukti, insert-only, RLS, indeks, query CI (q)–(u)) + §21.3 nomor **26–29** dengan ralat penomoran; `classes` dan `class_sessions` disatu-sumbukan (`learning_modality` + `session_kind`), `min_watch_pct` kehilangan `DEFAULT 80`; §22.9 menambah nomor `0073`–`0075`.',
  '- `API_SPEC.md` §4.19 (9 rute kanal) + kode error 145–149; dua kontrak presensi dipindah ke kosakata kanonik dan `§4.3.8` tidak lagi mengaku izinnya "belum di katalog".',
  '- `RBAC_MATRIX.md` §4.5.2 baris **292–301** (sepuluh izin gelombang 5) + §6.7.6; register alias kalah dipasang; lima sel `Modul` yang memakai nilai di luar 13 `PermissionModule` sah diberi ralat bertanggal.',
  '- `SECURITY_COMPLIANCE.md` §14 (`SC-G5-01…10` + `SEC-32/33/34`); `UI_UX_DESIGN.md` §18.16 (dua layar: `/admin/kanal-vicon`, `/presensi/rekonsiliasi/:sesi`, keadaan `degraded`/`CHANNEL_UNAVAILABLE`/`reviewState`, kunci i18n dua berkas); `ROADMAP_TASKS.md` §2.21 (`VCN-1…5`); `ARCHITECTURE.md` §13.1.1 (18 peristiwa berpenerbit yang diminta rantai pemilik); `INTEGRATIONS.md` §6.8 (kontrak Teams + peta `join_seconds`); `ENV_CONTRACT.md` §7 (13 baris kredensial) + §5/§6 dirapikan; `SEED_DATA.md` §8; `MIGRATION_SOP` §6; `DEPLOYMENT_DEVOPS` §5; `TESTING_STRATEGY` §6; `ISSUE_RESOLUTION` §6; `GLOSSARY` §11; `INDEX` §8; `AGENTS.md` §3.12.',
  '',
  '**5.40.2 Angka siklus ini — dan alat yang mencetaknya.** Semua dapat diulang; tidak satu pun boleh disalin ke dokumen lain (`RD-55`/`RD-62`).',
  '',
  '| Alat | Keluaran 2026-10-21 |',
  '|---|---|',
  '| `placeholder-count` (ditulis ulang) | `TODO` 28, `TBD` 11, `FIXME` 10, `XXX` 5 — **seluruhnya kutipan**, 0 lubang spesifikasi → HIJAU |',
  '| `vocab-audit` (ditulis ulang) | 16 daftar bernama, 0 selisih, 2 alias terdaftar berjadwal, 0 nama hitam → HIJAU |',
  '| `chain-audit` (ditulis ulang) | 60 peristiwa / 40 penerbit; 30 hop rantai pemilik; **0 hop tanpa pendataan**; 1 lobang terdaftar di §13.1.1; 1 hop read-model dinyatakan non-peristiwa; 24/30 hop muncul di skenario → HIJAU |',
  '| `rbac-count` | 161 + 130 + 10 = **301** baris `usulan` tanpa lubang; normatif 222 izin · 17 `ROLE_CODES` · 607 grant tidak berubah |',
  '| `error-dup` | 149 nomor / 149 unik / tidak ada lubang; 58 baris turunan; 0 ketidakcocokan nomor↔nama |',
  '| `ddl-owner` | 294 `CREATE TABLE` / 294 unik / 0 duplikasi; 51 singgungan nama BLUEPRINT↔DDL seluruhnya berpemilik → HIJAU |',
  '| `route-count` | 267 baris rute di 22 gugus: 82 `spec`, 185 `blocker`, **0 implementasi** |',
  '| `roles-audit` | 6 blok peran → 73 kartu; kurang 0, lebih 0 terhadap daftar permintaan pemilik |',
  '| `event-cite-audit` (diperbaiki) | 0 rujukan peristiwa yatim setelah register §13.1.1 dikenali alat; 8 entri registri tanpa penerbit (lima di antaranya memang read-model) |',
  '| `heading-dup` (**alat baru**) | dobel 0, mundur 0 → HIJAU; lahir dari cacat §5.40.3 butir 3 |',
  '| `env-drift` (**alat baru**) | skema 32 deklarasi · `ENV_CONTRACT` 88 pendaftaran · dokumen 24 rujukan; **0 rujukan yatim**; 9 design-only; 1 sudah berpemilik (`SEC-29`) |',
  '| `seed-count` (**alat baru**) | spesifikasi 33 parameter / 61 kamus / 6 kanal; **nyata 0 / 0 / 0** (7 berkas migrasi, tertinggi `0011`) → status `spec-only` |',
  '| `check-docs` 24 dokumen + `AGENTS.md` | `TABEL KONSISTEN`, `cjk=0` di setiap berkas |',
  '',
  '**5.40.3 Cacat yang saya timbulkan sendiri dan harus dicatat (pola berulang, kelima kalinya).**',
  '',
  '1. **Tiga alat ukur saya salah vonis, dan saya nyaris membetulkan dokumen yang benar.** `chain-audit` menuntut pola bisnis cocok dengan kolom *konsumen* yang isinya kode modul, sehingga 7 rantai dilaporkan berlobang padahal peristiwanya ada; `vocab-audit` menggabungkan kamus `campus_sites.kind` dengan kosakata modus sehingga memunculkan "ejaan keempat" fiktif; `placeholder-count` menghitung kutipan `TODO` sebagai lubang. Ketiganya ditulis ulang dengan register nama + register alias, dan kegagalannya kini menjadi gap bernomor (`RD-76`), bukan catatan kaki. Ini persis `RD-62` yang saya tulis sendiri dua siklus lalu.',
  '2. **Dua sisipan karakter asing lagi keluar dari tangan saya**: `U+51B3 U+662F` (dua ideograf Han) di `panel-sync3.mjs` dan `U+51E1 U+662F` di `panel-verdict.mjs`. Yang kedua lebih buruk: pemindai sudah mencetak `nonlatin=4` **sebelum** skrip dijalankan, dan saya tetap menjalankan skripnya — jadi glyphs itu sempat masuk ke dokumen, lalu dikeluarkan lagi pada pass berikutnya. Norma yang sekarang berlaku: keluaran pemindai atas sebuah skrip adalah **gerbang**, bukan informasi; dokumen tidak mengutip glyph non-Latin melainkan **codepoint**-nya; dan payload ber-backtick jangan ditempel lewat `node -e` di shell — ia pecah dan menghasilkan angka palsu (`nonlatin=5` pada siklus lalu). Kesalahan tipografi Latin satu siklus ini: `DUa`, `kolon`, `dispersifikasi`, `ataudeclarasi`, `INTEGATIONS`, `langgananGraph`, `LOHANG`, `dauntur`.',
  '3. **Skrip sisip saya menempelkan blok yang sama dua kali di `ENV_CONTRACT.md`** (`## 5` dan `## 7` kembar, 60 baris dobel), dan **tidak ada satu pun gerbang yang menangkapnya** karena `check-docs` hanya menjaga konsistensi kolom tabel. Ini temuan paling mahal siklus ini: alat validasi saya punya lubang bentuk, bukan hanya lubang angka. Perbaikannya dua lapis — duplikasi dihapus dan urutan dipulihkan (`.tools/fix-env-dup.mjs`), lalu gerbang baru dipasang (`.tools/heading-dup.mjs`, dobel + heading mundur) — supaya kelas kesalahannya yang ditutup, bukan hanya contoh kejadiannya.',
  '4. **Empat berkas memakai kode izin yang tidak pernah ada** (`attendance.reconcile.*`, `attendance.event.ingest`, `attendance.appeal.*`) dan `§6.7.6` merujuk `attendance.appeal.*` ke daftar yang tidak memuatnya; `RBAC §4.5.1` juga memuat 10 sel `Modul` di luar 13 `PermissionModule` sah. Saya perbaiki dua arah: kode menjadi baris katalog 298–301, dan 15 ejaan kalah diganti serentak lewat `.tools/rename-reconcile.mjs` dengan laporan per berkas — bukan dicari-cari manual.',
  '5. **Dua rujukan alat phantom saya ciptakan sendiri sebelum alatnya ada** (`env-drift.mjs`, `seed-count.mjs`). Karena `RD-55` melarang tepat pola ini, keduanya kini nyata dan mencetak angka di tabel §5.40.2; `TESTING_STRATEGY §6` yang tadinya menulis "`seed-count` **belum dibuat**" sekarang menunjuk alat yang bisa dijalankan.',
  '',
  '**5.40.4 Status penguncian (jujur).** **BERKUNCI BERSYARAT.** Enam pilar spesifikasi tercapai dan setiap tuntutan punya alat; tujuh penahan menahan penguncian tanpa syarat, semuanya berupa fakta berkas: `impl = 0` dari 267 rute; `0047`/`0049`/`0050`/`0073`/`0074`/`0075` belum berberkas; 301 izin `usulan` belum dipromosikan; 149 kode error belum pernah dipancarkan; muatan Graph/Zoom masih `[VERIFIKASI-VENDOR]`; `SEC-0` lulus 1/8 dan `SEC-01`/`09`/`11`/`18`/`29` terbuka; kamus kelas B nasional belum di-*seed* sehingga tag Feeder `O` tidak ikut kirim. ROADMAP tidak memuat kalimat "100% Locked"; yang dimuat adalah gugus `VCN-1…5` dan penahan bernomor. Definisi selesai untuk membuka kunci ada di `AUDIT_READINESS §15.7`.',
  '',
  '**5.40.5 Yang tidak dikerjakan siklus ini.** Tidak ada `git add`, `git commit`, atau `git push`; tidak ada satu baris kode produksi pun (tipe, SQL, komponen) yang ditulis — seluruh perubahan berada di `docs/`, `AGENTS.md`, dan `.tools/`. Perintah "dilarang menulis kode sebelum spesifikasi terkunci" masih berlaku, dan justru karena itu vonisnya bersyarat, bukan absolut.',
  '',
  '',
].join(NL);

const ANCHOR = '## 11. Riwayat laporan (bagian 3)';
if (s.split(ANCHOR).length !== 2) { console.log('MISS/AMBIG anchor §11'); process.exit(1); }
s = s.replace(ANCHOR, BLOCK + ANCHOR);

const row = [
  '| 5.40 | 2026-10-21 | **Dewan lima lensa atas 20 berkas `/docs` + pilar ketujuh (kanal vicon).** Vonis **BERKUNCI BERSYARAT** dengan tujuh penahan bernomor (`AUDIT_READINESS §15.7`). Berkas yang disentuh: PRD §5.15, DATA_MODEL §21.3(26–29)/§21.10/§22.9 + pemisahan `learning_modality`/`session_kind`, API_SPEC §4.19 + error 145–149, RBAC §4.5.2 (292–301) + §6.7.6, SECURITY §14 (`SC-G5-01…10`, `SEC-32…34`), UI_UX §18.16, ROADMAP §2.21 (`VCN-1…5`), ARCHITECTURE §13.1.1, INTEGRATIONS §6.8, ENV_CONTRACT §5–7, SEED_DATA §8, MIGRATION_SOP §6, DEPLOYMENT_DEVOPS §5, TESTING_STRATEGY §6, ISSUE_RESOLUTION §6, GLOSSARY §11, INDEX §8, AGENTS §3.12. Enam alat ditulis ulang atau baru (`placeholder-count`, `vocab-audit`, `chain-audit`, `event-cite-audit`, `heading-dup`, `env-drift`, `seed-count`) setelah tiga di antaranya terbukti salah vonis (`RD-76`); gap baru `RD-71`…`RD-78`. Angka akhir: 301 izin usulan, 149 error, 294 DDL unik, 267 rute dengan `impl = 0`, 0 lubang placeholder, rantai berlobang tanpa pendataan 0/10, peran→kartu 73/73. |',
  '',
].join(NL);
s = s.replace(/\s+$/, NL) + row;
writeFileSync(P, s, 'utf8');
console.log('§5.40 + baris riwayat 5.40 ditambahkan');
