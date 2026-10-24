import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];

const guard = (file, label, marker) => {
  const p = D + file;
  const s = readFileSync(p, 'utf8');
  if (s.includes(marker)) { rep.push(file + ' ' + label + ': SKIP (sudah ada)'); return null; }
  return { p, s };
};

/* sisip blok SETELAH baris yang memuat marker */
const afterLine = (file, label, marker, needle, block) => {
  const g = guard(file, label, marker);
  if (!g) return;
  const i = g.s.indexOf(needle);
  if (i === -1) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (g.s.lastIndexOf(needle) !== i) { rep.push(file + ' ' + label + ': AMBIG'); return; }
  const eol = g.s.indexOf(NL, i);
  if (eol === -1) { rep.push(file + ' ' + label + ': NOEOL'); return; }
  writeFileSync(g.p, g.s.slice(0, eol + 1) + block + g.s.slice(eol + 1), 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* tempel di ujung berkas */
const app = (file, label, marker, block) => {
  const g = guard(file, label, marker);
  if (!g) return;
  const base = g.s.endsWith(NL) ? g.s : g.s + NL;
  writeFileSync(g.p, base + block, 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* 1 — UI_UX §18.16 layar kanal vicon (setelah N-11, masih di dalam §18) */
afterLine('UI_UX_DESIGN.md', 'screen-1816',
  '### 18.16 M-02 Kanal vicon',
  '**N-11**',
  [
    '',
    '### 18.16 M-02 Kanal vicon + M-18 Rekonsiliasi kehadiran daring — `/admin/kanal-vicon` dan `/presensi/rekonsiliasi/:sesi` (2026-10-21)',
    '',
    'Layar ini menjawab `RBAC_MATRIX §6.7.6` (baris izin 292–297) dan `PRD §5.15`. Dua hal yang membuatnya berbeda dari layar master data biasa: **rahasia tidak pernah tampil**, dan **kegagalan kanal harus tampil sebagai keadaan, bukan sebagai angka nol**.',
    '',
    '**Blok A — `/admin/kanal-vicon` (Velzon, kartu dalam grid dua kolom).**',
    '',
    '- Header: judul "Kanal kelas daring" + tombol `Daftarkan kanal` (`settings.conference.manage`, 293) — tombol tidak dirender tanpa izin, dan penyaring menu **bukan** penegakan (gerbang server tetap wajib).',
    '- Satu kartu per kanal: nama provider (label dari enum, bukan teks hardcode), sakelar aktif, badge keadaan probe (`OK · DEGRADED · FAILED · UNKNOWN`) dengan titik warna Velzon (`success/warning/danger/secondary`), dan baris "kredensial: `vault pointer`" — **tidak ada** field yang menampilkan nilai rahasia, bahkan yang ter-*mask*.',
    '- Kartu default ditandai `default` dan hanya boleh ada satu; mencoba men-set default kedua → server menolak, pesan memakai kunci i18n `admin.kanalVicon.defaultAlreadySet`.',
    '- Panel kanan "Rantai fallback": daftar tersortir dengan pegangan geser; simpan memicu **dua** hal — `PUT /admin/conference/settings` lewat mesin parameter (§4.16) dan modal konfirmasi empat-mata (alasan + dampak + IP). Nilai di luar enum → inline error dari `422 PARAM_VALUE_NOT_ALLOWED` (baris 145), tanpa toast generik.',
    '- Tombol `Uji koneksi` (294) menampilkan spinner + hasil `last_probe_*`; hasil `FAILED` menampilkan **sebab kelas** (`SCOPE_DENIED`, `AUTH`, `TIMEOUT`) dan bukan body vendor.',
    '',
    '**Blok B — `/presensi/rekonsiliasi/:sesi` (tabel + drawer).**',
    '',
    '- Tabel §2.4: mahasiswa, kanal, `ratio` (dibulatkan ke 1 desimal untuk tampil; nilai kanonik tetap `numeric(6,5)`), ambang yang berlaku + `parameter_version`, vonis, dan dua flag: `degraded` (ikon peringatan + tooltip sebab) serta `reviewState` (`NONE/PENDING/GRANTED/REJECTED` sebagai badge, bukan teks mentah).',
    '- Keadaan wajib: `CHANNEL_UNAVAILABLE` (kanal mati seluruhnya — baris kosong dengan pesan dan tombol "coba kanal lain", bukan tabel kosong tanpa sebab), `LOADING skeleton`, `ERROR + Retry`, `EMPTY (belum ada bukti)`; keadaan `hiddenByDesign` **tidak** berlaku di sini karena datanya milik pengampu sesi yang sah.',
    '- Drawer bukti: daftar baris `attendance_channel_evidence` (sumber, `join_seconds`, `session_seconds`, waktu), dengan catatan tetap di kaki: "vonis dihitung server; laporan kanal adalah bukti pendukung" (`BR-VIC-02`).',
    '- Aksi banding (`CREATE`/`APPROVE`/`REJECT`) memakai komponen `ApprovalTrail` §18.13; pemohon banding tidak dapat melihat tombol setujui pada baris yang sama (SoD, `409 ATTENDANCE_REVIEW_STATE_CONFLICT`).',
    '',
    '**Kunci i18n baru yang dibutuhkan bagian ini (terukur belum ada satu pun).** Namespace `admin.kanalVicon.*` (`title`, `register`, `probe`, `probeFailed.SCOPE_DENIED`, `probeFailed.AUTH`, `probeFailed.TIMEOUT`, `fallbackChain`, `defaultAlreadySet`, `credentialPointer`) dan `attendance.reconciliation.*` (`title`, `ratio`, `threshold`, `degraded`, `channelUnavailable`, `reviewState.NONE|PENDING|GRANTED|REJECTED`, `evidenceSource`). Ditambahkan ke **`id.json` dan `en.json` sekaligus** — utang paritas yang sudah terukur (`en` tertinggal 15 kunci dari `id`) tidak boleh bertambah oleh layar baru.',
    '',
    '**Definition of Done lapisan kanal.** (1) enam provider tampil dari enum, nol string hardcode; (2) `credential_ref` tidak pernah muncul di respons mana pun; (3) keempat keadaan tabel teruji dengan data tiruan; (4) `422`/`409`/`502` kanal punya pesan sebab + langkah perbaikan di kedua bahasa; (5) mode turun saat kanal mati menampilkan `degraded`, bukan angka 0 hadir.',
    '',
  ].join(NL) + NL);

/* 2 — SECURITY §14 kontrol kanal (ditempel di ujung berkas, menyambung §13) */
app('SECURITY_COMPLIANCE.md', 'sec14', '## 14. Kontrol keamanan kanal vicon',
  [
    '',
    '## 14. Kontrol keamanan kanal vicon (audit dewan 2026-10-21 — `PRD §5.15`, `DATA_MODEL §21.10`, `INTEGRATIONS §6.8`)',
    '',
    'Kanal konferensi adalah jalur **egress + inbound webhook pertama** yang membawa identitas peserta. Bagian ini menetapkan kontrolnya sebelum ada satu baris kode; penomorannya menyambung §13 (`SC-G4-*`) sebagai `SC-G5-*`.',
    '',
    '| Kontrol | Wajib | Penegakan | Cara uji |',
    '|---|---|---|---|',
    '| `SC-G5-01` Kredensial kanal hanya lewat ENV/vault, DB menyimpan pointer | ya | `CHECK (is_secret = false)` + `source_of_truth` bukan ENV di `0049`; `credential_ref` bertipe pointer | scanner nilai: `sk-`, `eyJ`, `-----BEGIN` di seed dan log = 0 |',
    '| `SC-G5-02` `credential_ref`, token, dan join URL ber-token tidak pernah masuk proyeksi API | ya | `FIELD_RULES` `SERVER_ONLY`; uji snapshot respons | `vitest` menolak field di respons |',
    '| `SC-G5-03` Pencocokan peserta memakai blind index salt tenant, bukan email/NIM | ya | `external_user_ref` = HMAC terhadap `PII_BLIND_INDEX_SALT` (`§3.7.2`) | uji daftar-terlarang kolom PII di `conference_channel_events` |',
    '| `SC-G5-04` Webhook kanal diverifikasi sebelum antrean; muatan gagal tidak pernah disimpan mentah | ya | pembukti per provider (`API_SPEC §4.18.3` empat penjaga); hanya `payload_digest` yang disimpan | uji penolakan: muatan tanpa pembukti → tanpa baris, tanpa log isi |',
    '| `SC-G5-05` Idempotensi per `(tenant, provider, external_event_id, event_type)` | ya | `UNIQUE` di `0073` + kunci idempotensi `0012` | uji kirim ganda → `DUPLICATE` |',
    '| `SC-G5-06` Retensi muatan mentah dibatasi dan terenkripsi | ya | `expires_at` baku 30 hari (`§13.2`), amplop AES-256-GCM | uji kadaluarsa + baca tanpa kunci = tidak terbaca |',
    '| `SC-G5-07` Nilai kehadiran **tidak pernah** diterima dari klien | ya | service M-18 menghitung rasio; klien hanya mengirim id sesi | uji IDOR: id sesi milik prodi lain → 404/403 (`SEC-02`) |',
    '| `SC-G5-08` Perubahan ambang dan rantai kanal = kelas berisiko dengan MFA + empat-mata | ya | `settings.param.edit.*` (baris 146–157) + pasangan `§7.6`; riwayat berversi | uji: pemohon = penyetuju → 403 |',
    '| `SC-G5-09` Kanal mati tidak menghasilkan angka akademik terkunci | ya | flag `degraded` menahan transisi `LOCKED` pada nilai | uji: laporan vendor tunggal → tidak dapat dikunci |',
    '| `SC-G5-10` Egress kanal didaftarkan dan dapat dimatikan per tenant tanpa memutus jalur internal | ya | `conference_connections.is_active` + `ENV_CONTRACT §7`; jalur `BUILTIN_LMS`/BBB *self-host* tetap hidup | uji tanpa jaringan: fallback ke kanal internal, bukan kegagalan total |',
    '',
    '**Tiga temuan keamanan yang ikut dicatat siklus ini.** (1) `SEC-32`: kontrak tulis lama menerima `PENDING_REVIEW` yang tidak ada di enum `attendance_status` — kegagalan `INSERT` di produksi lebih mungkin muncul sebagai 500 tanpa sebab daripada sebagai penolakan bisnis; ditutup oleh `review_state` (`0074`, `RD-70`). (2) `SEC-33`: tidak ada satu pun variabel kredensial kanal di `ENV_CONTRACT` sementara dokumen integrasi sudah menunjuk "vault/ENV" — celah ini mendorong agen menaruh rahasia di baris parameter; ditutup §7 `ENV_CONTRACT` (`RD-67`). (3) `SEC-34`: pencocokan peserta lewat pencarian nama/email bebas akan membuka PII lintas modul; dinormakan sebagai `SC-G5-03` sebelum kode sempat menulisnya.',
    '',
    '**Yang tidak dijanjikan.** Verifikasi bentuk muatan Graph/Zoom masih `[VERIFIKASI-VENDOR]`; SDK kanal belum menjadi dependensi nyata (`design-only`, `AGENTS §3.9`); dan Teams **bukan** jalur proctoring — M-17 tetap menghitung lokal.',
    '',
  ].join(NL));

/* 3 — ROADMAP §2.21 kanal vicon (setelah paragraf penutup §2.19, sebelum garis pemisah) */
afterLine('ROADMAP_TASKS.md', 'sec-221',
  '## 2.21 Kanal vicon terkelola',
  '**Cara membaca §2.19.**',
  [
    '',
    '## 2.21 Kanal vicon terkelola (`VCN-1`…`VCN-5`) — hasil audit dewan 2026-10-21',
    '',
    '> **Rujukan induk:** [PRD §5.15](file:///c:/SICA/docs/PRD.md) (FR-VIC-01…07 · BR-VIC-01…05 · AC-VIC-1…4), [DATA_MODEL §21.10](file:///c:/SICA/docs/DATA_MODEL.md) (`0073`–`0075`), [API_SPEC §4.19](file:///c:/SICA/docs/API_SPEC.md) + register error 145–149, [RBAC_MATRIX §4.5.2/§6.7.6](file:///c:/SICA/docs/RBAC_MATRIX.md) (baris 292–297), [INTEGRATIONS §6.8](file:///c:/SICA/docs/INTEGRATIONS.md), [SECURITY §14](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md) (`SC-G5-01…10`), [UI_UX §18.16](file:///c:/SICA/docs/UI_UX_DESIGN.md), [ENV_CONTRACT §7](file:///c:/SICA/docs/ENV_CONTRACT.md), [SEED_DATA §8](file:///c:/SICA/docs/SEED_DATA.md).',
    '',
    '**Kenapa gugus ini tidak menunggu 47 modul selesai.** Ia menyentuh tiga hal yang sudah ada dan hari ini **salah bentuk**: kosakata provider (tiga versi), kosakata modus (empat ejaan), dan kontrak tulis presensi yang menerima nilai di luar enum. Menunda berarti membiarkan tiga cacat itu ikut ke migrasi pertama.',
    '',
    '- [ ] **`VCN-1` — Satu kosakata, dua alias register.** *Isi:* enum `conference_provider` + `reference_items` label; `0075` memetakan `TEAMS`→`MICROSOFT_TEAMS`, `BUILTIN`→`BUILTIN_LMS`, `HYBRID`→`BLENDED`, `OFFLINE`→`ONSITE`, `MEET`→`OFFLINE_MEET`; mapper alias tunggal di kontrak. *Gerbang:* `node .tools/vocab-audit.mjs` hijau; query `(r)` `§21.10.5` = 0 baris. *Tergantung:* `MDE-1` (mesin kamus `0047`). *Status dokumen:* selesai 2026-10-21; **belum ada berkas migrasi**.',
    '- [ ] **`VCN-2` — Objek kanal dan bukti.** `0073` + `0074` dengan RLS `ENABLE`+`FORCE`, indeks `tenant_id` mendahului, `conference_channel_events` insert-only, `attendances.review_state`. *Gerbang:* `check-docs` + `ddl-owner` hijau; uji penolakan `UPDATE` pada tabel insert-only. *Tergantung:* `M47-1` (parameter `0049` lebih dulu, karena tiga kunci kanal hidup di sana).',
    '- [ ] **`VCN-3` — Enam izin gelombang lima dipromosikan.** Baris 292–297 masuk `PERMISSION_SPECS` + `gen-rbac-seed.mjs` dijalankan ulang; `--check` menjadi gerbang. *Tanpa langkah ini*, `API_SPEC §4.19` hanya bisa ditegakkan dengan mengarang string izin — pelanggaran `AGENTS §3.8` (pola `G-15`/`G-23`).',
    '- [ ] **`VCN-4` — Kontrak Microsoft Teams.** Uji kontrak tiruan (pola `TESTING_STRATEGY §6`), verifikasi bentuk langganan/laporan kehadiran `[VERIFIKASI-VENDOR]`, peta `join_seconds` = jumlah irisan interval, penanganan `401/403/429`, retensi dan enkripsi muatan mentah. *Keluaran:* keputusan lanjut ke `VCN-5` atau berhenti di kanal internal.',
    '- [ ] **`VCN-5` — Rekonsiliasi dan layar.** `/admin/kanal-vicon` + `/presensi/rekonsiliasi/:sesi` dengan `degraded`/`CHANNEL_UNAVAILABLE`/`reviewState`, kunci i18n `id` **dan** `en` sekaligus, uji ambang berversi, uji SoD banding, uji beban laju peristiwa kanal.',
    '',
    '**Larangan yang berlaku di gugus ini.** Tidak ada proctoring dari vendor; tidak ada rahasia di parameter, body, atau log; tidak ada `HADIR_ONLINE` sebagai enum; tidak ada angka akademik terkunci saat `degraded`; tidak ada SDK yang dikutip sebagai "sudah terpasang" sebelum masuk `package.json` + `TECH_CONVENTIONS §6`.',
    '',
  ].join(NL) + NL);

console.log(rep.join(NL));
