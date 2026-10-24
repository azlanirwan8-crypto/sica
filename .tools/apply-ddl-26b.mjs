import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const F = 'docs/DATA_MODEL.md';

/* Batch B: 0017, 0018, 0022, 0023, 0024, 0025.
   Nama dan ikatan diambil dari baris §14.7 yang sudah memutuskan bentuknya. Blok SQL ditulis
   sebagai satu template literal supaya tanda kutip SQL tidak bertabrakan dengan tanda kutip JS
   (kesalahan yang sudah dua kali membuat skrip patch saya gagal jalan). */

const s = [];
const add = (...l) => s.push(...l);

add('### 26.5 `0017_teaching_attendance.sql` — jurnal sesi, banding presensi, pemesanan ruang', '');
add('```sql');
add(`CREATE TYPE journal_state AS ENUM ('DRAFT','SUBMITTED','APPROVED','AMENDED');
CREATE TYPE appeal_state AS ENUM ('PENDING','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE reservation_state AS ENUM ('REQUESTED','CONFIRMED','RELEASED','CANCELLED','NO_SHOW');

CREATE TABLE session_journals (                            -- catatan dosen per sesi; 1:1 dengan class_sessions (vonis §14.7 D)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  author_membership_id uuid NOT NULL REFERENCES tenant_memberships(id),
  material_covered text NOT NULL CHECK (length(material_covered) BETWEEN 5 AND 4000),
  activities text, student_questions text, follow_up text,
  state journal_state NOT NULL DEFAULT 'DRAFT',
  submitted_at timestamptz, approved_by uuid REFERENCES users(id), approved_at timestamptz,
  amended_from_id uuid REFERENCES session_journals(id),    -- AMENDED = baris baru; jurnal rujukan tidak pernah ditimpa
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'DRAFT' OR submitted_at IS NULL),
  CHECK (state NOT IN ('SUBMITTED','APPROVED','AMENDED') OR submitted_at IS NOT NULL),
  CHECK (state <> 'APPROVED' OR approved_by IS NOT NULL),
  CHECK (amended_from_id IS NULL OR state = 'AMENDED'),
  UNIQUE (tenant_id, class_session_id)
);
CREATE INDEX idx_journals_class ON session_journals(tenant_id, submitted_at DESC);

CREATE TABLE attendance_appeals (                          -- pemilik tunggal jalur banding; 0074 dan bukti kanal menunjuk ke sini
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES attendances(id), class_session_id uuid REFERENCES class_sessions(id),
  student_id uuid NOT NULL REFERENCES students(id),
  claimed_state attendance_status NOT NULL,                -- enum §15 yang sama: banding tidak menciptakan kosakata hadir kedua
  reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 2000),
  evidence_attachment_id uuid REFERENCES attachments(id),
  state appeal_state NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(), window_ends_at timestamptz NOT NULL,
  decided_by uuid REFERENCES users(id), decided_at timestamptz, decision_note text,
  CHECK (requested_at <= window_ends_at),
  CHECK (state NOT IN ('APPROVED','REJECTED') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)),
  CHECK (state <> 'APPROVED' OR decision_note IS NOT NULL),
  CHECK (attendance_id IS NOT NULL OR class_session_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_appeal_open ON attendance_appeals(tenant_id, attendance_id)
  WHERE state = 'PENDING' AND attendance_id IS NOT NULL;
CREATE INDEX idx_appeals_window ON attendance_appeals(tenant_id, state, window_ends_at);

CREATE TABLE room_reservations (                           -- pemesanan ruang di luar jadwal kelas
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id),
  reserved_for date NOT NULL, start_time time NOT NULL, end_time time NOT NULL,
  purpose text NOT NULL CHECK (length(purpose) >= 5),
  organizer_membership_id uuid REFERENCES tenant_memberships(id), event_id uuid REFERENCES events(id),
  state reservation_state NOT NULL DEFAULT 'REQUESTED',
  expected_attendees int CHECK (expected_attendees IS NULL OR expected_attendees > 0),
  requires_setup boolean NOT NULL DEFAULT false, setup_note text,
  approved_by uuid REFERENCES users(id), approved_at timestamptz,
  released_at timestamptz, no_show_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (state <> 'CONFIRMED' OR approved_by IS NOT NULL),
  CHECK (state NOT IN ('RELEASED','CANCELLED') OR released_at IS NOT NULL),
  CHECK (state <> 'NO_SHOW' OR no_show_at IS NOT NULL)
);
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE room_reservations ADD CONSTRAINT excl_room_double_book
  EXCLUDE USING gist (tenant_id WITH =, room_id WITH =,
                      tsrange(reserved_for + start_time, reserved_for + end_time, '[)') WITH &&)
  WHERE (state IN ('REQUESTED','CONFIRMED'));
`);
add('```', '');
add('**Kenapa `EXCLUDE` dan bukan aplikasi.** Dua organisasi bisa memesan ruang yang sama dan yang menang adalah siapa yang selesai lebih dulu; `AGENTS §3.7` melarang kunci baris per-permintaan di jalur panas, jadi penjagalnya `EXCLUDE USING gist` di DB. `WHERE (state IN (...))` penting: riwayat `RELEASED`/`CANCELLED` tidak boleh menghalangi pemesanan baru. GiST memperlakukan NULL sebagai tidak-bentrok, sehingga `room_id` yang di sini `NOT NULL` sudah cukup — tidak perlu `coalesce` maupun `uuid_nil()`.', '');
add('**Yang tidak dibuat di gugus ini.** Tidak ada tabel banding kedua. `0074` hanya menulis penanda pada `attendances`; rumahnya tetap `attendance_appeals`, dan kolom `appeal_id` pada bukti kanal menunjuk ke tabel ini.', '');
add('');

add('### 26.6 `0018_assessment_publish.sql` — skor per komponen, status publikasi, reset massal, hasil semester, survei', '');
add('```sql');
add(`CREATE TYPE publish_state AS ENUM ('HIDDEN','DRAFTED','ANNOUNCED','PUBLISHED','LOCKED');
CREATE TYPE blanket_reset_state AS ENUM ('REQUESTED','APPROVED','APPLIED','REVERSED','REJECTED');
CREATE TYPE survey_kind AS ENUM ('EVALUASI_KULIAH','KEPUASAN_LAYANAN','TRACER_RINGAN','SURVEI_OTHER');
CREATE TYPE survey_state AS ENUM ('DRAFT','OPEN','CLOSED','ARCHIVED');

CREATE TABLE grade_component_scores (                      -- fakta skor; grade_components adalah definisinya, bukan faktanya (BENCH-88)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grade_id uuid NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES grade_components(id) ON DELETE CASCADE,
  raw_value numeric(12,4),
  scaled_value numeric(7,4) CHECK (scaled_value IS NULL OR scaled_value BETWEEN 0 AND 100),
  weight_used_bp int NOT NULL CHECK (weight_used_bp BETWEEN 0 AND 10000),  -- bobot yang DIPAKAI saat hitung, disalin
  is_absent boolean NOT NULL DEFAULT false,
  is_final boolean NOT NULL DEFAULT false,                 -- false = draf guru; true = ikut menghitung huruf
  formula_version_id uuid REFERENCES grade_formula_versions(id),
  entered_by uuid NOT NULL REFERENCES users(id), entered_at timestamptz NOT NULL DEFAULT now(),
  CHECK (is_absent OR raw_value IS NOT NULL OR scaled_value IS NOT NULL),
  UNIQUE (grade_id, component_id)
);
CREATE INDEX idx_gcs_component ON grade_component_scores(tenant_id, component_id, is_final);

CREATE TABLE grade_publish_states (                        -- FR-AKA-18 / SM-4: umumkan dan kunci adalah dua hal berbeda
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id), period_id uuid NOT NULL REFERENCES academic_periods(id),
  state publish_state NOT NULL DEFAULT 'HIDDEN',
  announced_by uuid REFERENCES users(id), announced_at timestamptz,
  published_by uuid REFERENCES users(id), published_at timestamptz,
  locked_by uuid REFERENCES users(id), locked_at timestamptz, lock_reason text,
  unlocked_by uuid REFERENCES users(id), unlocked_at timestamptz, unlock_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'ANNOUNCED' OR announced_at IS NOT NULL),
  CHECK (state <> 'PUBLISHED' OR (published_at IS NOT NULL AND announced_at IS NOT NULL)),
  CHECK (state <> 'LOCKED' OR (locked_by IS NOT NULL AND lock_reason IS NOT NULL)),
  CHECK (unlock_reason IS NULL OR locked_at IS NOT NULL),  -- membuka kunci hanya mungkin jika pernah dikunci
  UNIQUE (tenant_id, class_id)
);

CREATE TABLE grade_blanket_resets (                        -- BENCH-87: reset massal wajib beralasan, ber-VALIDATE, reversibel
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id), period_id uuid NOT NULL REFERENCES academic_periods(id),
  scope jsonb NOT NULL,                                    -- {"components":["UTS"],"students":[...]} — tidak pernah "semua" tanpa isi
  default_when_blank text NOT NULL CHECK (default_when_blank IN ('KEEP','ABSENT','ZERO','MINIMAL')),
  reason text NOT NULL CHECK (length(reason) >= 15),
  affected_count int NOT NULL CHECK (affected_count >= 0),
  state blanket_reset_state NOT NULL DEFAULT 'REQUESTED',
  requested_by uuid NOT NULL REFERENCES users(id), requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES users(id), approved_at timestamptz,
  applied_at timestamptz, reversal_of_id uuid REFERENCES grade_blanket_resets(id), reversed_at timestamptz,
  snapshot_before jsonb NOT NULL,                          -- tanpa ini "reversibel" hanya janji
  CHECK (requested_by <> approved_by),                     -- SoD: pemohon bukan penyetuju (BR-K2/BR-G4)
  CHECK (state NOT IN ('APPROVED','APPLIED') OR approved_by IS NOT NULL),
  CHECK (state <> 'REVERSED' OR (reversal_of_id IS NOT NULL AND reversed_at IS NOT NULL))
);

CREATE TABLE semester_results (                            -- BENCH-98 / keputusan P-8: turunan yang dibekukan, bukan tempat mengedit angka
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id), period_id uuid NOT NULL REFERENCES academic_periods(id),
  ip_semester numeric(4,3) NOT NULL CHECK (ip_semester BETWEEN 0 AND 4),
  sks_semester numeric(6,2) NOT NULL CHECK (sks_semester >= 0),
  cumulative_sks numeric(7,2) NOT NULL CHECK (cumulative_sks >= 0),
  ipk_cumulative numeric(4,3) CHECK (ipk_cumulative IS NULL OR ipk_cumulative BETWEEN 0 AND 4),
  count_subjects int NOT NULL DEFAULT 0 CHECK (count_subjects >= 0),
  is_current boolean NOT NULL DEFAULT true,
  computation_run_id uuid REFERENCES engine_runs(id),
  inputs_digest char(64) NOT NULL CHECK (inputs_digest ~ '^[0-9a-f]{64}$'),
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_semresult_current ON semester_results(tenant_id, student_id, period_id) WHERE is_current;
-- turunan immutable: REVOKE UPDATE, DELETE + pemicu app.reject_mutation() (§16.3).
-- Hitung ulang = baris baru; penurunan is_current lama hanya lewat service penilaian.

CREATE TABLE surveys (                                     -- gerbang require_survey_before_khs memeriksa baris ini
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL, title text NOT NULL, kind survey_kind NOT NULL,
  state survey_state NOT NULL DEFAULT 'DRAFT',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,            -- kelas C: pertanyaan dan skala adalah data kampus
  anon_key bytea,                                          -- token pseudonim responden; tidak pernah nama atau NIM
  period_id uuid REFERENCES academic_periods(id), class_id uuid REFERENCES classes(id),
  program_id uuid REFERENCES study_programs(id),
  opens_at timestamptz, closes_at timestamptz,
  blocks_khs boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at),
  UNIQUE (tenant_id, code)
);

CREATE TABLE survey_responses (                            -- objek pendamping, ikut didaftarkan sebagai 0018a
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_anon char(64) NOT NULL CHECK (respondent_anon ~ '^[0-9a-f]{64}$'),  -- hash ber-pepper; tanpa FK ke users oleh desain
  answers jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds int CHECK (duration_seconds IS NULL OR (duration_seconds >= 0 AND duration_seconds < 86400)),
  UNIQUE (survey_id, respondent_anon)
);
`);
add('```', '');
add('**Kenapa `weight_used_bp` disalin, bukan dibaca ulang.** Bobot komponen adalah kelas D yang dapat diubah kampus untuk semester berikutnya. Kalau fakta nilai hanya menyimpan `component_id`, nilai satu angkatan berubah setiap bobot disunting — pelanggaran jejak berversi `AGENTS §3.9` dan membuat transkrip lama tidak dapat direkonstruksi (BR-R12). Skor karenanya menyimpan bobot **yang dipakai saat hitung**.', '');
add('**Kenapa `semester_results` tabel, bukan view.** Angka ini dibekukan untuk laporan akreditasi dan transkrip; view akan bergerak setiap data sumber berubah, sehingga bukti yang dikirim ke BAN-PT tidak dapat direproduksi. Yang mencegahnya diedit tangan adalah `REVOKE UPDATE, DELETE` + pemicu insert-only (§16.3), bukan niat. Karena itu juga `P-8` memilih nama ini: `academic_results` dan `transcripts` adalah ejaan lama yang sudah punya pemilik lain (§11.5).', '');
add('**Anonimitas yang bisa dibuktikan.** `survey_responses` tidak punya kolom identitas sama sekali — yang disimpan hanya `respondent_anon` (hash ber-pepper). Bila nanti ada yang menuntut "siapa yang belum mengisi", jawabannya bukan menambah FK ke `users`, melainkan tabel keanggotaan terpisah yang berisi token tanpa jawaban (`survey_invitations`), dan itu keputusan yang harus diambil manusia lebih dulu.', '');
add('');

add('### 26.7 `0022_finance_channels_receipts.sql` — VA, jendela jatuh tempo, alokasi, tanda terima', '');
add('```sql');
add(`CREATE TYPE va_state AS ENUM ('ISSUED','USED','CANCELLED','EXPIRED');
CREATE TYPE due_basis AS ENUM ('INVOICE','PERIOD','INSTALLMENT','CUSTOM');
CREATE TYPE receipt_state AS ENUM ('DRAFT','ISSUED','VOIDED');

CREATE TABLE virtual_accounts (                            -- BENCH-19/20/34: VA ber-nyawa, bukan kolom di invoice
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES payment_channels(id),
  bank_code text NOT NULL, va_number text NOT NULL,
  invoice_id uuid REFERENCES invoices(id),
  student_id uuid NOT NULL REFERENCES students(id),
  amount_rupiah bigint CHECK (amount_rupiah IS NULL OR amount_rupiah > 0),
  state va_state NOT NULL DEFAULT 'ISSUED',
  issued_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz,
  used_at timestamptz, cancelled_at timestamptz, cancelled_by uuid REFERENCES users(id),
  close_to_expiry_reminded_at timestamptz,
  CHECK (expires_at IS NULL OR expires_at > issued_at),
  CHECK (state <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)),
  CHECK (state <> 'USED' OR used_at IS NOT NULL),
  UNIQUE (bank_code, va_number)                            -- IKAT KERAS BENCH-34: GLOBAL antar-tenant, bukan per tenant
);
CREATE INDEX idx_va_tenant_state ON virtual_accounts(tenant_id, state, expires_at);
CREATE INDEX idx_va_invoice ON virtual_accounts(tenant_id, invoice_id) WHERE invoice_id IS NOT NULL;

CREATE TABLE payment_windows (                             -- BENCH-21: satu-satunya sumber preseden due_at
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  code text NOT NULL, name text NOT NULL,
  basis due_basis NOT NULL,
  starts_on date NOT NULL, ends_on date NOT NULL,
  late_fee_bp int NOT NULL DEFAULT 0 CHECK (late_fee_bp BETWEEN 0 AND 10000),
  precedence int NOT NULL DEFAULT 100,                     -- dua jendela cocok -> precedence terkecil menang; deterministik, bukan urutan UUID
  applies_to jsonb NOT NULL DEFAULT '{}'::jsonb,          -- {"tariff_groups":[...],"paths":[...]} — kelas D
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  UNIQUE (tenant_id, period_id, code)
);

CREATE TABLE payment_allocations (                         -- BENCH-24: satu transfer untuk banyak invoice, overpay bisa dipecah
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount_rupiah bigint NOT NULL CHECK (amount_rupiah > 0),
  method text NOT NULL DEFAULT 'FIFO' CHECK (method IN ('FIFO','MANUAL','VA_MATCH')),
  allocated_by uuid NOT NULL REFERENCES users(id), allocated_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (payment_id, invoice_id)
);
CREATE INDEX idx_alloc_invoice ON payment_allocations(tenant_id, invoice_id);
-- "jumlah alokasi tidak melebihi nilai pembayaran" ditegakkan pemicu AFTER (CHECK tidak boleh berisi agregat).

CREATE TABLE receipts (                                    -- BENCH-33: kuitansi bernomor urut per tenant + digest verifikasi
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number text NOT NULL,                                    -- diambil dari document_number_sequences (§23), tidak pernah MAX()+1
  payment_id uuid NOT NULL REFERENCES payments(id),
  invoice_id uuid REFERENCES invoices(id),
  student_id uuid NOT NULL REFERENCES students(id),
  amount_rupiah bigint NOT NULL CHECK (amount_rupiah >= 0),
  state receipt_state NOT NULL DEFAULT 'DRAFT',
  issued_at timestamptz, voided_at timestamptz, void_reason text, voided_by uuid REFERENCES users(id),
  digest_sha256 char(64) CHECK (digest_sha256 IS NULL OR digest_sha256 ~ '^[0-9a-f]{64}$'),
  attachment_id uuid REFERENCES attachments(id),
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'ISSUED' OR (issued_at IS NOT NULL AND digest_sha256 IS NOT NULL)),
  CHECK (state <> 'VOIDED' OR (voided_at IS NOT NULL AND void_reason IS NOT NULL AND voided_by IS NOT NULL)),
  UNIQUE (tenant_id, number)
);
`);
add('```', '');
add('**Tiga hal yang tidak boleh salah di gugus ini.** (1) `UNIQUE (bank_code, va_number)` **tanpa** `tenant_id` adalah satu-satunya bentuk yang benar untuk BENCH-34: keunikan per-tenant membiarkan dua kampus menerbitkan nomor VA yang sama dan rekonsiliasi bank menjadi mustahil. (2) `payment_allocations` tidak menyimpan saldo invoice — sisa tagihan tetap turunan dari `invoices` dikurangi alokasi, supaya tidak ada dua sumber kebenaran. (3) Nomor kuitansi tidak pernah dihitung `MAX()+1` (kompetisi saat beban puncak); ia dari `document_number_sequences` yang sama dengan gugus dokumen (§23).', '');
add('');

add('### 26.8 `0023_krs_visibility.sql` — sebaran kelas dan paket KRS mahasiswa baru', '');
add('```sql');
add(`CREATE TYPE distribution_state AS ENUM ('DRAFT','PUBLISHED','WITHDRAWN');
CREATE TYPE package_state AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');

CREATE TABLE class_distributions (                         -- BENCH-35/41 + invariance I-12: tanpa sebaran, kelas tidak muncul di KRS
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id),
  program_id uuid NOT NULL REFERENCES study_programs(id),
  scheme_id uuid REFERENCES enrollment_schemes(id),
  group_code text,                                         -- nama kelompok buatan kampus: kamus, bukan enum
  concentration_ref text,                                  -- merujuk kamus konsentrasi (keputusan 1 pembuka §26), BUKAN FK ke tabel concentrations
  entry_year_from int NOT NULL CHECK (entry_year_from >= 1900),
  entry_year_to int NOT NULL CHECK (entry_year_to >= entry_year_from),
  modalities text[],                                       -- subset learningModality yang boleh mengambil; NULL = semua
  max_seats int CHECK (max_seats IS NULL OR max_seats > 0),
  state distribution_state NOT NULL DEFAULT 'DRAFT',
  published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'PUBLISHED' OR published_at IS NOT NULL),
  UNIQUE (tenant_id, class_id, program_id, group_code, entry_year_from, entry_year_to)
);
CREATE INDEX idx_distribution_lookup ON class_distributions(tenant_id, program_id, state, entry_year_from, entry_year_to);

CREATE TABLE krs_packages (                                -- FR-AKA-16; BENCH-47 menuntut first_semester_packed_sks
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES study_programs(id),
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  code text NOT NULL, name text NOT NULL,
  state package_state NOT NULL DEFAULT 'DRAFT',
  packed_sks int NOT NULL CHECK (packed_sks BETWEEN 0 AND 24),  -- plafon nasional dibaca dari §21.3 saat validasi
  is_auto_fill boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (state <> 'PUBLISHED' OR published_at IS NOT NULL),
  UNIQUE (tenant_id, program_id, period_id, code)
);

CREATE TABLE krs_package_lines (                           -- objek pendamping, ikut didaftarkan sebagai 0023a
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES krs_packages(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id),
  seq int NOT NULL CHECK (seq > 0),
  is_required boolean NOT NULL DEFAULT true,
  sks_snapshot numeric(4,1) NOT NULL CHECK (sks_snapshot > 0),  -- salinan SKS saat paket disusun (BR-R12)
  UNIQUE (package_id, class_id), UNIQUE (package_id, seq)
);
`);
add('```', '');
add('**Kenapa `concentration_ref text` dan bukan FK.** Konsekuensi keputusan 1 di pembuka §26: pemilik nama konsentrasi adalah kamus `reference_items(kind = konsentrasi)`, dan `concentration_preferences`/`concentration_placements` yang sudah ada juga menyimpan `concentration_ref`. Kalau suatu saat konsentrasi butuh struktur sendiri (syarat kelulusan per konsentrasi), vonisnya diubah **di §22.10 lebih dulu**, bukan dengan menambah FK diam-diam di sini.', '');
add('**I-12 punya gigi.** Service KRS membaca `class_distributions` sebagai gerbang: kelas tanpa baris sebaran yang cocok dengan prodi, angkatan, dan modus mahasiswa tidak muncul di daftar. Tidak ada jalan pintas "tampilkan semua" untuk peran akademik mana pun — penyaringan ini bukan kenyamanan UI, tetapi invariance yang diuji (BLUEPRINT §7).', '');
add('');

add('### 26.9 `0024_exam_scheduling.sql` — jadwal ujian dan pesertanya', '');
add('```sql');
add(`CREATE TYPE exam_kind AS ENUM ('UTS','UAS','SUSULAN','UKOM','CIMOS','PRA_UJIAN');
CREATE TYPE exam_part_state AS ENUM ('ASSIGNED','WITHDRAWN','EXCUSED');

CREATE TABLE exam_schedules (                              -- BENCH-60/84; ujian bukan lagi teks bebas di class_sessions
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  program_id uuid NOT NULL REFERENCES study_programs(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  kind exam_kind NOT NULL,
  group_code text,
  exam_date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL,
  room_id uuid REFERENCES rooms(id),
  supervisor_membership_id uuid REFERENCES tenant_memberships(id),
  provider conference_provider,                            -- NULL = luring; bila daring, kanal dari enum §21.10, bukan teks
  capacity int CHECK (capacity IS NULL OR capacity > 0),
  notes text, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_exam_calendar ON exam_schedules(tenant_id, period_id, exam_date, start_time);
-- BENCH-52/53: bentrok ruang ujian dijaga database. GiST mengabaikan NULL, jadi WHERE membatasi pada baris ber-ruang.
ALTER TABLE exam_schedules ADD CONSTRAINT excl_exam_room
  EXCLUDE USING gist (tenant_id WITH =, room_id WITH =,
                      tsrange(exam_date + start_time, exam_date + end_time, '[)') WITH &&)
  WHERE room_id IS NOT NULL;

CREATE TABLE exam_participants (                           -- BENCH-84: tiga tanggal berbeda, satu kolom tidak cukup
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_schedule_id uuid NOT NULL REFERENCES exam_schedules(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  student_id uuid NOT NULL REFERENCES students(id),
  state exam_part_state NOT NULL DEFAULT 'ASSIGNED',
  print_window_start date NOT NULL, print_window_end date NOT NULL, exam_date date NOT NULL,
  seat_code text,
  excuse_reason text, excused_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (print_window_end >= print_window_start),
  CHECK (exam_date >= print_window_start),
  CHECK (state <> 'EXCUSED' OR (excuse_reason IS NOT NULL AND excused_by IS NOT NULL)),
  UNIQUE (exam_schedule_id, enrollment_id)
);

-- janji §26.4 ditunaikan di sini: kartu ujian boleh dibuat tanpa jadwal, tapi tidak pernah menunjuk jadwal yang salah prodi.
ALTER TABLE exam_cards ADD CONSTRAINT fk_exam_card_schedule
  FOREIGN KEY (exam_schedule_id) REFERENCES exam_schedules(id);
`);
add('```', '');
add('**Dua hal yang sengaja tidak dibuat penjaga ganda.** (1) `exam_participants.exam_date` disamakan dengan `exam_schedules.exam_date` oleh pemicu, bukan dibiarkan sebagai dua kolom yang boleh berbeda — BENCH-84 menuntut tiga tanggal (cetak mulai, cetak akhir, hari-H) pada **peserta**, bukan kebebasan menuliskan hari-H yang berbeda dari jadwalnya. (2) Bentrok pengawas tidak dijaga `EXCLUDE` di sini karena satu pengawas boleh menjaga dua ruang paralel di kampus berbeda; yang dilarang (satu orang di dua waktu) sudah dijaga `lecturer_availability` + `timetabling_constraint_defs` (§18.2).', '');
add('');

add('### 26.10 `0025_teaching_records.sql` — kehadiran dosen (sumber BKD dan akreditasi)', '');
add('```sql');
add(`CREATE TYPE lecturer_mark_status AS ENUM ('PRESENT','ABSENT','SICK','PERMIT','ON_LEAVE','UNRECORDED');

CREATE TABLE lecturer_attendances (                        -- BENCH-66/74: tanpa ini "Rekap Absen Dosen" tidak punya tabel
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  lecturer_membership_id uuid NOT NULL REFERENCES tenant_memberships(id),
  status lecturer_mark_status NOT NULL,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','SCAN','LMS_ACTIVITY','IMPORT')),
  marked_by uuid NOT NULL REFERENCES users(id), marked_at timestamptz NOT NULL DEFAULT now(),
  corrected_from_id uuid REFERENCES lecturer_attendances(id),
  note text,
  CHECK (corrected_from_id IS NULL OR note IS NOT NULL)    -- koreksi butuh alasan, bukan penimpaan
);
CREATE UNIQUE INDEX uq_lecturer_session ON lecturer_attendances(class_session_id, lecturer_membership_id);
CREATE INDEX idx_lecturer_mark ON lecturer_attendances(tenant_id, lecturer_membership_id, marked_at DESC);
`);
add('```', '');
add('**Satu penanda per sesi per dosen, dan koreksi sebagai baris baru.** BKD menjumlahkan jam: dua baris untuk sesi yang sama berarti jam ganda di laporan akreditasi, jadi keunikannya ditegakkan DB. `corrected_from_id` + `note` membuat koreksi terlihat sebagai riwayat, bukan sebagai penggantian nilai — pola yang sama dengan `session_journals` dan `grade_change_logs` (§16.3).', '');
add('');

const sec = s.join(NL);
let t = readFileSync(F, 'utf8');
if (t.includes('### 26.5 ')) { console.log('dilewati: batch B sudah ada'); }
else {
  if (!t.endsWith(NL)) t += NL;
  writeFileSync(F, t + NL + sec, 'utf8');
  console.log('tambah DATA_MODEL 26 batch B (' + s.length + ' baris)');
}
