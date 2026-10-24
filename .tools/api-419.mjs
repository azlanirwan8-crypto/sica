import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const p = 'C:/SICA/docs/API_SPEC.md';
let L = readFileSync(p, 'utf8').split(NL);
const rep = [];

const replaceLine = (label, pred, lines) => {
  const i = L.findIndex(pred);
  if (i === -1) { rep.push(label + ': MISS'); return; }
  if (L.filter(pred).length > 1) { rep.push(label + ': AMBIG'); return; }
  L.splice(i, 1, ...lines);
  rep.push(label + ': OK');
};
const insertAfter = (label, pred, lines) => {
  const i = L.findIndex(pred);
  if (i === -1) { rep.push(label + ': MISS'); return; }
  if (L.filter(pred).length > 1) { rep.push(label + ': AMBIG'); return; }
  L.splice(i + 1, 0, ...lines);
  rep.push(label + ': OK');
};

/* 1 — kontrak baca memakai register kanonik */
replaceLine('provider-enum',
  (l) => l.includes("provider: z.enum(['ZOOM', 'GOOGLE_MEET', 'BUILTIN'])"),
  [
    "    // Register kanonik: enum `conference_provider` (DATA_MODEL §21.10.1, migrasi 0073). Ejaan lama",
    "    // 'BUILTIN' dan 'TEAMS' = alias kalah (§21.10.2): diterima saat BACA lewat satu mapper, ditolak saat TULIS.",
    "    provider: z.enum(['BUILTIN_LMS', 'BBB', 'JITSI', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'ZOOM']),",
  ]);

/* 2 — slug webhook Turun dari enum, bukan daftar ketiga */
insertAfter('webhook-slug-note',
  (l) => /^Opsional, \*\*pendukung\*\*, dan dibatasi sampai ke kawatnya\. Provider sah ∈/.test(l),
  [
    '> **Kosakata slug = `lower(conference_provider)`** (`DATA_MODEL §21.10.1`): `builtin_lms · bbb · jitsi · google_meet · microsoft_teams · zoom`. Daftar di kalimat di atas bukan kosakata ketiga — ia turunan enum, dan `0075` memetakan `microsoft_teams` lama yang tertulis `TEAMS` di kolom. ',
  ]);

/* 3 — baris register error 145–149 (nomor diukur: tertinggi hari ini 144) */
insertAfter('error-145-149',
  (l) => /^\| 144 \| 501 \| `MFA_NOT_IMPLEMENTED`/.test(l),
  [
    '| 145 | 422 | `PARAM_VALUE_NOT_ALLOWED` | Nilai parameter bukan anggota register yang mengikatnya — kasus nyata: `conference.default_provider` di luar enum `conference_provider`, atau `conference.fallback_chain` memuat token asing/berulang (`PRD §5.15.2`, `DATA_MODEL §21.10.3`). Dibedakan dari baris 107 (`PARAM_OUT_OF_RANGE`, numerik di luar `[min_value,max_value]`): ini pelanggaran **keanggotaan**, bukan rentang |',
    '| 146 | 409 | `CONFERENCE_CONNECTION_DISABLED` | Kanal diminta (provisioning, tarik laporan, atau uji) sedangkan `conference_connections.enabled = false` atau `credential_ref` menunjuk entri kosong. Gagal-closed: tidak ada sesi di kanal hantu; layar menampilkan `CHANNEL_UNAVAILABLE`, bukan angka parsial (`BR-VIC-05`) |',
    '| 147 | 502 | `CONFERENCE_PROVIDER_UNREACHABLE` | Panggilan keluar ke kanal gagal setelah retry habis (Graph `401/403/429`, BBB `returncode`, Zoom `429`); rantai `conference.fallback_chain` dicoba berurutan dan tiap percobaan tercatat di `conference_connections.last_probe_*`. Sebab yang ditampilkan = kanal + kelas kegagalan, **bukan** isi token |',
    '| 148 | 422 | `CONFERENCE_EVIDENCE_STALE` | Bukti kanal lebih tua dari `conference.evidence_max_age_hours` (baku 24) sehingga tidak ikut vonis; barisnya tetap disimpan dengan `degraded = true` (`BR-VIC-02`, `DATA_MODEL §21.10.3` baris 28) |',
    '| 149 | 409 | `ATTENDANCE_REVIEW_STATE_CONFLICT` | Banding presensi diajukan atau diproses pada baris `attendances` yang vonisnya sudah terkunci, atau `review_state` sudah final. Penanda `review_state` (`0074`) bukan status kehadiran, jadi negara ini butuh kode sendiri alih-alih menyuntik `PENDING_REVIEW` ke `attendance_status` (`RD-70`) |',
  ]);

/* 4 — §4.19 kanal vicon, di ujung §4 (sebelum ## 5) */
insertAfter('sec-419',
  (l) => /^## 5\. Inventaris Endpoint Lengkap/.test(l),
  [
    '### 4.19 Kanal vicon terkelola — koneksi tenant, provisioning, dan bukti kehadiran (M-02 · M-15 · M-16 · M-18) — 2026-10-21',
    '',
    '> **Status gugus ini: `spec-only` seluruhnya, nol handler.** Terukur 2026-10-21: `ls apps/web/src/app/api/v1` = `academic`, `attendance`, `auth`, `health`, `tenant` (tidak ada `conference`); `find apps/web/src -path "*conference*" -name route.ts` = **0**; dan `ENV_CONTRACT` **belum memuat satu pun variabel kredensial kanal** (`RD-67`). Norma induk: `PRD §5.15` (FR-VIC / BR-VIC / AC-VIC) dan `DATA_MODEL §21.10` (objek `0073`–`0075`).',
    '',
    'Rutenya sengaja sedikit: kanal adalah **transport**, dan vonis kehadiran tetap milik M-18. Yang diberi path hanya tiga hal yang tidak bisa dihindari — mengelola koneksi, menyediakan kanal untuk sesi, dan menarik bukti.',
    '',
    '| Metode | Path | Izin (`resource × verb`) | Ringkas dan penjaga |',
    '|---|---|---|---|',
    '| GET | `/api/v1/admin/conference/connections` | `settings.conference.view` | daftar kanal tenant + status probe; `credential_ref` tidak ikut proyeksi (rahasia `SERVER_ONLY` di `FIELD_RULES`) |',
    '| POST | `/api/v1/admin/conference/connections` | `settings.conference.manage` | daftarkan kanal; body hanya `provider` (enum §21.10.1), `api_region`, `external_tenant_ref`; rahasia tidak pernah diterima |',
    '| POST | `/api/v1/admin/conference/connections/:provider/probe` | `settings.conference.validate` | uji koneksi nyata (buat sesi percobaan lalu tutup) dan catat `last_probe_*`; MFA diwajibkan karena hasilnya mengubah pemilihan kanal |',
    '| PUT | `/api/v1/admin/conference/settings` | `settings.param.edit.technical` | menulis `conference.default_provider`, `conference.fallback_chain`, `conference.attendance_source_priority`, `conference.evidence_max_age_hours` lewat **mesin parameter §4.16** (bukan rute khusus); nilai asing → `422 PARAM_VALUE_NOT_ALLOWED` (145) |',
    '| POST | `/api/v1/conference/sessions/:sessionId/meetings` | `teaching.session.manage` | provisioning kanal untuk sesi `SYNC_LIVE`/`BLENDED`; join URL ditulis server; kegagalan memicu rantai fallback → `502 CONFERENCE_PROVIDER_UNREACHABLE` (147) setelah rantai habis |',
    '| GET | `/api/v1/conference/sessions/:sessionId/meetings` | `teaching.session.view` | keadaan kanal + `fallback_of` supaya layar menampilkan `CHANNEL_UNAVAILABLE` apa adanya (`BR-VIC-05`) |',
    '| POST | `/api/v1/webhooks/conference/:provider` | `platform.integration.proof` | pintu masuk peristiwa kanal (internal dan vendor) → `conference_channel_events`; empat penjaga §4.18.3 (allowlist field, digest, idempotensi per `(tenant, provider, external_event_id, event_type)`, `received_at` server) berlaku penuh |',
    '| POST | `/api/v1/attendance/sessions/:sessionId/channel-evidence/pull` | `attendance.record.mark` | tarik laporan kehadiran pasca sesi → `attendance_channel_evidence` (bukti, bukan vonis); selalu `202 { runId }` dan dihitung worker (ADR-9/ADR-15); laporan basi → `422 CONFERENCE_EVIDENCE_STALE` (148) |',
    '| GET | `/api/v1/attendance/sessions/:sessionId/reconciliation` | `attendance.record.view` | proyeksi §21.5 per mahasiswa: daftar bukti, `ratio`, ambang yang berlaku + `parameter_version`, flag `degraded`, `reviewState`, dan **satu vonis** |',
    '',
    '**Tiga aturan yang membuatnya penegakan, bukan sekadar tambahan path.**',
    '',
    '1. **Klien tidak pernah memilih angka.** `joinSeconds`, `ratio`, `meetsThreshold`, dan provider untuk sesi baru diselesaikan server di dalam transaksi; id sesi dari klien lebih dulu diselesaikan ke barisnya `WHERE tenant_id = ctx.tenantId AND id = $1` (`AGENTS §3.8` anti-IDOR, pola `SEC-02`/`SEC-04`).',
    '2. **Rahasia tidak menyentuh body, log, maupun baris parameter.** `credential_ref` hanya pointer; `DATA_MODEL §21.2` menutup jalur lain lewat `CHECK (is_secret = false)` dan `source_of_truth <> \'ENV\'`; yang keluar-masuk kanal adalah pseudonim `external_user_ref`, bukan email/NIM (`BR-VIC-03`, `SECURITY §7` dan §13.1).',
    '3. **Satu vonis, banyak bukti.** Kanal menambah baris bukti, tidak menambah nilai enum kehadiran; `degraded` dan `review_state` adalah kolom penjaga (`RD-70`).',
    '',
    '**Bentuk kontrak Microsoft Teams dirinci sekali di `INTEGRATIONS §6.8`** (langganan perubahan Graph, peta laporan kehadiran, penanganan `401/403/429`, dan tanda `[VERIFIKASI-VENDOR]` yang masih terbuka). Dokumen ini tidak menyalin bentuk payload vendor ke dua tempat.',
    '',
    '',
  ]);

writeFileSync(p, L.join(NL), 'utf8');
console.log(rep.join(NL));
