-- ==============================================================================
-- SICA Database Migration 0005: Field Data Kelengkapan Presensi & SKS (PDDikti/Sevima)
-- Architecture: PostgreSQL 16, single-schema multi-tenant, RLS wajib.
-- Rujukan: docs/DATA_MODEL.md §11.3–11.4, docs/SECURITY_COMPLIANCE.md.
-- Status: ditulis (design-locked); BELUM dieksekusi (butuh instance PostgreSQL).
-- Pattern: Expand (ADD COLUMN IF NOT EXISTS, nullable/ber-default) — zero-downtime,
--          kompatibel dgn aplikasi versi lama (Expand-and-Contract, DEPLOYMENT §2).
-- ==============================================================================

-- Proteksi lock (rule DDL §2.2 DEPLOYMENT_DEVOPS): jangan blokir antrean runtime.
SET lock_timeout = '3000ms';
SET statement_timeout = '15000ms';

-- 1. Enum baru (idempoten; skip bila sudah ada)
DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('PRESENT','EXCUSED','SICK','ABSENT_LATE','ABSENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_source AS ENUM ('QR','GEOFENCE','MANUAL','APP_BULK','FEEDER_SYNC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE course_type AS ENUM ('TEORI','PRAKTIKUM','LABORATORIUM','LAPANGAN','KULIAH_MANDIRI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. attendances: perlu dari boolean → status rinci + bukti geolokasi + jejak audit.
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS status attendance_status NOT NULL DEFAULT 'PRESENT';
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS source attendance_source NOT NULL DEFAULT 'QR';
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS marked_by uuid;               -- user (dosen/admin) utk sumber manual/bulk
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS distance_meters int;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS is_mock_location boolean NOT NULL DEFAULT false;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Index analitik (tenant, student, waktu). Untuk tabel besar, buat CONCURRENTLY di luar transaksi.
CREATE INDEX IF NOT EXISTS idx_attendances_tenant_student_time
  ON attendances (tenant_id, student_id, marked_at DESC);

-- Konsistensi: flag cepat `present` = status hadir tanpa keterangan (PRESENT).
ALTER TABLE attendances
  DROP CONSTRAINT IF EXISTS ck_attendance_present_consistent;
ALTER TABLE attendances
  ADD CONSTRAINT ck_attendance_present_consistent
  CHECK (present = (status = 'PRESENT'));

-- 3. courses: pemecahan SKS ala PDDikti/Sevima (total tetap otoritatif).
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sks_teori numeric(4,1);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sks_praktik numeric(4,1);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type course_type;

-- Total = teori + praktik (bila keduanya diisi); toleransi 0.05 utk pembulatan.
ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS ck_courses_sks_breakdown;
ALTER TABLE courses
  ADD CONSTRAINT ck_courses_sks_breakdown
  CHECK (
    sks_teori IS NULL OR sks_praktik IS NULL
    OR abs((sks_teori + sks_praktik) - sks) < 0.05
  );

-- 4. RLS sudah aktif utk attendances & courses (dari 0001/0002); kolom baru ikut policy.
--    Tidak perlu perubahan policy. Jaga FORCE utk role aplikasi NOBYPASSRLS.
