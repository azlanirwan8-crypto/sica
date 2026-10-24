
### 23.3 `0027_kelulusan_lanjutan.sql` — yudisium, tugas akhir, transkrip berversi

```sql
CREATE TYPE yudisium_batch_state AS ENUM ('DRAFT','REVIEWED','DECIDED','ANNOUNCED');
CREATE TYPE thesis_state AS ENUM ('PROPOSED','APPROVED_TOPIC','IN_PROGRESS','DEPOSITED','SCHEDULED','DEFENDED','REVISION','PASSED','FAILED','WITHDRAWN');
CREATE TYPE transcript_state AS ENUM ('DRAFT','SIGNED','ISSUED','SUPERSEDED','REVOKED');

CREATE TABLE yudisium_batches (                             -- satu SK penetapan per sesi; nomor = dari sequence 0020
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decree_number text NOT NULL,
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  state yudisium_batch_state NOT NULL DEFAULT 'DRAFT',
  decided_on date NOT NULL,
  requested_by uuid NOT NULL, approved_by uuid,             -- rektor/ketua menandatangani, bukan yang menyusun daftar
  announced_at timestamptz,
  document_id uuid REFERENCES documents(id),                -- SK sebagai dokumen terbit + berkasnya di attachments
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, decree_number),
  CHECK (approved_by IS NULL OR approved_by <> requested_by),
  CHECK (state IN ('DECIDED','ANNOUNCED') = (approved_by IS NOT NULL)),
  CHECK (state <> 'ANNOUNCED' OR announced_at IS NOT NULL)
);

CREATE TABLE thesis_records (                               -- objek yang dirujuk `final_project_outputs.thesis_record_id` (§19.3) dan catatan lulus (§5)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  program_id uuid NOT NULL REFERENCES study_programs(id),
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  final_project_kind_id uuid NOT NULL REFERENCES final_project_kinds(id),  -- skripsi/proyek/karya/sertifikasi (Permen 53/2023, §19.3)
  title text NOT NULL CHECK (char_length(title) BETWEEN 10 AND 500),
  title_en text,
  state thesis_state NOT NULL DEFAULT 'PROPOSED',
  credits int NOT NULL CHECK (credits BETWEEN 1 AND 12),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  approved_topic_at timestamptz,
  deposited_at timestamptz, defended_at timestamptz, passed_at timestamptz,
  similarity_run_id uuid,                                   -- milik engine_runs (0036); hasil cek kemiripan tidak disimpan sebagai angka telanjang di sini
  rama_attachment_id uuid REFERENCES attachments(id),        -- naskah lengkap milik M-39/RAMA tetap satu berkas per versi
  withdrawal_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id),                           -- satu karya puncak per mahasiswa per prodi pada satu waktu; pengulangan = state WITHDRAWN lebih dulu
  CHECK (state <> 'PASSED' OR passed_at IS NOT NULL),
  CHECK (state NOT IN ('DEPOSITED','SCHEDULED','DEFENDED','REVISION','PASSED') OR deposited_at IS NOT NULL),
  CHECK (state <> 'WITHDRAWN' OR withdrawal_reason IS NOT NULL)
);
CREATE INDEX idx_thesis_state ON thesis_records(tenant_id, program_id, state, period_id);

CREATE TABLE thesis_supervisors (                           -- BENCH-102: Feeder menuntut bulan awal/akhir per pembimbing
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thesis_record_id uuid NOT NULL REFERENCES thesis_records(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('PRIMARY','SECONDARY','CO_SUPERVISOR')),   -- kosakata jejak, bukan kelas C (§15.3)
  staff_id uuid NOT NULL,                                   -- lecturers/staff (§11.3) adalah pemilik biodata; tidak ada salinan nama
  start_month date NOT NULL CHECK (start_month = date_trunc('month', start_month)),
  end_month   date NOT NULL CHECK (end_month   = date_trunc('month', end_month)),
  sessions_logged int NOT NULL DEFAULT 0 CHECK (sessions_logged >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, thesis_record_id, role, staff_id),
  CHECK (end_month >= start_month)
);
CREATE INDEX idx_thesis_sup_staff ON thesis_supervisors(tenant_id, staff_id, start_month, end_month);

CREATE TABLE thesis_examiners (                             -- penugasan penguji + hasil sidang per orang, bukan satu nilai rata-rata
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thesis_record_id uuid NOT NULL REFERENCES thesis_records(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('CHAIR','INTERNAL','EXTERNAL','PRACTITIONER')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  hearing_at timestamptz,
  score numeric(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),   -- numeric, bukan float (AGENTS §3.4)
  verdict text CHECK (verdict IS NULL OR verdict IN ('ACCEPT','ACCEPT_WITH_REVISION','REJECT')),
  notes text,
  UNIQUE (tenant_id, thesis_record_id, staff_id),
  CHECK (verdict IS NULL OR hearing_at IS NOT NULL),
  CHECK (score IS NULL OR verdict IS NOT NULL)
);
CREATE INDEX idx_thesis_exam_hearing ON thesis_examiners(tenant_id, hearing_at);

CREATE TABLE transcript_versions (                          -- transkrip = berversi; yang sudah terbit tidak pernah diedit
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  version int NOT NULL CHECK (version > 0),
  language text NOT NULL DEFAULT 'id' CHECK (language IN ('id','en')),
  state transcript_state NOT NULL DEFAULT 'DRAFT',
  generated_at timestamptz NOT NULL DEFAULT now(),
  graduation_record_id uuid REFERENCES graduation_records(id),  -- transkrip definitif lahir dari kelulusan; transkrip sementara tidak
  total_sks numeric(5,1) CHECK (total_sks IS NULL OR total_sks >= 0),
  ipk numeric(3,2) CHECK (ipk IS NULL OR ipk BETWEEN 0 AND 4),
  snapshot_hash bytea,                                      -- digest baris hasil; bukti arsip (BR-R12)
  document_id uuid REFERENCES documents(id),
  signed_by uuid, signed_at timestamptz,
  superseded_by uuid REFERENCES transcript_versions(id),
  UNIQUE (tenant_id, student_id, version, language),
  CHECK (state NOT IN ('SIGNED','ISSUED') OR (signed_by IS NOT NULL AND snapshot_hash IS NOT NULL)),
  CHECK (state <> 'ISSUED' OR document_id IS NOT NULL),
  CHECK (superseded_by IS NULL OR superseded_by <> id)
);

CREATE TABLE transcript_lines (                             -- nama matakuliah DIPERSIST pada saat terbit (kewajiban arsip, BENCH-117)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transcript_version_id uuid NOT NULL REFERENCES transcript_versions(id) ON DELETE CASCADE,
  ordinal int NOT NULL CHECK (ordinal > 0),
  course_code text NOT NULL, course_name text NOT NULL,     -- salinan nilai, bukan salinan tabel: baris ini beku pada saat terbit
  academic_period_label text NOT NULL,
  sks numeric(4,1) NOT NULL CHECK (sks > 0),
  letter text NOT NULL, points numeric(3,1) NOT NULL CHECK (points BETWEEN 0 AND 4),
  course_type text,                                        -- kamus `course_type` (§14.5), boleh NULL untuk baris transfer
  equivalence_source text                                  -- MBKM/transfer: asal penyetaraan, bukan angka yang dihitung ulang
);
CREATE UNIQUE INDEX idx_transcript_lines_pos ON transcript_lines(tenant_id, transcript_version_id, ordinal);
```

**Kenapa barisnya begini.** `thesis_records` adalah jawaban atas foreign key yang menggantung: §19.3 menulis `final_project_outputs.thesis_record_id REFERENCES thesis_records(id)` dan §5 menulis bahwa field tugas akhir **tidak** dipindah ke `graduation_records` karena Feeder menuntut rentang bulan per pembimbing — tapi tabelnya belum pernah dibuat di mana pun. `thesis_supervisors.start_month/end_month` dipaksa ke awal bulan oleh CHECK karena Feeder membaca bulan, bukan tanggal; menyimpan tanggal sembarang akan membuat pengiriman menghasilkan angka yang berbeda dari yang dibaca kampus. `transcript_lines` menyalin `course_name` dan label periode **sengaja**: itu satu-satunya tempat di skema ini di mana menyalin kolom dibenarkan, karena transkrip yang terbit 2024 harus tetap terbaca sama setelah nama matakuliah diganti 2026 (BR-R12), dan view `security_invoker` tidak dapat merekonstruksi masa lalu.

**RLS & kekebalan arsip.** Semua tabel ber-`tenant_id` dengan `ENABLE`+`FORCE`+`tenant_isolation`. `transcript_lines` dan `thesis_examiners.score/verdict` di-`REVOKE UPDATE, DELETE` dari `sica_app` dan dijaga pemicu `app.reject_mutation()` (pola CE-5.2): baris transkrip dan nilai sidang adalah arsip, koreksi = versi baru. `transcript_versions` boleh berpindah state hanya maju (`DRAFT→SIGNED→ISSUED→SUPERSEDED`); perpindahan mundur ditolak service dan diuji di §23.7 butir 5.

**Status.** Kelas A: `yudisium_batch_state`, `thesis_state`, `transcript_state` (+ §15.2). Kelas A′/jejak: `thesis_supervisors.role`, `thesis_examiners.role`, `verdict` (kosakata penugasan, tertutup karena dibaca aturan). Kelas C: tidak ada di gugus ini — jenis karya puncak sudah dimiliki `final_project_kinds` (§19.3), dan menyalanya sebagai enum baru di sini adalah sumber kebenaran kedua.

### 23.4 `0019_permohonan_kelulusan.sql` — permohonan, legalisir, dan sesi wisuda

```sql
CREATE TYPE graduation_application_state AS ENUM ('DRAFT','SUBMITTED','CLEARANCE_PENDING','ELIGIBLE','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE legalisation_state AS ENUM ('REQUESTED','PAID','IN_PROGRESS','READY','DELIVERED','REJECTED','CANCELLED');
CREATE TYPE commencement_state AS ENUM ('PLANNED','OPEN_REGISTRATION','CLOSED','HELD','PUBLISHED','CANCELLED');

CREATE TABLE graduation_applications (                      -- gerbang masuk yudisium: tagihan, clearance, SKS, prasyarat
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  state graduation_application_state NOT NULL DEFAULT 'DRAFT',
  sks_completed numeric(5,1) NOT NULL CHECK (sks_completed >= 0),
  ipk_current numeric(3,2) NOT NULL CHECK (ipk_current BETWEEN 0 AND 4),
  thesis_record_id uuid REFERENCES thesis_records(id),
  clearance_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,     -- daftar dimensi + keadaan saat diajukan; bukan salinan tabel clearance
  outstanding_billing boolean NOT NULL DEFAULT false,        -- boolean + sebab, nominal TIDAK dibaca peran akademik (§3.8 FIELD_RULES)
  blocked_reason text,
  submitted_at timestamptz, decided_by uuid, decided_at timestamptz,
  yudisium_batch_id uuid REFERENCES yudisium_batches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, period_id),
  CHECK (state <> 'APPROVED' OR (decided_by IS NOT NULL AND yudisium_batch_id IS NOT NULL)),
  CHECK (state NOT IN ('ELIGIBLE','APPROVED') OR thesis_record_id IS NOT NULL OR sks_completed < 1),  -- karya puncak wajib kecuali model prodi lain (§19.3)
  CHECK (state <> 'REJECTED' OR blocked_reason IS NOT NULL)
);
CREATE INDEX idx_grad_apps_state ON graduation_applications(tenant_id, period_id, state);

CREATE TABLE legalisation_requests (                        -- legalisir/SKL: jumlah, keperluan, biaya, status
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number text NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id),
  source_document_id uuid NOT NULL REFERENCES documents(id), -- yang dilegalisasi adalah dokumen terbit, bukan berkas lepas
  copies int NOT NULL CHECK (copies BETWEEN 1 AND 50),
  purpose text NOT NULL CHECK (char_length(purpose) BETWEEN 3 AND 300),
  state legalisation_state NOT NULL DEFAULT 'REQUESTED',
  fee_rupiah bigint NOT NULL DEFAULT 0 CHECK (fee_rupiah >= 0),
  invoice_id uuid,                                          -- tagihan milik M-10; tidak ada kolom "sudah bayar" di sini
  paid_at timestamptz, processed_by uuid, ready_at timestamptz, delivered_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_number),
  CHECK (state NOT IN ('IN_PROGRESS','READY','DELIVERED') OR paid_at IS NOT NULL OR fee_rupiah = 0),
  CHECK (state <> 'DELIVERED' OR ready_at IS NOT NULL),
  CHECK (state <> 'REJECTED' OR rejection_reason IS NOT NULL)
);
CREATE INDEX idx_legalisation_state ON legalisation_requests(tenant_id, state, created_at);

CREATE TABLE commencement_batches (                         -- sesi wisuda (dulu disebut "convocation" di API_SPEC §7.27 — nama objek tetap di sini)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, label text NOT NULL,
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  held_on date NOT NULL,
  site_id uuid REFERENCES campus_sites(id),                 -- §19.1; wisuda lintas kampus = baris per site
  state commencement_state NOT NULL DEFAULT 'PLANNED',
  registration_opens_at timestamptz, registration_closes_at timestamptz,
  seat_capacity int NOT NULL CHECK (seat_capacity > 0),     -- kapasitas kursi; penahanannya di Redis-Lua saat beban puncak (§3.7), bukan UPDATE per request
  gown_issued_count int NOT NULL DEFAULT 0 CHECK (gown_issued_count >= 0),
  decree_document_id uuid REFERENCES documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  CHECK (registration_closes_at IS NULL OR registration_opens_at IS NULL OR registration_closes_at > registration_opens_at),
  CHECK (state <> 'PUBLISHED' OR held_on <= current_date)
);
```

**Kenapa begini.** `graduation_applications.clearance_snapshot` disimpan sebagai JSON **berversi waktu**, bukan sebagai kolom boolean "lunas/clear": clearance punya dimensi milik modul lain (§5, `0009`), dan menyalin satu boolean akan membuat dua sumber kebenaran tentang keadaan yang sama — pola yang ditolak `RD-32`. Yang dibekukan di sini hanyalah daftar dimensi beserta keadaannya **pada saat permohonan diajukan**, supaya keputusan dapat direkonstruksi ketika salah satu dimensi berubah setelahnya. `legalisation_requests` **tidak** punya kolom "sudah bayar": ia menunjuk `invoice_id` dan memindahkan state saat M-10 mengonfirmasi pembayaran, karena jika kolomnya ada di sini maka status keuangan akan bisa dibaca benar di satu tempat dan salah di tempat lain. `seat_capacity` dibiarkan sebagai kolom biasa karena pengurangannya bukan `UPDATE ... FOR UPDATE` per pendaftar (`AGENTS §3.7`), melainkan lewat antrean + kunci atomik Redis; kolom `gown_issued_count` hanya pencatat hasil.

**RLS.** `ENABLE`+`FORCE`+`tenant_isolation` untuk ketiganya; `graduation_applications` dan `legalisation_requests` diambil lewat service yang sama yang membaca `clearances` dan `invoices`, jadi tidak ada jalur baca langsung ke kolom uang. Tidak ada tabel alumni baru di gugus ini: alumni adalah baris `students` dengan `status_akademik='GRADUATED'` (vonis §22.4.2), dan membuat `alumni_profiles` akan menghasilkan dua kebenaran tentang satu orang.

### 23.5 Sisa `0026_kemahasiswaan_skpi.sql` — empat objek, satu nama dikalah

`student_activities` **tidak** dibuat: konsepnya sudah dimiliki `activity_participations` (`0064`, §22.6.1) yang punya DDL lengkap. Yang ditulis di bawah hanya empat objek lain yang didaftarkan pada nomor itu dan menjadi **pakan SKPI** (M-30) — sertifikat, publikasi, dan capaian yang tidak dimiliki modul lain.

```sql
CREATE TYPE certification_state AS ENUM ('DRAFT','ISSUED','REVOKED','EXPIRED');

CREATE TABLE activity_kinds (                               -- kelas C: kampus menambah jenis kegiatan tanpa rilis kode
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'kegiatan_mahasiswa',          -- selalu 'kegiatan_mahasiswa' untuk item kamus jenis; dipertahankan agar lookup §20 seragam
  code text NOT NULL, name text NOT NULL, name_en text,
  default_points int NOT NULL DEFAULT 0 CHECK (default_points >= 0),
  is_skpi_visible boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  UNIQUE (tenant_id, code)
);

CREATE TABLE achievement_levels (                           -- tingkat capaian: lokal/nasional/internasional + predikat (kamus, dengan bobot)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL,
  multiplier_bp int NOT NULL CHECK (multiplier_bp BETWEEN 1000 AND 100000),  -- basis poin, bukan float: 10000 = 1,00x
  rank_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code)
);

CREATE TABLE certification_records (                        -- sertifikat non-kurikuler yang masuk SKPI; SIVIL tetap milik 0052
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  activity_kind_id uuid REFERENCES activity_kinds(id),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  issuer text NOT NULL,
  issued_on date NOT NULL, expires_on date,
  certificate_number text,
  attachment_id uuid NOT NULL REFERENCES attachments(id),
  state certification_state NOT NULL DEFAULT 'ISSUED',
  points_awarded int NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  verified_by uuid, verified_at timestamptz,                -- empat-mata: yang mengunggah bukan yang mengesahkan
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, attachment_id),
  CHECK (state <> 'EXPIRED' OR expires_on IS NOT NULL),
  CHECK (state <> 'REVOKED' OR revoked_reason IS NOT NULL),
  CHECK (verified_by IS NULL OR verified_by <> student_id)
);
CREATE INDEX idx_certification_student ON certification_records(tenant_id, student_id, state, issued_on DESC);

CREATE TABLE publication_records (                          -- baris pakan SKPI: ringkasan terbit, bukan pemilik artikel
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_student_id uuid NOT NULL REFERENCES students(id),
  source_article_id uuid,                                   -- bila sudah ada di M-21 (§22.5.1), ini proyeksi baca-saja; NULL = publikasi yang belum masuk jurnal kampus
  title text NOT NULL, venue text NOT NULL,
  published_on date, indexing_status text,
  doi text,
  attachment_id uuid REFERENCES attachments(id),
  verified_by uuid, verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_article_id IS NULL OR doi IS NULL OR length(doi) > 6)
);
```

**Batas yang dijaga.** `publication_records` **bukan** pemilik artikel ilmiah: penulis dan status indeks yang sah ada di gugus M-21 (`journals`, artikel, HKI di §22.5). Yang boleh disimpan di sini hanya ringkasan yang diperlukan SKPI mahasiswa, dengan `source_article_id` sebagai penunjuk. Kalau kolom ini mulai menghitung ulang angka (mis. skor SINTA), gugus ini melanggar vonis tanggung-jawab-tunggal `PRD §5.13.1` dan temuannya adalah dua angka untuk satu artikel. `certification_records` juga tidak menyaingi `e_certificates` (`0052`): yang itu adalah sertifikat **verifikasi nasional** (SIVIL) dengan rantai hash, yang ini adalah sertifikat kegiatan yang dilaporkan di SKPI.

### 23.6 Nomor baru: `0076_student_cards.sql` dan `0077_tracer_study.sql`

Kedua gugus ini **belum pernah punya nomor** di register mana pun — `student_cards`/KTM tidak disebut di §14.7 dan `tracer_*` didaftarkan sebagai "modul ter-seed tanpa model data" (`P-10`, §14.8). Nomornya diambil dari ujung register: maksimum terukur saat ini `0075` (`MIGRATION_SOP §5.1` butir 1), sehingga `0076`/`0077` sah dan wajib naik ke register sebelum dieksekusi.

```sql
CREATE TYPE student_card_state AS ENUM ('REQUESTED','PRINTED','ACTIVE','BLOCKED','EXPIRED','RETURNED','LOST');
CREATE TYPE tracer_wave_state AS ENUM ('DRAFT','OPEN','CLOSED','PUBLISHED','CANCELLED');

CREATE TABLE student_cards (                                -- KTM: nomor kartu, masa berlaku, foto, keadaan
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  card_number text NOT NULL,
  series text NOT NULL,                                     -- contoh '2024/2028' mengikuti masa studi; format dipakai dari document_number_sequences
  state student_card_state NOT NULL DEFAULT 'REQUESTED',
  issued_on date, valid_until date,
  photo_attachment_id uuid REFERENCES attachments(id),      -- wajah = PII: kelas SPECIFIC, tidak pernah termask di log (§7 SECURITY)
  rfid_seq text, magnetic_hash text,                        -- hash, bukan kunci telanjang; verifikasi = cocok/tidak
  printed_by uuid, printed_at timestamptz,
  replacement_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, card_number),
  CHECK (valid_until IS NULL OR issued_on IS NULL OR valid_until > issued_on),
  CHECK (state NOT IN ('ACTIVE','RETURNED','EXPIRED') OR (issued_on IS NOT NULL AND printed_at IS NOT NULL)),
  CHECK (state NOT IN ('LOST','BLOCKED','RETURNED') OR replacement_reason IS NOT NULL),
  CHECK (magnetic_hash IS NULL OR magnetic_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX idx_cards_student ON student_cards(tenant_id, student_id, state);

CREATE TABLE student_card_events (                          -- insert-only: satu kartu yang hilang & diganti harus dapat diceritakan ulang
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES student_cards(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('REQUEST','PRINT','ACTIVATE','BLOCK','LOST','REISSUE','RETURN','EXPIRE')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor uuid, note text
);

CREATE TABLE tracer_survey_waves (                          -- M-27: gelombang survei tracer study per tahun kelulusan
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, label text NOT NULL,
  graduation_year int NOT NULL CHECK (graduation_year BETWEEN 1950 AND 2100),
  window_opens_at timestamptz NOT NULL, window_closes_at timestamptz NOT NULL,
  state tracer_wave_state NOT NULL DEFAULT 'DRAFT',
  target_population int NOT NULL DEFAULT 0 CHECK (target_population >= 0),
  response_count int NOT NULL DEFAULT 0 CHECK (response_count >= 0),
  published_at timestamptz,                                 -- IKU 1 menghitung dari yang DITERBITKAN, bukan dari yang mentah
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  CHECK (window_closes_at > window_opens_at),
  CHECK (state <> 'PUBLISHED' OR published_at IS NOT NULL),
  CHECK (response_count <= target_population)               -- dua-duanya dihitung ulang dari baris, bukan dipercaya dari body
);

CREATE TABLE tracer_questions (                             -- instrumen berversi; pertanyaan lama tidak pernah diedit setelah dibuka
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wave_id uuid NOT NULL REFERENCES tracer_survey_waves(id) ON DELETE CASCADE,
  ordinal int NOT NULL CHECK (ordinal > 0),
  prompt text NOT NULL,
  answer_type text NOT NULL CHECK (answer_type IN ('SINGLE','MULTI','NUMBER','DATE','TEXT','EMPLOYMENT_STATUS')),
  is_required boolean NOT NULL DEFAULT true,
  iku_mapping text,                                         -- pemetaan ke indikator IKU; NULL = pertanyaan pendukung
  options jsonb NOT NULL DEFAULT '[]'::jsonb                -- HANYA label; pilihan berpilihan wajib menunjuk `reference_items` (§3.10), tidak boleh menciptakan kosakata baru
);
CREATE UNIQUE INDEX idx_tracer_questions_pos ON tracer_questions(tenant_id, wave_id, ordinal);

CREATE TABLE tracer_responses (                             -- satu respons per alumni per gelombang; identitas alumni = baris students
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wave_id uuid NOT NULL REFERENCES tracer_survey_waves(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  answered_at timestamptz NOT NULL DEFAULT now(),
  consent_given boolean NOT NULL DEFAULT false,             -- tanpa consent: tidak boleh ditampilkan ke pemberi kerja (M-28)
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,               -- {question_id: value}; nilai tidak pernah masuk sebagai kolom dinamis
  completeness_pct numeric(5,2) CHECK (completeness_pct IS NULL OR completeness_pct BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX idx_tracer_response_once ON tracer_responses(tenant_id, wave_id, student_id);

CREATE TABLE tracer_employment_records (                    -- fakta kerja alumni; M-28 membaca ini, tidak menulis ulang (vonis 13)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  response_id uuid REFERENCES tracer_responses(id),
  status text NOT NULL CHECK (status IN ('WORKED','NOT_WORKED','STUDYING','ENTREPRENEUR','UNAVAILABLE')),
  started_on date, end_on date,
  job_title text, job_sector text,
  external_organization_id uuid REFERENCES external_organizations(id),  -- pemberi kerja adalah pihak ketiga; tidak ada nama perusahaan yang diketik bebas
  salary_band_code text,                                    -- kamus `income_band`: rentang, bukan nominal (SoD gaji, §3.8)
  verified_at timestamptz, verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_on IS NULL OR started_on IS NULL OR end_on >= started_on),
  CHECK (status <> 'WORKED' OR job_title IS NOT NULL)
);
CREATE INDEX idx_tracer_employment ON tracer_employment_records(tenant_id, student_id, started_on DESC);
```

**Kenapa KTM butuh peristiwa dan tracer butuh consent.** `student_cards.state` sendirian tidak menjawab pertanyaan yang pasti muncul saat sengketa ("kartu ini kapan diblokir, siapa yang menyatakan hilang, dan kartu pengganti nomor berapa"), sehingga `student_card_events` dibuat insert-only dengan `REVOKE UPDATE, DELETE` (pola §16.3.3). `tracer_responses.consent_given` adalah syarat hukum, bukan kolom hiasan: tanpa consent, baris alumni tidak boleh keluar ke M-28 maupun ke laporan yang dapat diunduh, dan penolakan itu **dicatat** (`AGENTS §3.8`, `SECURITY §7`). `tracer_employment_records.external_organization_id` memaksa nama pemberi kerja tetap satu identitas di `0053`; kolom `job_title` bebas teks dibiarkan karena judul pekerjaan memang milik responden, tetapi **perusahaan** tidak.

**Status.** Kelas A: `student_card_state`, `tracer_wave_state`. Kelas jejak: `student_card_events.event`, `tracer_questions.answer_type`, `tracer_employment_records.status` (kosakata pelaporan IKU, tertutup karena dibaca indikator). Kelas C: `activity_kinds`, `achievement_levels`, `income_band` (kamus), `tracer_questions.options` **hanya** label untuk kamus yang sudah terdaftar.

### 23.7 Register, query verifikasi CI, dan sisa tagihan

**Register nomor yang disentuh §23.**

| Berkas | Isi | Prasyarat | Status |
|---|---|---|---|
| `0019` | `graduation_applications`, `legalisation_requests`, `commencement_batches` (`documents` **dihapus** dari baris ini, ralat 1) | `0020` (`documents`, `attachments`), `0027` (`thesis_records`, `yudisium_batches`), §5 `academic_periods` | DDL **ditulis di §23.4** — belum dieksekusi (`G-02`) |
| `0020` | `attachments`, `document_number_sequences`, `documents`, `import_runs` | `0001`, `document_templates` (§17), `document_signatures` (§4.7) | DDL **ditulis di §23.1** — penahan backend objek |
| `0021` | 10 objek PMB | `0020`, `0053` (`external_organizations`), `0036` (`btree_gist`), `academic_years`/`study_programs` | DDL **ditulis di §23.2** — `P-10` menahan penjualan modul `pmb` |
| `0026` | `activity_kinds`, `achievement_levels`, `certification_records`, `publication_records`; `student_activities` **KALAH** | `0064` (`activity_participations`), `0020` | DDL **ditulis di §23.5** |
| `0027` | `yudisium_batches`, `thesis_records`, `thesis_supervisors`, `thesis_examiners`, `transcript_versions`, `transcript_lines` | `0020`, `0019`(§5 `graduation_records`), `0036` (`engine_runs`), §19.3 `final_project_kinds` | DDL **ditulis di §23.3** |
| `0076` | `student_cards`, `student_card_events` | `0020` (penomoran + foto), §5 `students` | **nomor baru lahir di sini** — wajib naik ke `MIGRATION_SOP §5` |
| `0077` | `tracer_survey_waves`, `tracer_questions`, `tracer_responses`, `tracer_employment_records` | `0053`, §5 `students`, `reference_items` | **nomor baru lahir di sini** — wajib naik ke `MIGRATION_SOP §5` |

**Query verifikasi CI (dijalankan di DB nyata, bukan dibaca sebagai prosa).** (1) `node .tools/fk-audit.mjs` → **0** target `REFERENCES` tanpa pembuat; (2) pemicu `app.assert_pmb_wave_path()` menolak `INSERT pmb_applications` dengan `path_id` berbeda dari gelombangnya (`42501`/`23514` sesuai implementasi, bukan "0 rows affected"); (3) `pmb_reregistrations.funding_source_code` yang tidak ada di `reference_items(kind='funding_source')` ditolak service **dan** query `LEFT JOIN reference_items … WHERE r.code IS NULL` menghasilkan **0 baris** setelah seed; (4) setiap tabel §23 diuji **dua-tenant silang = 0 baris bocor** (`AGENTS §3.2`); (5) `UPDATE`/`DELETE` pada `transcript_lines`, `thesis_examiners`, `student_card_events`, `import_runs` sebagai `sica_app` menghasilkan **error**, bukan senyap; (6) `EXCLUDE` pada `pmb_waves` menolak dua gelombang beririsan satu jalur; (7) `UNIQUE (tenant_id, nim)` menolak NIM dobel dan `recycle_allowed` menolak daur ulang NIM yang sudah `pddikti_reported_at`; (8) `documents` tidak boleh punya dua baris dengan `(doc_type, number)` sama walau `tenant_id` beda — sequence per-tenant dibuktikan, bukan diasumsikan; (9) `SELECT count(*) FROM pg_catalog.pg_prepared_statements` tetap 0 (`prepare=false`, `AGENTS §3.7`); (10) `tracer_responses.consent_given = false` tidak dapat dibaca melalui proyeksi M-28 (uji penolakan `403`, bukan uji filter).

**Sisa tagihan setelah §23 (angka dihitung ulang, jangan dikutip).** `node .tools/ddl-gap.mjs` mengukur nama objek yang terdaftar di `MIGRATION_SOP §5` tanpa `CREATE TABLE`. Setelah tujuh gugus di atas ditulis, yang **tersisa** adalah nomor `0013`, `0014`, `0015`, `0016`, `0017`, `0018`, `0022`, `0023`, `0024`, `0025`, `0028`, `0029` dan sebagian `0030`–`0050` — yaitu jalur **keuangan (VA/rekonsiliasi), jadwal & ujian, kehadiran dosen, jembatan Feeder, dan notifikasi**. Tidak satu pun dari itu boleh dinyatakan siap hanya karena nomornya ada. Angka barisnya hari ini dikeluarkan oleh alat, bukan oleh bagian ini.
