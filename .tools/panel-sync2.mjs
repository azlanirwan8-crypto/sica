import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const path = (file) => (file === 'AGENTS.md' ? 'C:/SICA/' : D) + file;
const rep = [];
const append = (file, label, text, guard) => {
  const p = path(file);
  const cur = readFileSync(p, 'utf8');
  if (guard && cur.includes(guard)) { rep.push(file + ' ' + label + ': SUDAH ADA'); return; }
  writeFileSync(p, cur.replace(/\n*$/, NL) + NL + text + NL, 'utf8');
  rep.push(file + ' ' + label + ': OK');
};
const sub = (file, label, a, b) => {
  const p = path(file);
  const cur = readFileSync(p, 'utf8');
  const i = cur.indexOf(a);
  if (i === -1) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (cur.lastIndexOf(a) !== i) { rep.push(file + ' ' + label + ': AMBIG'); return; }
  writeFileSync(p, cur.slice(0, i) + b + cur.slice(i + a.length), 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* 1 — SEED_DATA */
append('SEED_DATA.md', 'sec8', [
  '## 8. Seed kanal vicon, kosakata modus, dan parameter (audit dewan 2026-10-21 — `RD-68`)',
  '',
  '**Kenapa bagian ini ada.** Sebelum 2026-10-21, `SEED_DATA.md` berhenti di §7 (mahasiswa sampel) sementara `DATA_MODEL §21.3` menuntut **28** katalog parameter, `§20.4` menuntut **62** baris kamus enam gugus, dan `§21.10` menuntut enum kanal + kosakata modus. Artinya: semua itu **spesifikasi tanpa jalan uji**. Seed adalah bukti bahwa spesifikasi bisa ditegakkan, karena itu bagian ini ditulis sebagai *kontrak seed*, bukan sebagai skrip jadi.',
  '',
  '### 8.1 Status terukur hari ini (jangan dibaca sebagai janji)',
  '',
  '| Objek | Jumlah yang ditagih | Baris yang benar-benar ter-*seed* | Cara ukur |',
  '|---|---:|---:|---|',
  '| `master_system_parameters` | 28 katalog (§21.3) — termasuk 3 kanal (§21.10.3) | **0** (migrasi `0049` belum ada berkasnya) | `ls packages/database/migrations/` = 7 berkas, tertinggi `0011` |',
  '| `reference_kinds` / `reference_items` | 62 baris kamus (§20.4) | **0** (`0047` belum ada) | sama |',
  '| `reference_dictionary_entries` kelas B nasional (wilayah, sifat pembelajaran `F`/`O`/`M`) | wajib sebelum kirim Feeder | **0** — dan `INTEGRATIONS` menandainya `[VERIFIKASI-KAMUS]` | `grep -rn "VERIFIKASI-KAMUS" docs/INTEGRATIONS.md` |',
  '| `conference_connections` (6 kanal) | 1 baris default `BUILTIN_LMS` per tenant dev | **0** (`0073` belum ada) | sama |',
  '| `attendance.online_min_join_ratio` | baku `0.75`, rentang 0.05–1.00 | **0** | `PRD §5.15.3` AC-VIC-2 |',
  '',
  '### 8.2 Kontrak seed yang harus ada sebelum satu kanal pun diklaim',
  '',
  '1. **Dev, idempoten, dan tanpa rahasia.** Seed hanya menulis `credential_ref` menunjuk entri ENV (`env:TEAMS_CLIENT_SECRET_REF` dsb.), tidak pernah nilai rahasia; seed yang mengandung token harus ditolak penguji (`SECURITY §7`).',
  '2. **Deterministik.** Urutan baca `ORDER BY sort_order, code` (norma `AGENTS §3.10`); tidak ada seed yang bergantung pada urutan UUIDv7.',
  '3. **Kelas B tidak dapat diubah tenant.** Entri nasional (wilayah, `sifat_pembelajaran` `F`/`O`/`M`) di-seed sebagai `is_system = true`; tenant hanya memetakan label. Uji penolakan: `UPDATE` oleh peran kampus harus gagal.',
  '4. **Parameter kanal ikut riwayat.** Seed menulis baris `parameter_history` dengan `requested_by` ≠ `approved_by` (empat-mata ditegakkan `CHECK` di DB, bukan oleh niat).',
  '5. **Alias kosakata dimigrasi, bukan dibiarkan.** Seed dev memakai `BLENDED`; pengujian wajib menolak `HYBRID`/`OFFLINE`/`TEAMS`/`BUILTIN` pada jalur tulis (`DATA_MODEL §21.10.2`, `0075`).',
  '',
  '### 8.3 Kriteria selesai bagian ini (terukur, bukan naratif)',
  '',
  '- Setelah `0047`/`0049`/`0073` ada, `node .tools/seed-count.mjs` harus mencetak: parameter ≥ 28 kunci, kamus ≥ 62 kind/item, `conference_connections` = 6 baris (satu default), dan **0** baris kamus kelas B dengan `is_system = false`.',
  '- `PRD §5.15` AC-VIC-2 dapat dieksekusi: ambang 0,75 dibaca dari DB, bukan dari kode.',
  '- Sampai hari ini kedua hal itu **belum** dapat dieksekusi; baris status §8.1 adalah kenyataannya.',
].join(NL), '## 8. Seed kanal vicon');

/* 2 — MIGRATION_SOP */
append('MIGRATION_SOP.md', 'sec6', [
  '## 6. Enam puluh lima nomor ke depan dan tiga migrasi kanal (audit dewan 2026-10-21)',
  '',
  '**Realitas yang harus disebut lebih dulu.** Registry §5 menutup daftar pada berkas yang benar-benar ada. Terukur hari ini: `ls packages/database/migrations/*.sql` = **7 berkas** (`0001`–`0006`, `0011`), sementara dokumen menuntut sampai **`0075`** — artinya **68 nomor** masih berupa spesifikasi. Tidak ada satu pun perintah di bawah ini yang boleh dijalankan sebelum berkasnya nyata; urutan di bagian ini adalah urutan **penulisan berkas**, bukan urutan eksekusi di produksi.',
  '',
  '### 6.1 Tiga migrasi kanal vicon (`0073`–`0075`)',
  '',
  '| Nomor | Isi | Pola | Alasan pilihan itu |',
  '|---|---|---|---|',
  '| `0073_conference_channels.sql` | enum `conference_provider` + `conference_connections` + `conference_meetings` + `conference_channel_events` + ALTER `classes.virtual_meeting_provider` (ADD COLUMN baru) + 3 baris parameter | **Expand** | kolom lama tidak dihapus; sistem masih bisa berjalan sebelum kontrakt jelas |',
  '| `0074_attendance_channel_evidence.sql` | `attendance_channel_evidence` + `ALTER attendances ADD COLUMN review_state DEFAULT \'NONE\'` | **Expand** | ADD COLUMN ber-default pada tabel panas (presensi) **wajib** `NOT NULL DEFAULT` tanpa rewrite massal; jalankan dengan `lock_timeout` pendek + `statement_timeout` di luar jam kuliah (`AGENTS §3.7`) |',
  '| `0075_modality_vocabulary_fix.sql` | rename `classes.delivery_mode` → `learning_modality` + pemetaan alias `HYBRID`→`BLENDED`, `OFFLINE`→`ONSITE`, `TEAMS`→`MICROSOFT_TEAMS`, `BUILTIN`→`BUILTIN_LMS`, `MEET`→`OFFLINE_MEET` pada CHECK | **Expand-and-Contract** dalam dua rilis | Release A: tambah kolom/nilai baru + backfill + views kompatibilitas; Release B (setelah nol pembaca kolom lama terverifikasi): `DROP` kolom lama. Tidak ada rename satu langkah di tabel yang dibaca Feeder/LKPS |',
  '',
  '### 6.2 Empat penjaga yang berlaku untuk ketiganya',
  '',
  '1. **Nomor diukur sebelum ditulis.** Cara ukur: ambil maksimum dari `DATA_MODEL §14.7` + `§22.9` (hari ini `0075`), jangan dari tebakan; `0076` berikutnya harus lewat §22.9 lebih dulu (`AGENTS §3.11`).',
  '2. **`CREATE TYPE … AS ENUM` tidak boleh ditambah nilainya di belakang `ALTER TYPE … ADD VALUE` pada transaksi yang sama** di PostgreSQL yang dipakai; bila butuh nilai baru, buat transaksi terpisah atau pakai `text + CHECK` kelas A-prime. Karena itu `conference_provider` ditetapkan **enam nilai sekaligus** di `0073` (menambah kanal baru = migrasi, dan itu disengaja).',
  '3. **Rollback teruji, bukan tertulis.** `0073`/`0074` reversibel dengan `DROP TABLE` + `DROP COLUMN` (belum ada pemakai). `0075` **tidak** reversibel setelah Release B; rollback-nya adalah *restore snapshot*, dan itu harus ditulis di prosedur §4, bukan di kode migrasi.',
  '4. **Gerbang data.** Setelah `0075` Release A, query `DATA_MODEL §21.10.5 (r)` wajib 0 baris untuk seluruh tabel; CI menolak sebelum itu. Setelah Release B, `grep -rn "delivery_mode\\|HYBRID"` atas `apps/` dan `packages/` tidak boleh menyentuh kolom lama.',
].join(NL), '## 6. Enam puluh lima nomor');

/* 3 — ISSUE_RESOLUTION */
append('ISSUE_RESOLUTION.md', 'sec6', [
  '## 6. Klasifikasi insiden kanal vicon (audit dewan 2026-10-21)',
  '',
  'Kanal konferensi punya bentuk kegagalan yang tidak tercakup taksonomi §1–§3: ia **aset eksternal yang tidak mengubah fakta tetapi dapat menghentikan perhitungan kehadiran**. Tabel ini mengikat gejala ke kelas, SLA, dan — yang paling penting — ke **apa yang tidak boleh terjadi selama insiden** (angka akademik ditampilkan apa adanya).',
  '',
  '| Gejala | Kelas (`§1`) | Sevir | SLA tangani | Yang dilarang selama insiden | Tindakan penahan |',
  '|---|---|---|---|---|---|',
  '| Semua kanal mati saat sesi `SYNC_LIVE` berjalan | Kapasitas/layanan | **HIGH** | 30 menit | dilarang membuat sesi "hadir" tanpa bukti; dilarang menampilkan rasio parsial sebagai angka final | `BR-VIC-05`: `CHANNEL_UNAVAILABLE` di layar; vonis tertahan; notifikasi pengampu + Admin IT |',
  '| Kredensial kedaluwarsa / `401` berulang ke Graph | Keamanan-integrasi | **HIGH** | 1 jam (rotasi) | dilarang menyimpan token di log atau mengirimnya sebagai `credential_ref` | rotasi vault; `last_probe_state = FAILED`; kanal ditarik dari rantai |',
  '| Laporan kehadiran vendor tidak cocok dengan bukti internal | Mutu data | **MEDIUM** | 1 × 24 jam | dilarang menimpa vonis dengan laporan vendor (`§6.2 INTEGRATIONS`, vonis 4 `ARCHITECTURE §13.3`) | selisih masuk antrean telaah `NEEDS_REVIEW`; bukti ditandai `degraded` |',
  '| Satu peserta terhitung dua identitas (upn berubah) | Mutu data/PII | **MEDIUM** | 1 × 24 jam | dilarang mencocokkan lewat pencarian nama bebas | pencocokan ulang lewat blind index salt tenant (`SECURITY §3.7.2`) |',
  '| `payload_digest` tidak cocok / muatan ditolak | Keamanan | **HIGH** | 30 menit | dilarang memproses muatan yang gagal pembuktian meski bentuknya benar | tolak + alarm; tidak ada baris peristiwa yang ditulis |',
  '| Ambang 75 % diubah tanpa persetujuan kedua | Tata kelola | **HIGH** (kepatuhan) | 4 jam | dilarang menerapkan versi baru ke sesi berjalan | `parameter_history` dibekukan; rollback ke `parameter_version` sebelumnya |',
  '',
  '**Satu kalimat RCA yang wajib ada (format §4).** Untuk insiden kanal, bagian "penyebab akar" harus menyebut **salah satu** dari: konfigurasi kredensial, kontrak vendor yang berubah, kegagalan *fallback chain*, atau ketergantungan pada laporan vendor sebagai sumber tunggal. Empat hal itu adalah satu-satunya penyebab yang pernah terbukti di dokumen ini; kalau RCA menyebut "kode presensi salah", itu artinya kelas lain dan harus di-*route* ulang.',
  '',
  '**Daftar periksa pasca-insiden.** (1) vonis akhir tidak memakai `degraded = true`; (2) `conference_channel_events` tidak mengandung PII telanjang; (3) rantai fallback yang dipakai tercatat di `last_probe_*`; (4) tidak ada baris `attendances` ganda per `(sesi, mahasiswa)` (query `(t)` `DATA_MODEL §21.10.5`).',
].join(NL), '## 6. Klasifikasi insiden kanal vicon');

/* 4 — TESTING_STRATEGY */
append('TESTING_STRATEGY.md', 'sec6', [
  '## 6. Uji kanal vicon dan kosakata tunggal (audit dewan 2026-10-21)',
  '',
  'Bagian ini tidak menambah klaim "sudah diuji" — semuanya **belum** karena `0073`–`0075` belum ada berkasnya. Yang ditetapkan di sini adalah bentuk uji yang harus ada sebelum satu baris pun di `PRD §5.15` boleh disebut berjalan.',
  '',
  '| Uji | Jenis | Yang dibuktikan | Perintah/gerbang |',
  '|---|---|---|---|',
  '| **Kontrak kanal tiruan** (Graph, BBB, Zoom) | integrasi, tanpa egress nyata | pemetaan laporan kehadiran → `join_seconds` = **jumlah irisan interval**, bukan `lastLeave − firstJoin`; tiga upaya bergabung dihitung benar | `vitest` dengan server tiruan; fixture disimpan di repo |',
  '| **Idempotensi peristiwa** | integrasi | peristiwa ganda → satu baris + `processing_state = DUPLICATE`; tidak ada duplikat `attendances` per `(sesi, mahasiswa)` | query `(t)` `DATA_MODEL §21.10.5` sebagai asersi |',
  '| **Ambang berversi** | unit + golden | laporan periode lalu menghasilkan angka identik dengan `parameter_version` yang sama; ambang baru tidak mengubah vonis lama | golden vector + perbandingan byte |',
  '| **Daftar-terlarang PII** | statis | `conference_channel_events` dan log tidak mengandung email/NIM/nama lengkap | scanner atribut (pola `AGENTS §3.9` gerbang l) |',
  '| **Tolakan alias** | unit | tulis `HYBRID`/`OFFLINE`/`TEAMS`/`BUILTIN`/`MEET` ditolak; baca masih dipetakan lewat satu mapper | `422 PARAM_VALUE_NOT_ALLOWED` (baris 145) sebagai ekspektasi |',
  '| **Turun-mutu berantai** | integrasi | kanal utama mati → rantai dicoba berurutan; hasil akhir `degraded` terlihat di layar, tidak ada kunci nilai | uji penolakan, bukan uji happy-path |',
  '',
  '**Paritas Web ↔ Flutter (`AGENTS §3.4`).** Proyeksi `HADIR_ONLINE`/`HADIR_MIXED` dihitung **server**; klien hanya merender label. Uji paritas membandingkan *proyeksi server* yang sama untuk dua platform, bukan dua implementasi perhitungan. Angka ambang dan pembulatan memakai `numeric`, bukan `float` (ADR-5).',
  '',
  '**Gerbang yang sudah ada hari ini dan bisa dijalankan.** `node .tools/vocab-audit.mjs` (satu kosakata per konsep), `.tools/chain-audit.mjs` (rantai pemilik punya peristiwa penerbit), `.tools/event-cite-audit.mjs` (rujukan peristiwa tanpa katalog), `.tools/error-dup.mjs` (nomor↔nama kode error konsisten), `.tools/rbac-count.mjs` (nomor izin tanpa lubang), `.tools/ddl-owner.mjs` (satu nama satu `CREATE TABLE`), `.tools/seed-count.mjs` (**belum dibuat** — bagian dari `RD-68`).',
].join(NL), '## 6. Uji kanal vicon');

/* 5 — DEPLOYMENT_DEVOPS */
append('DEPLOYMENT_DEVOPS.md', 'sec5', [
  '## 5. Kanal vicon di produksi: egress, webhook, dan rotasi (audit dewan 2026-10-21)',
  '',
  'Penambahan ini tidak mengubah topologi §4; ia menambahkan tiga batasan operasional yang muncul karena kanal eksternal ikut mengirim data ke sistem.',
  '',
  '1. **Webhook hanya lewat jalur yang bisa diaudit.** `POST /api/v1/webhooks/conference/:provider` (`API_SPEC §4.19`) berada di belakang *edge* yang sama dengan webhook pembayaran §1.8: verifikasi pembukti sebelum antrean, `Idempotency-Key` per `(tenant, provider, external_event_id, event_type)`, dan **tidak pernah** diproses sinkron di rute HTTP (pekerjaan berat masuk worker). `413`/`429` dari sisi vendor tidak boleh berubah menjadi `500` untuk pengguna. ',
  '2. **Egress terdaftar dan terukur.** Daftar keluar yang sah: endpoint Graph/Zoom/Meet/BBB/Jitsi sesuai kanal `enabled`. Tidak ada egress lain dari modul ini (`AGENTS §3.9`: nol API key untuk mesin; kanal = transport, tetapi tetap harus muncul di daftar egress dan audit jaringan). Di lingkungan tanpa akses keluar, kanal luar **harus** tetap gagal-closed dan sistem berpindah ke `BUILTIN_LMS`/BBB *self-host* sesuai `conference.fallback_chain` — bukan sebaliknya.',
  '3. **Rotasi tanpa memutus sesi.** Rahasia kanal di-*rotate* lewat vault/ENV + `last_probe_*` sebagai penjaga: probe gagal → kanal ditarik dari rantai lebih dulu, baru rahasia lama dinonaktifkan. Sesi yang sedang berjalan **tidak** dipindah paksa (`FR-VIC-07`); pemindahan terjadi pada sesi berikutnya.',
  '',
  '**Kapasitas dan pengukuran.** Sesi `SYNC_LIVE` 1.000+ peserta tidak mengubah perhitungan DB apa pun: peristiwa join/leave mengalir ke `conference_channel_events` (insert-only, `bigint` identitas) dan di-*flush* per batch oleh worker, mengikuti aturan presensi massal §3.7 `AGENTS`. Yang diuji beban adalah **laju peristiwa per kanal**, bukan jumlah kartu di layar; target dan bentuk ujinya ditetapkan di `TESTING_STRATEGY §6`, bukan di dokumen ini.',
  '',
  '**Dasbor dan alarm.** Empat keadaan yang wajib tampak di operator: kanal `FAILED`, rasio `degraded` naik tiba-tiba, antrean tarik laporan kehadiran menua, dan `payload_digest` penolakan berulang. Ketiganya punya kelas insiden di `ISSUE_RESOLUTION §6`.',
].join(NL), '## 5. Kanal vicon di produksi');

/* 6 — GLOSSARY */
append('GLOSSARY.md', 'sec11', [
  '## 11. Leksikon kanal vicon (audit dewan 2026-10-21)',
  '',
  '| Istilah | Arti yang dipakai di dokumen ini |',
  '|---|---|',
  '| Kanal vicon | Transport pertemuan daring. Enam nilai sah (`conference_provider`): `BUILTIN_LMS`, `BBB`, `JITSI`, `GOOGLE_MEET`, `MICROSOFT_TEAMS`, `ZOOM`. Rumah: `DATA_MODEL §21.10.1`. Kanal **bukan** pemilik fakta (`INTEGRATIONS §6.2`). |',
  '| Fallback chain | Urutan kanal percobaan, parameter `conference.fallback_chain` (kelas `TECHNICAL`, empat-mata + MFA). Bukan daftar prioritas tersembunyi di kode. |',
  '| Bukti kanal | Baris `attendance_channel_evidence` (`0074`) berisi `join_seconds`, `session_seconds`, `ratio`, dan flag `degraded`. Bukti, bukan vonis. |',
  '| `HADIR_ONLINE` | **Label proyeksi**: `attendance_status = PRESENT` ∧ kanal ∈ register ∧ `ratio ≥ attendance.online_min_join_ratio`. Bukan nilai enum baru; tag Feeder-nya `O` (kamus belum di-*seed* → tidak ikut kirim). Lihat `PRD §5.15.3`. |',
  '| `review_state` | Penanda banding pada `attendances` (`NONE`/`PENDING`/`GRANTED`/`REJECTED`, `0074`). Mengganti salah paham "`PENDING_REVIEW` sebagai status kehadiran" (`RD-70`). |',
  '| Turun-mutu (`degraded`) | Keadaan ketika hanya laporan vendor yang ada (kanal internal mati) atau laporan basi. Angka tampil dengan flag, **tidak dapat dikunci** sebagai angka akademik (`BR-VIC-02`). |',
  '| Kosakata kalah | Token lama yang masih dibaca tetapi ditolak saat tulis: `TEAMS`, `BUILTIN`, `HYBRID`, `OFFLINE`, `ONLINE_SYNC`, `ONLINE_ASYNC`, `MEET` (kanal kontak). Register: `DATA_MODEL §21.10.2`. |',
  '| `x` kanal tanpa kunci vendor | `BUILTIN_LMS`, `BBB`, `JITSI` pada jalur *self-host*: nol API vendor, tetap butuh kredensial internal (mis. `BBB_API_SECRET`) yang disimpan di ENV/vault (`ENV_CONTRACT §7`). |',
].join(NL), '## 11. Leksikon kanal vicon');

/* 7 — INDEX */
append('INDEX.md', 'sec8', [
  '## 8. Peta audit dewan 2026-10-21 (kanal vicon, kosakata tunggal, dan cakupan berkas)',
  '',
  '| Yang diperiksa silang | Berkas pemilik | Bagian | Vonis |',
  '|---|---|---|---|',
  '| Kebutuhan kanal + ambang hadir daring | PRD.md | §5.15 (FR-VIC-01…07, BR-VIC-01…05, AC-VIC-1…4, lima penolakan) | norma |',
  '| Enum kanal, objek `0073`–`0074`, alias kalah, query CI | DATA_MODEL.md | §21.10 (+ §21.3 baris 26–28, §22.9, §15.2/§15.3) | spesifikasi |',
  '| Rute kanal + 5 kode error baru | API_SPEC.md | §4.19, §2.3 (baris 145–149), §4.18.3 | spesifikasi |',
  '| Titik aksi kanal + sel sub-detail | RBAC_MATRIX.md | §4.5.2 (baris 292–297), §6.7.6 | usulan |',
  '| Kontrak Microsoft Teams (muatan, kegagalan, uji) | INTEGRATIONS.md | §6.8 | spesifikasi dengan `[VERIFIKASI-VENDOR]` terbuka |',
  '| Variabel kredensial kanal | ENV_CONTRACT.md | §7 (dan catatan penomoran §5) | spesifikasi |',
  '| Pola migrasi expand-and-contract kanal | MIGRATION_SOP.md | §6 | prosedur |',
  '| Klasifikasi insiden kanal | ISSUE_RESOLUTION.md | §6 | prosedur |',
  '| Bentuk uji kanal dan kosakata tunggal | TESTING_STRATEGY.md | §6 | terjadwal |',
  '| Egress, rotasi, kapasitas peristiwa | DEPLOYMENT_DEVOPS.md | §5 | prosedur |',
  '| Seed kanal, parameter, kamus | SEED_DATA.md | §8 | kontrak seed (belum runnable) |',
  '| Istilah kanal | GLOSSARY.md | §11 | norma |',
  '| Urutan eksekusi kanal | ROADMAP_TASKS.md | §2.21 (`VCN-1`…`VCN-5`) | terjadwal |',
  '',
  '### 8.1 Ralat cakupan: "20 berkas" vs isi repo yang sebenarnya',
  '',
  'Permintaan audit menyebut **20 berkas** dan menyebut pilar UI Velzon. Terukur: `/docs` berisi **24** berkas `.md` (+ `AGENTS.md`), dan empat berkas yang tidak termasuk daftar 20 itu **memiliki** norma yang ditagih pilar yang sama:',
  '',
  '| Berkas di luar daftar 20 | Yang ia pemilikkan | Kenapa tidak boleh dilewat |',
  '|---|---|---|',
  '| `UI_UX_DESIGN.md` | grid kartu dinamis per peran (§17, 73 baris peran→kartu) dan pola layar 12 blok (§18) | pilar UI Velzon **tidak punya rumah** tanpa berkas ini |',
  '| `TECH_CONVENTIONS.md` | konvensi kode, struktur direktori, dan daftar pustaka yang boleh dipakai (§6) | gerbang "design-only vs nyata" bertumpu pada §6 ini |',
  '| `TESTING_STRATEGY.md` | piramida uji dan gerbang CI | tanpa ini, spesifikasi tidak bisa dibuktikan |',
  '| `BENCHMARK_SEVIMA.md` | bukti pembanding Sevima dan delta `BENCH-*` | klaim "parity 100%" berasal dari berkas ini, bukan dari PRD |',
  '',
  '**Vonis.** Cakupan audit = **24 berkas + `AGENTS.md`**. Daftar 20 diperlakukan sebagai subset prioritas, bukan sebagai batas. Ini kelas ralat yang sama dengan `RD-57` (nama berkas yang ditagih tidak ada) — bedanya, di sini berkasnya ada tapi tidak disebut. Agen berikutnya wajib bekerja terhadap 24 berkas; kalau memang hanya 20 yang mau dipelihara, empat berkas itu harus dinormakan sebagai turunan dan kehilangan status pemilik — dan itu keputusan pemilik, bukan keputusan agen.',
].join(NL), '## 8. Peta audit dewan');

/* 8 — AGENTS: satu baris rute + satu guardrail kanal */
sub('AGENTS.md', 'route-row',
  '| **Cetak biru enterprise, state machine & peta field** |',
  [
    '| **Kanal vicon (Microsoft Teams/Zoom/Meet/BBB/Jitsi), kosakata tunggal modus, dan proyeksi hadir daring** | `PRD.md` (§5.15) | `DATA_MODEL.md` (§21.10, `0073`–`0075`), `API_SPEC.md` (§4.19 + register 145–149), `RBAC_MATRIX.md` (§4.5.2 baris 292–297), `INTEGRATIONS.md` (§6.8), `ENV_CONTRACT.md` (§7) |',
    '| **Cetak biru enterprise, state machine & peta field** |',
  ].join(NL));
sub('AGENTS.md', 'guardrail-312',
  NL + '---' + NL + NL + '## 4. Aturan Cursor Rules (`.cursor/rules/`)',
  [
    '### 3.12 Penegakan Kanal Vicon (Sumber Kebenaran: `PRD.md §5.15`, `DATA_MODEL.md §21.10`)',
    '',
    'Rujukan: `API_SPEC.md` §4.19 + §4.18.3, `RBAC_MATRIX.md` §4.5.2, `INTEGRATIONS.md` §6.8, `SECURITY_COMPLIANCE.md` §7/§13, `ENV_CONTRACT.md` §7. Setiap agen **wajib**:',
    '',
    '- **Pakai satu kosakata kanal.** Nilai sah = enum `conference_provider` (`BUILTIN_LMS · BBB · JITSI · GOOGLE_MEET · MICROSOFT_TEAMS · ZOOM`). Dilarang menulis ulang daftar di kontrak, slug webhook, atau kode; slug webhook **turun** dari enum (`lower(provider)`). Alias lama (`TEAMS`, `BUILTIN`) hanya dibaca lewat satu mapper dan ditolak saat tulis.',
    '- **Kanal adalah transport, bukan mesin dan bukan pemilik fakta.** Tidak ada OCR/proctoring/optimasi yang dialihkan ke vendor; vonis kehadiran dihitung M-18 di server. Laporan vendor bersifat pendukung (`INTEGRATIONS §6.2`, `ARCHITECTURE §13.3` vonis 4).',
    '- **Rahasia tidak pernah menjadi parameter atau body.** Hanya `credential_ref` + `ENV_CONTRACT §7`; `DATA_MODEL §21.2` (`is_secret = false`, `source_of_truth` bukan `ENV`) adalah penegaknya. Identifier penyewa tetap server-only.',
    '- **Label hadir daring bukan enum baru.** `HADIR_ONLINE`/`HADIR_MIXED` adalah proyeksi dari (`attendance_status`, kanal, rasio ≥ ambang) + tag Feeder `O`/`M` dari kamus; `attendance_status` tetap lima nilai. Banding memakai `attendance_appeals` (`0017`) + `attendances.review_state` (`0074`), bukan status kedua.',
    '- **Gagal-closed dan jujur saat kanal mati.** `CHANNEL_UNAVAILABLE` dan flag `degraded` wajib terlihat; tidak ada rasio parsial yang boleh dikunci sebagai angka akademik, dan tidak ada fallback diam-diam.',
    '- **Angka registri dihitung, tidak disalin.** Jumlah baris izin: `node .tools/rbac-count.mjs`; konsistensi kode error: `node .tools/error-dup.mjs`; kosakata: `node .tools/vocab-audit.mjs`; rantai peristiwa: `node .tools/chain-audit.mjs`.',
    '',
    NL + '---' + NL + NL + '## 4. Aturan Cursor Rules (`.cursor/rules/`)',
  ].join(NL));

console.log(rep.join(NL));
