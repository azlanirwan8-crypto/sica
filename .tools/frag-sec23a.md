
## 23. DDL gugus siklus hidup — lampiran platform, intake PMB, yudisium–tugas akhir–transkrip, permohonan kelulusan, KTM, tracer (2026-10-21)

**Kenapa bagian ini ada.** Dua alat ukur berbicara lebih keras daripada keluhan: `node .tools/fk-audit.mjs` menemukan **6 target `REFERENCES` yang tidak pernah dibuat** (`attachments` dirujuk 14 kali, `thesis_records`, `pmb_paths`, `pmb_waves`, `pmb_applications`, satu artefak prosa), dan `node .tools/ddl-gap.mjs` menemukan bahwa dari **80** nama objek yang **sudah punya nomor migrasi** di register [MIGRATION_SOP §5](file:///c:/SICA/docs/MIGRATION_SOP.md), **76 tidak punya DDL** di dokumen ini. Artinya pertanyaan "apakah siap develop" belum boleh dijawab ya untuk gugus mana pun yang menyentuh berkas fisik, pendaftaran mahasiswa baru, atau dokumen lulus. Bagian ini membayar **empat nomor paling hulu** — `0020` (yang ditunjuk 14 foreign key), `0021` (modul `pmb` sudah ter-seed di `0004:83` tanpa satu tabel pun: `P-10`), `0027` (sumber field tugas akhir yang dibaca `graduation_records` §5), `0019` (permohonan kelulusan, legalisir, wisuda) — dan **dua nomor baru** yang lahir di sini karena belum pernah didaftarkan: `0076` kartu tanda mahasiswa dan `0077` tracer study.

**Tiga ralat register yang harus diputus lebih dulu, sebelum satu `CREATE TABLE` pun dibaca.**
1. **`documents` terdaftar dua kali** — pada baris `0019` **dan** baris `0020` `MIGRATION_SOP §5`. Aturan §1 "satu tabel satu blok DDL" (`RD-06`) melarangnya: replay migrasi gagal (`relation already exists`) dan tidak ada yang punya bentuk kanonik. Vonis: **`documents` milik `0020`**; baris `0019` hanya menunjuk. Kedua baris register sudah diperbaiki pada siklus ini.
2. **`student_activities` (`0026`) versus `activity_participations` (`0064`)** — satu konsep, dua nama, dan yang kedua sudah punya DDL lengkap di §22.6.1. Vonis: **`activity_participations` menang**, `student_activities` masuk daftar alias kalah §22.10 dan tidak akan pernah dibuat; `0026` hanya menulis sisa objeknya (`activity_kinds`, `achievement_levels`, `certification_records`, `publication_records`).
3. **`commencement_batches` (`0019`) versus jalur `/graduation/convocations/:convocationId` di [API_SPEC §7.27](file:///c:/SICA/docs/API_SPEC.md)** — nama objek adalah wewenang dokumen ini, jadi yang diralat adalah **jalur API**: `/graduation/commencements/:batchId/register`. Satu nama, satu sumber, dan rujukan API_SPEC sudah diubah pada siklus ini.

**Cara bagian ini ditulis (dan cara membacanya).** Setiap blok adalah DDL yang bisa dijalankan, bukan daftar kolom keinginan: tipe nyata, `CHECK` nyata, `UNIQUE` nyata, dan kalimat **Kenapa** di bawahnya yang menjelaskan kolom mana yang tidak bisa dihilangkan. Yang **tidak** dilakukan: menciptakan tabel proyeksi yang dapat disunting, menaruh rahasia sebagai kolom, atau membuat CHECK tertutup untuk kosakata kelas C yang dapat dirawat kampus (`AGENTS §3.10`).

### 23.1 `0020_platform_attachments.sql` — satu pemilik berkas, penomoran dokumen, dan run impor

```sql
CREATE TYPE attachment_scan_state AS ENUM ('PENDING','CLEAN','INFECTED','FAILED');
CREATE TYPE document_state AS ENUM ('DRAFT','ISSUED','REVOKED','SUPERSEDED');
CREATE TYPE import_stage AS ENUM ('PREVIEW','COMMIT','FAILED','EXPIRED');

CREATE TABLE attachments (                                  -- pemilik SATU-SATUNYA berkas di seluruh sistem (RD-27)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_entity text NOT NULL,                               -- nama kelas objek logis ('pmb_document','helpdesk_ticket','thesis_draft',…);
  owner_id    uuid,                                         --   divalidasi service terhadap registri objek §14.3 — bukan CHECK tertutup
  category    text NOT NULL,                                -- kamus `attachment_category` (§20): bukti bayar, skripsi, legalisir, KTM, berkas impor, PDM/SPTJM, logo
  storage_key text NOT NULL,
  original_name text NOT NULL,
  mime_type   text NOT NULL,
  size_bytes  bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),   -- plafon 25 MiB; ambang nyata di `master_system_parameters` (§21.3)
  sha256      char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  scan_state  attachment_scan_state NOT NULL DEFAULT 'PENDING',
  scanned_at  timestamptz,
  uploaded_by uuid NOT NULL,                                -- id pemakai; FK ke users ditahan service (kolom `users.id` belum ber-UNIQUE komposit, §16)
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,                                  -- berkas mentah hasil ekstraksi = 30 hari (§3.9 AGENTS); berkas akademik tetap NULL
  CHECK (storage_key ~ '^tenants/[0-9a-f-]{36}/[a-z0-9_]+/[a-f0-9]{64}(/[a-z0-9_.-]+)?$'),
  CHECK (original_name !~ '[/\\]'),                          -- nama asal untuk tampilan; tidak pernah ikut membangun path
  CHECK (original_name <> ''),
  CHECK ((scan_state = 'PENDING') = (scanned_at IS NULL)),
  UNIQUE (tenant_id, sha256, owner_entity, owner_id)        -- unggah ganda untuk objek yang sama ditolak; owner_id NULL (unggah pra-objek) sengaja di luar jaminan ini
);
CREATE INDEX idx_attachments_owner ON attachments(tenant_id, owner_entity, owner_id);
CREATE INDEX idx_attachments_expiry ON attachments(tenant_id, expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE document_number_sequences (                    -- penomoran resmi per jenis dokumen per periode (FR-ADM-* / BR-R15)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_type   text NOT NULL,                                 -- kamus `document_type`, bukan enum kampus
  period_key text NOT NULL,                                 -- '2026', '2025/2026', atau 'GH.3' — format per jenis, tidak dipaksakan
  prefix     text NOT NULL,
  format_mask text NOT NULL CHECK (format_mask ~ '\{number\}'),  -- template '{prefix}/{number}/{period_key}'; dieksekusi sebagai penggantian token, bukan eval
  next_number bigint NOT NULL DEFAULT 1 CHECK (next_number > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, doc_type, period_key)
);

CREATE TABLE documents (                                    -- TERBIT dari 0020, bukan 0019 (ralat 1 di atas)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  number   text NOT NULL,                                   -- hasil ambil nomor dari sequence; tidak pernah dikirim klien (SERVER_ONLY, §22.9)
  student_id uuid REFERENCES students(id),                  -- NULL untuk dokumen non-mahasiswa (naskah kerjasama, surat tugas)
  status document_state NOT NULL DEFAULT 'DRAFT',
  issued_on date,
  valid_until date,                                         -- surat keterangan punya umur; ijazah & transkrip tidak
  template_id uuid REFERENCES document_templates(id),
  attachment_id uuid REFERENCES attachments(id),            -- berkas jadi; storage tidak pernah disalin ke tabel ini
  content_digest char(64) CHECK (content_digest IS NULL OR content_digest ~ '^[a-f0-9]{64}$'),
  tte_signature_id uuid REFERENCES document_signatures(id), -- BR-R15: TTE tersertifikasi tetap milik §4.7, tidak dibuat kedua
  verification_code text,                                   -- token verifikasi pihak ketiga (hash, bukan nomor telanjang)
  superseded_by uuid REFERENCES documents(id),
  revoked_reason text,
  requested_by uuid NOT NULL, approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, doc_type, number),
  CHECK (status <> 'ISSUED' OR (issued_on IS NOT NULL AND attachment_id IS NOT NULL)),
  CHECK (status <> 'REVOKED' OR revoked_reason IS NOT NULL),
  CHECK (superseded_by IS NULL OR superseded_by <> id),
  CHECK (valid_until IS NULL OR (status <> 'ISSUED') OR valid_until >= issued_on),
  CHECK (status <> 'ISSUED' OR approved_by IS NOT NULL)      -- menerbitkan dokumen = aksi VALIDATE ber-empat-mata saat kelas risikonya menuntutnya (§21.7)
);
CREATE INDEX idx_documents_student ON documents(tenant_id, student_id, doc_type, status);
CREATE INDEX idx_documents_number ON documents(tenant_id, doc_type, issued_on DESC);

CREATE TABLE import_runs (                                  -- append-only: pratinjau lalu commit, tidak pernah commit diam-diam
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,                                       -- kamus `import_kind` (mahasiswa, tagihan, aset, nilai…)
  attachment_id uuid NOT NULL REFERENCES attachments(id),
  actor uuid NOT NULL,
  stage import_stage NOT NULL DEFAULT 'PREVIEW',
  rows_total int NOT NULL DEFAULT 0 CHECK (rows_total >= 0),
  rows_ok    int NOT NULL DEFAULT 0 CHECK (rows_ok >= 0),
  rows_reject int NOT NULL DEFAULT 0 CHECK (rows_reject >= 0),
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,               -- pemetaan kolom sumber→target, tersimpan supaya run dapat direproduksi
  error_report_url text,
  committed_by uuid, committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (stage <> 'COMMIT' OR (committed_by IS NOT NULL AND committed_at IS NOT NULL)),
  CHECK (stage <> 'COMMIT' OR committed_by <> actor),        -- yang memetakan bukan yang melepas (empat-mata impor massal)
  CHECK (rows_ok + rows_reject <= rows_total)
);
CREATE INDEX idx_import_runs_state ON import_runs(tenant_id, kind, stage, created_at DESC);
```

**Kenapa kolom-kolom ini ada.** `sha256` ikut di `UNIQUE` bersama pasangan objeknya karena duplikat berkas pada satu objek adalah bug yang biayanya nyata (dua bukti bayar untuk satu tagihan), sedangkan duplikat berkas pada dua objek yang berbeda adalah hal yang wajar dan tidak boleh ditolak. `storage_key` diberi CHECK berbentuk, bukan sekadar sanitasi saat tulis, karena pola `RD-27` lahir dari kenyataan bahwa nama berkas pengguna adalah vektor lintas-tenant: satu `../` di nama asal sudah cukup untuk menaruh berkas kampus A di folder kampus B kalau path dibentuk dari string. `original_name` tetap disimpan — tanpa CHECK kegunaan lain — karena pengguna perlu mengenali berkasnya, dan namanya **tidak pernah** dibaca sebagai bagian path. `documents.approved_by` dan `import_runs.committed_by` adalah dua bentuk dari norma yang sama: terbit dan commit adalah `VALIDATE`, dan satu actor sebagai pemohon sekaligus penyetuju adalah temuan SoD, bukan gaya kode.

**RLS.** Keempat tabel ber-`tenant_id` dan diambil generator §6.2 tanpa pengecualian (`ENABLE` + `FORCE` + policy `tenant_isolation`). `import_runs` mendapat `REVOKE UPDATE, DELETE FROM sica_app` **sebelum** policy, mengikuti pola §16.3.3: jejak impor harus bertahan setelah berkasnya kedaluwarsa. `attachments` **tidak** boleh diberi policy yang mengabaikan `owner_entity` — pemilik berkas adalah tabel ini, dan objek yang menunjuknya tidak boleh punya kolom salinan.

**Status.** Kelas A: `attachment_scan_state`, `document_state`, `import_stage` — ketiganya dicerminkan ke register §15.2 pada migrasi yang sama. Kelas C: `attachments.category`, `attachments.owner_entity`, `documents.doc_type`, `import_runs.kind` (kampus menambah jenis tanpa rilis kode; gerbang §20.1 butir (n) menuntut baris `reference_kind_usage` untuk setiap jenis yang dibaca UI). **Penahan yang tidak hilang oleh DDL ini:** `storage_key` mengandaikan backend objek nyata; sampai `DEPLOYMENT_DEVOPS` punya bucket per-tenant yang terverifikasi, seluruh rute unggah tetap `blocker`.

### 23.2 `0021_pmb_intake.sql` — dari gelombang sampai NIM, satu jalur tulis

```sql
CREATE TYPE pmb_application_state AS ENUM ('DRAFT','SUBMITTED','UNDER_REVIEW','SELECTED','RESERVE','REJECTED','REREGISTERED','WITHDRAWN','CANCELLED');
CREATE TYPE pmb_document_state AS ENUM ('PENDING','VERIFIED','REJECTED');
CREATE TYPE pmb_appeal_state AS ENUM ('OPEN','GRANTED','DENIED');
CREATE TYPE nim_state AS ENUM ('RESERVED','ISSUED','CANCELLED','RECYCLED');

CREATE TABLE pmb_paths (                                    -- jalur masuk: SNBT, SNBP, mandiri, … (kampus merawat labelnya)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, name_en text,
  form_fee_rupiah bigint NOT NULL DEFAULT 0 CHECK (form_fee_rupiah >= 0),   -- uang = bigint rupiah utuh (ADR-5), bukan float
  refundable boolean NOT NULL DEFAULT false,
  feeder_jalur_daftar text,                                 -- kode nasional; NULL = jalur tidak dikirim ke Feeder
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE pmb_waves (                                    -- gelombang per tahun akademik; dua gelombang satu jalur TIDAK boleh beririsan
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  path_id uuid NOT NULL REFERENCES pmb_paths(id),
  code text NOT NULL,
  opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL,
  result_published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, path_id, code),
  CHECK (closes_at > opens_at),
  EXCLUDE USING gist (tenant_id WITH =, path_id WITH =, tstzrange(opens_at, closes_at) WITH &&)
);

CREATE TABLE pmb_program_quotas (                           -- CP1 Feeder: daya tampung per prodi per gelombang
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wave_id uuid NOT NULL REFERENCES pmb_waves(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES study_programs(id),
  seats int NOT NULL CHECK (seats > 0),
  reserved_seats int NOT NULL DEFAULT 0 CHECK (reserved_seats >= 0),
  used_seats int NOT NULL DEFAULT 0 CHECK (used_seats >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wave_id, program_id),
  CHECK (reserved_seats + used_seats <= seats)
);
CREATE INDEX idx_pmb_quota_lookup ON pmb_program_quotas(tenant_id, wave_id, program_id);

CREATE TABLE pmb_applications (                             -- SATU-SATUNYA objek pendaftaran; lead M-45 menunjuk ke sini, tidak pernah INSERT ke sini (vonis 12)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_number text NOT NULL,
  wave_id uuid NOT NULL REFERENCES pmb_waves(id),
  path_id uuid NOT NULL REFERENCES pmb_paths(id),
  program_id uuid NOT NULL REFERENCES study_programs(id),
  priority smallint NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
  applicant_membership_id uuid NOT NULL REFERENCES tenant_memberships(id),
  applicant_user_id uuid NOT NULL REFERENCES users(id),
  state pmb_application_state NOT NULL DEFAULT 'DRAFT',
  registration_fee_rupiah bigint CHECK (registration_fee_rupiah IS NULL OR registration_fee_rupiah >= 0),
  fee_paid_at timestamptz,
  submitted_at timestamptz, withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, application_number),
  UNIQUE (tenant_id, applicant_membership_id, program_id),  -- satu pendaftaran per prodi; dua prodi = dua baris dengan priority berbeda
  UNIQUE (tenant_id, wave_id, applicant_membership_id, priority)
);
-- `path_id` aplikasi WAJIB sama dengan `path_id` gelombangnya. CHECK tidak boleh berisi subquery di PostgreSQL,
-- jadi invariance ini ditegakkan pemicu `app.assert_pmb_wave_path()` BEFORE INSERT/UPDATE dan diuji di §23.7 butir 2.
CREATE INDEX idx_pmb_apps_state ON pmb_applications(tenant_id, wave_id, state, program_id);

CREATE TABLE pmb_documents (                                -- penolakan PER BERKAS dan BERALASAN (BENCH-05)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES pmb_applications(id) ON DELETE CASCADE,
  kind text NOT NULL,                                       -- kamus `pmb_document_kind` ( rapor, KK, kartu keluarga, sertifikat…)
  is_required boolean NOT NULL DEFAULT true,
  attachment_id uuid REFERENCES attachments(id),
  state pmb_document_state NOT NULL DEFAULT 'PENDING',
  rejection_reason text, verified_by uuid, verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, kind),
  CHECK (state <> 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL AND attachment_id IS NOT NULL)),
  CHECK (state <> 'REJECTED' OR rejection_reason IS NOT NULL)
);

CREATE TABLE pmb_selection_results (                        -- keputusan; rank deterministik + tie-break tertulis
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES pmb_applications(id) ON DELETE CASCADE,
  wave_id uuid NOT NULL REFERENCES pmb_waves(id),
  status pmb_application_state NOT NULL CHECK (status IN ('SELECTED','RESERVE','REJECTED')),
  rank int CHECK (rank IS NULL OR rank > 0),
  tie_break_rule text NOT NULL,                             -- nama aturan yang dipakai, bukan nilai hasil
  score numeric(8,3),
  decided_by uuid NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(),
  promoted_from_reserve_at timestamptz,                     -- promosi cadangan saat yang di atas tidak daftar ulang (BENCH-07)
  UNIQUE (application_id), UNIQUE (wave_id, rank)
);
CREATE INDEX idx_pmb_results_wave ON pmb_selection_results(tenant_id, wave_id, status, rank);

CREATE TABLE pmb_reregistrations (                          -- titik ambil field Feeder maba (§14.5 butir 1), bukan form pasca-NIM
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES pmb_applications(id) ON DELETE CASCADE,
  funding_source_code text NOT NULL,                     -- kamus `funding_source` (§20); FK komposit tidak sah karena kunci reference_items (tenant_id, kind, code) → ditegakkan service + CI §23.7 butir 3
  entry_cost_rupiah bigint NOT NULL CHECK (entry_cost_rupiah >= 0),
  receipt_attachment_id uuid REFERENCES attachments(id),
  receives_kps boolean NOT NULL DEFAULT true,
  kps_number text, kps_issued_at timestamptz,
  completed_at timestamptz,
  UNIQUE (tenant_id, application_id),
  CHECK (NOT receives_kps OR kps_number IS NOT NULL OR completed_at IS NULL)
);

CREATE TABLE pmb_school_origins (                           -- asal sekolah; badan hukumnya tetap milik `external_organizations` (0053)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES pmb_applications(id) ON DELETE CASCADE,
  external_organization_id uuid NOT NULL REFERENCES external_organizations(id),
  npsn text, diploma_number text, graduation_year int CHECK (graduation_year BETWEEN 1950 AND 2100),
  entry_year int NOT NULL CHECK (entry_year BETWEEN 1950 AND 2100),
  UNIQUE (application_id)
);

CREATE TABLE pmb_appeals (                                  -- banding hasil seleksi; berkas bukti menempel pada objek kerja
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES pmb_applications(id) ON DELETE CASCADE,
  state pmb_appeal_state NOT NULL DEFAULT 'OPEN',
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 20 AND 2000),
  evidence_attachment_id uuid REFERENCES attachments(id),
  decided_by uuid, decided_at timestamptz, decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, application_id),
  CHECK (state <> 'OPEN' OR decided_by IS NULL),
  CHECK (state IN ('GRANTED','DENIED') = (decided_by IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE TABLE nim_assignments (                              -- NIM dialokasikan lewat sequence per prefix, BUKAN MAX()+1 (BENCH-04)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES pmb_applications(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES study_programs(id),
  nim text NOT NULL,
  state nim_state NOT NULL DEFAULT 'RESERVED',
  sequence_id uuid REFERENCES document_number_sequences(id),
  issued_at timestamptz, cancelled_at timestamptz, cancelled_by uuid,
  recycle_allowed boolean NOT NULL DEFAULT false,           -- BENCH-03/BR-R10: hanya bila NIM belum pernah terdaftar Feeder
  pddikti_reported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nim), UNIQUE (application_id),
  CHECK (nim ~ '^[0-9A-Za-z._-]{4,20}$'),
  CHECK (state <> 'ISSUED' OR issued_at IS NOT NULL),
  CHECK (state <> 'CANCELLED' OR (cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)),
  CHECK (recycle_allowed = false OR pddikti_reported_at IS NULL)
);
CREATE INDEX idx_nim_lookup ON nim_assignments(tenant_id, program_id, state);
```

**Kenapa bentuknya begini.** `EXCLUDE USING gist` pada `pmb_waves` adalah jantung gugus ini: tanpa larangan tumpang-tindih, satu pendaftar bisa lolos dua gelombang jalur yang sama dan sistem tidak punya jawaban saat kuota sudah terpakai dua kali; `btree_gist` sudah menjadi dependensi `0036` sehingga operatornya tersedia. Kolom `path_id` **ditambahkan** pada `pmb_waves` (register §14.7 hanya menulis `code, opens_at, closes_at`) karena frasa "per jalur" di register itu tidak dapat ditegakkan tanpa kunci jalur di tabel gelombang — ini pelengkapan, bukan perluasan makna. `UNIQUE (tenant_id, wave_id, applicant_membership_id, priority)` menjamin satu pendaftar tidak menaruh dua prioritas sama pada satu gelombang, dan `UNIQUE (tenant_id, applicant_membership_id, program_id)` adalah tempat keputusan produk "satu pendaftar boleh lolos dua prodi lalu wajib melepas satu" dieksekusi. `nim_assignments.recycle_allowed` menyimpan **syarat**, bukan hasil: CHECK-nya menolak daur ulang bila NIM pernah dilaporkan ke Feeder, karena di situlah pelanggaran BR-R10 menjadi bukti hukum, bukan catatan service.

**Dua hal yang sengaja TIDAK dibuat.** (1) Tidak ada tabel `pmb_applicants` kedua: orang adalah `tenant_memberships` + `users`, dan `retention_rules` kelas `pmb_applicant` (§16.6) sudah mengatur sisa hidupnya. (2) Tidak ada kolom `nim` di `pmb_applications`: NIM hanya milik `nim_assignments`, dan memindahkannya ke aplikasi adalah sumber kebenaran kedua (`RD-32`).

**Cara menandai batas DDL vs pemicu.** Draf blok ini sempat memuat dua baris yang tidak sah sebagai SQL: `CHECK (path_id IN (SELECT …))` (CHECK tidak boleh berisi subquery) dan `funding_source_code … REFERENCES pmb_program_quotas(??)`. Keduanya sudah dikeluarkan dari DDL dan diubah menjadi pemicu/CI yang dinyatakan eksplisit. Normanya: **kalimat "ditegakkan service" hanya sah kalau baris DDL-nya bersih**; jika tidak, yang tertulis adalah pseudo-DDL — bentuk lain dari `RD-05`.

**RLS.** Semua tabel ber-`tenant_id`, `ENABLE` + `FORCE` + policy `tenant_isolation`. `pmb_selection_results` dan `nim_assignments` additionally di-`REVOKE UPDATE` untuk `sica_app` pada kolom `rank`/`nim` melalui `GRANT` kolom-terbatas (pola §16.5): angka rangking dan NIM tidak boleh disunting dari jalur aplikasi biasa. `pmb_documents` dan `pmb_appeals` ikut `attachments` sebagai pemilik berkas.

**Status.** Kelas A: `pmb_application_state`, `pmb_document_state`, `pmb_appeal_state`, `nim_state` — dicerminkan ke §15.2 pada migrasi yang sama. Kelas C: `pmb_paths.code/name`, `pmb_documents.kind`, `pmb_reregistrations.funding_source_code` (kamus `funding_source`). **Penahan yang tidak hilang oleh DDL ini:** `nim_assignments` butuh `document_number_sequences` (`0020`, §23.1) dan `pmb_applications` butuh `external_organizations` (`0053`, §22.2.1); modul `pmb` tetap tidak boleh dijual sebelum keduanya ada (`P-10`).
