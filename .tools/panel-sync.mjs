import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];
const sub = (file, label, a, b) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const i = s.indexOf(a);
  if (i === -1) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(file + ' ' + label + ': AMBIG'); return; }
  writeFileSync(p, s.slice(0, i) + b + s.slice(i + a.length), 'utf8');
  rep.push(file + ' ' + label + ': OK');
};
const append = (file, label, text) => {
  const p = D + file;
  const cur = readFileSync(p, 'utf8');
  if (cur.includes('### 6.8 Microsoft Teams')) { rep.push(file + ' ' + label + ': SUDAH ADA'); return; }
  writeFileSync(p, cur.replace(/\n*$/, NL) + text + NL, 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* 1 — rekap register API_SPEC */
sub('API_SPEC.md', 'recap-149',
  '| Kode error terdaftar di §2.3 | **144** | 65 lama + 13 engine gelombang 1 (66–78) + 13 engine gelombang 2 & objek institusi (79–91) + **15** kamus/atribut kustom dan sisa keadaan gelombang 2 (92–106) + **12** mesin parameter (§4.16), menu dinamis & grant (§4.17), presensi multi-modus (§4.18) = 107–118 + **26** gugus 47 modul (§7.22) dan `MFA_NOT_IMPLEMENTED` (baris 144) = 119–144. Terukur dengan `grep` atas baris §2.3 yang bermula kode HTTP: 144 bernomor, **144 unik**, tanpa lubang. Yang asli dipakai pemancar `error.code` hari ini tetap **12** (baris 1, 3, 5, 6, 10, 11, 12, 13, 14, 15, 27, 28). Yang **benar-benar dikirim** sebagai `error.code` hari ini tetap **12** (baris 1, 3, 5, 6, 10, 11, 12, 13, 14, 15, 27, 28) |',
  '| Kode error terdaftar di §2.3 | **149** | 65 lama + 13 engine gelombang 1 (66–78) + 13 engine gelombang 2 & objek institusi (79–91) + **15** kamus/atribut kustom dan sisa keadaan gelombang 2 (92–106) + **12** mesin parameter, menu dinamis & presensi multi-modus (§4.16–§4.18) = 107–118 + **26** gugus 47 modul (§7.22) dan `MFA_NOT_IMPLEMENTED` = 119–144 + **5** kanal vicon (§4.19) = 145–149. Terukur `node .tools/error-dup.mjs` (2026-10-21): **149 baris bernomor, 149 unik, tanpa lubang**, dan 58 baris tabel turunan cocok nama↔nomor dengan register (gerbang `error-dup: HIJAU`). Yang **benar-benar dikirim** sebagai `error.code` hari ini tetap **12** (baris 1, 3, 5, 6, 10, 11, 12, 13, 14, 15, 27, 28); 137 sisanya adalah kontrak yang belum pernah dipancarkan |');

/* 2 — ARCHITECTURE: berhenti menyalin angka register */
sub('ARCHITECTURE.md', 'arch-ref',
  '| API_SPEC §2.3 (kode error) | **rujuk, jangan salin** — cacah terakhir yang terukur 2026-10-20 adalah sampai baris 144 (baris 107–118 adalah gugus parameter/menu/bukti §4.16–§4.18) |',
  '| API_SPEC §2.3 (kode error) | **rujuk, jangan salin** — pemilik dan cacahnya ada di `API_SPEC §5.15` + gerbang `node .tools/error-dup.mjs`; berkas ini tidak lagi menyebut nomor tertinggi (norma `RD-55`, `RD-62`) |');

/* 3 — ENV_CONTRACT: lubang §5 dinyatakan, blok kredensial kanal, ralat alasan REDIS */
sub('ENV_CONTRACT.md', 'redis-wording',
  '| **Cache** | `REDIS_URL` | Ya | Connection string Redis 7 untuk BullMQ & Lock |',
  '| **Cache** | `REDIS_URL` | Ya | Connection string Redis 7. **Alasan ditulis ulang 2026-10-21:** kata "Lock" dihapus karena Redlock **ditolak** (`ARCHITECTURE §13.6` — lease epoch + fencing token), dan BullMQ/ioredis **belum dependensi nyata** (`RD-11`, `P-6`). Variabel ini dipesan untuk lapis antrean, hari ini tidak ada pemakainya. |');
sub('ENV_CONTRACT.md', 'sec7',
  NL + '## 6. Inventaris terukur dari kode (diralat 2026-10-19)',
  [
    '',
    '## 5. Catatan penomoran (diralat 2026-10-21)',
    '',
    '**§5 tidak pernah ada di berkas ini.** Terukur: heading yang ada adalah `## 1`, `## 2`, `## 3`, `## 4`, `## 6`, `## 7`. Lubang itu **dibiarkan dan dinyatakan**, bukan ditutup dengan penyisihan nomor, karena 16 rujukan eksternal sudah menunjuk `ENV_CONTRACT §6` dan 2 menunjuk `§1`; menomori ulang akan memutus rujukannya dan justru menciptakan sumber kebenaran kedua yang berbeda nomor (`RD-55`). Nomor bagian di dokumen ini stabil sejak v1.0 dan hanya bertambah di ujung.',
    '',
    '## 7. Kredensial kanal vicon dan sistem eksternal (baru 2026-10-21 — `RD-67`) — dirujuk `PRD §5.15`, `DATA_MODEL §21.10`, `INTEGRATIONS §6.8`',
    '',
    'Sebelum bagian ini ada, **nol** variabel kredensial kanal terdaftar di `ENV_CONTRACT` sementara `INTEGRATIONS §6.1` sudah menunjuk "vault/ENV melalui kolom `*_ref`" untuk sebelas sistem. Itu lubang kontrak, bukan kelalaian penamaan: kode tidak punya tempat sah untuk membaca rahasia, sehingga agen berikutnya akan menaruhnya di baris parameter — yang ditolak `DATA_MODEL §21.2` lewat `CHECK (is_secret = false)`.',
    '',
    '**Empat aturan yang berlaku untuk seluruh baris di bawah.** (1) Server-only: tidak ada yang boleh di-prefiks `NEXT_PUBLIC_` dan tidak ada yang dikirim ke Edge selain yang diperlukan verifier. (2) Yang masuk DB hanyalah **pointer** `credential_ref` di `conference_connections` (`0073`); nilainya tidak pernah. (3) Identifier penyewa (`*_TENANT_ID`, `*_ACCOUNT_ID`) bukan rahasia, tetapi tetap diperlakukan server-only karena ia membobot tautan lintas-tenant. (4) Nilai kosong ≠ tidak dipakai: kanal dengan `enabled = true` dan kredensial kosong harus gagal-closed dengan `409 CONFERENCE_CONNECTION_DISABLED` (baris 146), bukan jatuh ke default diam-diam.',
    '',
    '| Variabel | Kanal / sistem | Dev | Staging | Prod | Wajib bila | Catatan |',
    '|---|---|---|---|---|---|---|',
    '| `TEAMS_TENANT_ID` | Microsoft Teams | isi | isi | vault | `MICROSOFT_TEAMS` aktif | id penyewa Azure AD; identifier, tetap server-only |',
    '| `TEAMS_CLIENT_ID` | Microsoft Teams | isi | isi | vault | sama | aplikasi *confidential client* (app-only flow) |',
    '| `TEAMS_CLIENT_SECRET` | Microsoft Teams | vault | vault | vault | sama | rahasia; **tidak pernah** di commit, `*.env`, atau log (`SECURITY §7`) |',
    '| `TEAMS_NOTIFY_CLIENT_STATE` | Microsoft Teams | acak per env | acak | vault | langganan perubahan aktif | penjaga `clientState` notifikasi Graph; rotasi tercatat di riwayat parameter |',
    '| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Zoom | isi/vault | vault | vault | `ZOOM` aktif | Server-to-Server OAuth; `account_id` identifier |',
    '| `MEET_WORKSPACE_PROJECT_ID`, `MEET_SERVICE_ACCOUNT_JSON_REF` | Google Meet | ref | ref | vault | `GOOGLE_MEET` aktif | yang disimpan adalah **pointer** berkas service account, bukan isinya |',
    '| `BBB_BASE_URL`, `BBB_API_SECRET` | BigBlueButton self-host | isi | isi | vault | `BBB` aktif | kanal *self-host*: nol kunci vendor, tetapi tetap butuh secret API internal |',
    '| `JITSI_BASE_URL`, `JITSI_APP_ID`, `JITSI_APP_SECRET` | Jitsi self-host | isi | isi | vault | `JITSI` aktif | JWT *app* untuk moderasi |',
    '| `SISTEP_ENDPOINT` dan `SISTEP_*_REF` | SISTER 2.0 | ref | ref | vault | M-08 aktif | sudah dirujuk `INTEGRATIONS §6.1` sejak 2026-10-20; masuk daftar ini supaya seragam |',
    '| `DJKI_ENDPOINT`, `DJKI_CREDENTIAL_REF` | DJKI (HKI) | ref | ref | vault | M-22 aktif | sama |',
    '| `PAYMENT_VA_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_PUBLIC_KEY_REF` | VA / gerbang pembayaran | isi | vault | vault | rekonsiliasi VA | pola pembuktian webhook = `API_SPEC §4.18.3` |',
    '| `PDDIKTI_FEEDER_ENDPOINT`, `PDDIKTI_FEEDER_CREDENTIAL_REF` | Neo Feeder | ref | ref | vault | M-34 aktif | kredensial lokal kampus, bukan rahasia pusat |',
    '| `TENANT_ENCRYPTION_MASTER_KEY` | amplop PPKS/klinik/ijazah | dev terukur | KMS | KMS | M-36 · M-41 · M-35 | **masih terbuka** (`SEC-13`, `P-5`): pemiliknya KMS atau ENV, dan belum diputus |',
    '',
    '**Cara mengukur drift (jalankan, jangan percayai kalimat ini).** `node .tools/env-drift.mjs` membandingkan tiga hal: variabel yang dideklarasikan `packages/config/src/env.ts`, variabel yang disebut `ENV_CONTRACT`, dan variabel yang dirujuk dokumen lain (`INTEGRATIONS`, `SECURITY`, `PRD`). Hari ini hasilnya `⚠️` untuk seluruh baris baru §7 — tepat seperti yang diharapkan: dokumen mendahului kode, dan **tidak boleh** ada yang mengklaim kanal berjalan sebelum `env.ts` dan berkas `.env.example` ikut bertambah.',
    '',
    '> Untuk kanal yang belum diaktifkan tenant, **tidak ada variabel baru yang boleh diminta**. `conference_connections` cukup barisnya; provider di luar `conference.fallback_chain` tidak dibaca, sehingga dev tidak perlu menyimpan rahasia yang tidak dipakai.',
    '',
  ].join(NL) + NL + '## 6. Inventaris terukur dari kode (diralat 2026-10-19)');

/* 4 — INTEGRATIONS §6.8 kontrak Teams */
append('INTEGRATIONS.md', 'sec68',
  [
    '',
    '### 6.8 Microsoft Teams sebagai kanal vicon — kontrak, peta muatan, dan kegagalan (baru 2026-10-21)',
    '',
    'Permintaan pemilik menempatkan Teams sebagai kanal resmi kampus melalui **Microsoft Graph** dengan *tenant binding* Azure AD. Di dokumen ini Teams diperlakukan **sama persis** dengan kanal vendor lain: **transport**, bukan pemilik fakta (`§6.2`), dan **bukan** mesin (`AGENTS §3.9`). Angka kehadiran tetap dihitung M-18 (`DATA_MODEL §21.5`, `API_SPEC §4.19`).',
    '',
    '> Semua nama sumber daya di bawah berpenanda **`[VERIFIKASI-VENDOR]`** sampai dokumen Microsoft diverifikasi langsung pada lingkungan ini; tidak ada satu pun yang boleh dikutip sebagai bukti sudah teruji. Ini norma yang sama dipakai untuk Feeder dan SISTER (`§6.7`), dan tujuannya supaya bagian ini tidak menjadi janji terselubung.',
    '',
    '#### 6.8.1 Bentuk hubungan dan kredensial',
    '',
    '| Aspek | Kontrak |',
    '|---|---|',
    '| Identitas | aplikasi *confidential client* di tenant kampus (app-only, bukan delegasi pengguna) — `TEAMS_TENANT_ID` + `TEAMS_CLIENT_ID` + `TEAMS_CLIENT_SECRET` (`ENV_CONTRACT §7`) `[VERIFIKASI-VENDOR]` |',
    '| Perolehan token | *client credentials flow* pada titik otorisasi tenant; kedaluwarsa ditangani ulang sebelum kedaluwarsa, tidak pernah 401 di jalur pengguna `[VERIFIKASI-VENDOR]` |',
    '| Cakupan minimal | membuat/membaca *online meeting* atas nama pengampu, membaca laporan kehadiran berlangganan, menerima notifikasi perubahan. Tidak ada cakupan surat, pesan pribadi, atau file drive `[VERIFIKASI-VENDOR]` |',
    '| Penyimpanan | hanya `credential_ref` yang masuk DB; rahasia di vault/ENV. `conference_connections.external_tenant_ref` menyimpan id penyewa sisi vendor bila perlu pencocokan |',
    '| Pseudonim | kunci pencocokan mahasiswa = hash (email/UPN dengan salt per tenant) yang sama dengan `PII_BLIND_INDEX_SALT` (`SECURITY §3.7.2`); **email/NIM telanjang tidak pernah ditulis** ke `conference_channel_events` |',
    '',
    '#### 6.8.2 Peta muatan — Graph ke objek SICA',
    '',
    '| Muatan sumber (satu laporan/langganan) | Kolom tujuan | Aturan pemetaan |',
    '|---|---|---|',
    '| id pertemuan unik sisi vendor | `conference_meetings.external_meeting_id` | `UNIQUE (tenant, provider, external_meeting_id)`; pertemuan tanpa baris ini ditolak, tidak dibuatkan diam-diam |',
    '| jangkauan kehadiran per peserta (`FirstJoin`, `LastLeave`, `JoinCount`, daftar upaya) | `conference_channel_events` satu baris per peristiwa + `attendance_channel_evidence.join_seconds` | durasi = jumlah irisan interval per peserta, **bukan** `LastLeave − FirstJoin` (menghitung ulang break sebagai hadir adalah gelembung angka yang tidak bisa dipertanggungjawabkan di yudisium) |',
    '| peran peserta (presenter/pemakalah/pengamat) | `conference_channel_events.event_type` + keterangan | pengamat tanpa upaya bergabung tidak pernah menjadi `PRESENT` |',
    '| sidik jari muatan | `conference_channel_events.payload_digest` | SHA-256 muatan mentah; muatan mentah tidak disimpan di tabel ini, dan tidak pernah masuk log (`§13.3` aturan input tak-tepercaya) |',
    '| id peristiwa/langganan | `UNIQUE (tenant, provider, external_event_id, event_type)` + kunci idempotensi `0012` | peristiwa yang sama dua kali → satu baris, `processing_state = DUPLICATE` |',
    '',
    '**Vonis tetap di M-18.** Setelah bukti masuk, `ratio = join_seconds / session_seconds` dibandingkan dengan `attendance.online_min_join_ratio` (baku 0,75) di **server**, dan hasilnya satu vonis per `(sesi, mahasiswa)`. Label `HADIR_ONLINE` + tag Feeder `O` adalah proyeksi (`PRD §5.15.3`); tag `O` hanya ikut kirim bila kamus `sifat_pembelajaran` sudah di-*seed* (`[VERIFIKASI-KAMUS]`, `§6.5`).',
    '',
    '#### 6.8.3 Penanganan kegagalan — setiap keadaan punya kode sendiri',
    '',
    '| Keadaan | Perilaku sistem | Kode error (`API_SPEC §2.3`) |',
    '|---|---|---|',
    '| kanal dimatikan tenant / `enabled = false` | tolak sejak awal; layar tampilkan keadaan kanal, jangan biarkan dosen mengira sesi berjalan | `409 CONFERENCE_CONNECTION_DISABLED` (146) |',
    '| kredensial kosong padahal kanal aktif | gagal-closed, **tanpa** jatuh ke default lain | `409 CONFERENCE_CONNECTION_DISABLED` (146) |',
    '| token ditolak (rahasia kedaluwarsa, tenant salah) | menandai koneksi `FAILED`, coba rantai `conference.fallback_chain`, alarm ke Admin IT | `502 CONFERENCE_PROVIDER_UNREACHABLE` (147) |',
    '| cakupan/kontrak lisensi kurang | sebab `SCOPE_DENIED` dicatat; kanal dianggap tidak tersedia sampai lisensi dibenahi | `502 CONFERENCE_PROVIDER_UNREACHABLE` (147) |',
    '| dibatasi (throttling) | hormati `Retry-After`; `retry ≤ 2`, selebihnya antrean ulang + `NEEDS_REVIEW` (bukan gagal di HTTP) | — (worker, `queue_operations`) |',
    '| laporan kehadiran belum tersedia pasca sesi | jadwalkan penarikan ulang; hasil sementara tidak pernah ditampilkan sebagai angka final | `422 CONFERENCE_EVIDENCE_STALE` (148) bila laporan lebih tua dari `conference.evidence_max_age_hours` |',
    '| provider diminta di luar register enum | tolak validasi, bukan senyap | `422 PARAM_VALUE_NOT_ALLOWED` (145) |',
    '| egress gagal total dan tidak ada bukti internal | sesi berlabel `degraded`; vonis **tidak dapat dikunci**; pengumuman nilai tertahan sampai bukti cukup | `422 EVIDENCE_INSUFFICIENT` (117) |',
    '',
    '#### 6.8.4 Uji yang wajib ada sebelum kanal ini diklaim',
    '',
    '1. **Uji kontrak tiruan** (pola `§6.6`): server palsu berbentuk laporan kehadiran → pemetaan ke `attendance_channel_evidence`, termasuk kasus peserta dengan tiga upaya bergabung. Hasil `join_seconds` harus sama dengan jumlah irisan interval, dan uji menolak metode `LastLeave − FirstJoin`.',
    '2. **Uji idempotensi**: kirim peristiwa yang sama dua kali → satu baris + `DUPLICATE`; dua laporan berbeda untuk `(attendance, meeting, source)` yang sama → `UNIQUE` menahan.',
    '3. **Uji ambang** 0,75 dengan `parameter_version` berbeda: laporan periode lalu harus mereproduksi angka yang sama, dan perubahan ambang tidak mengubah vonis lama.',
    '4. **Uji PII**: `conference_channel_events` tidak boleh mengandung email/NIM; pemeriksaan daftar-terlarang atribut (pola `AGENTS §3.9` gerbang l) atas kolom dan muatan.',
    '5. **Uji turun-mutu fallback**: kanal utama mati → rantai dicoba berurutan, tiap percobaan tercatat di `last_probe_*`, sesi berpindah kanal tanpa memutus bukti lama (`FR-VIC-07`).',
    '',
    '#### 6.8.5 Yang sengaja tidak dijanjikan bagian ini',
    '',
    '- Tidak ada klaim Graph *change notification* sudah terverifikasi bentuknya di lingkungan ini (`[VERIFIKASI-VENDOR]`).',
    '- Tidak ada proctoring/wajah/liveness dari Teams: M-17 tetap menghitung lokal, dan `ALG-22` tetap design-only.',
    '- Tidak ada pencocokan peserta lewat pencarian nama bebas; kunci hanya pseudonim bertanda (`§6.8.1`).',
    '- Tidak ada dependensi SDK yang dipasang di dokumen ini; sebelum menjadi klaim, ia harus nyata di `package.json` + lockfile dan tercatat di `TECH_CONVENTIONS §6`.',
    '',
  ].join(NL));

console.log(rep.join(NL));
