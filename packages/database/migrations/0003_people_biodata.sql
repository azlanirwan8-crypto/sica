-- ==============================================================================
-- SICA Database Migration 0003: Personel (dosen/tendik) & Biodata Mahasiswa (feeder)
-- Menutup celah field data Sevima/PDDikti — lihat docs/DATA_MODEL.md §11.2–11.3.
-- Expand-only, idempoten; tabel tenant-scoped langsung dipasang RLS FORCE.
-- ==============================================================================

SET lock_timeout = '10s';

-- 1. Enum pendukung (idempoten)
DO $$ BEGIN CREATE TYPE sex_type AS ENUM ('M','F'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE income_band AS ENUM ('LEB_300','L300_500','L500_1JT','L1_2JT','GT_2JT','TIDAK_BEKERJA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lecturer_job_rank AS ENUM ('GURU_BESAR','LEKTOR_KEPALA','LEKTOR','ASISTEN_AHLI','TENAGA_PENGAJAR','NONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE employment_type AS ENUM ('PNS','PPPK_PENUH','PPPK_PARUH','DOSEN_TETAP_YAYASAN','DOSEN_LUAR_BIASA','DOSEN_TIDAK_TETAP','TENAGA_HONORER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Biodata mahasiswa: tambah kolom feeder ke students (nullable → aman utk baris lama)
ALTER TABLE students ADD COLUMN IF NOT EXISTS sex sex_type;
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_place text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE students ADD COLUMN IF NOT EXISTS citizenship text NOT NULL DEFAULT 'WNI';
ALTER TABLE students ADD COLUMN IF NOT EXISTS religion text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS child_order int;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mobile_phone text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS personal_email text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS funding_source text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS pddikti_id_pd uuid;
ALTER TABLE students ADD COLUMN IF NOT EXISTS nisn text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS feeder_status_code text NOT NULL DEFAULT '1';

-- 3. Master Dosen (atribut feeder per-tenant; identitas global tetap di users/tenant_memberships)
CREATE TABLE IF NOT EXISTS lecturers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES tenant_memberships(id) ON DELETE CASCADE,
  program_id uuid REFERENCES study_programs(id),
  nidn text, nuptk text, pddikti_id_dosen uuid, code text,
  title_prefix text, title_suffix text, specialization text,
  academic_rank lecturer_job_rank NOT NULL DEFAULT 'NONE',
  employment_type employment_type NOT NULL DEFAULT 'DOSEN_TETAP_YAYASAN',
  is_primary_lecturer boolean NOT NULL DEFAULT true,
  homebase_org_id uuid REFERENCES organizations(id),
  science_cluster text, last_degree_country text, last_degree_university text, last_degree_year int,
  start_service_date date,
  gender sex_type, birth_place text, birth_date date, religion text,
  nationality text NOT NULL DEFAULT 'WNI', disability_type text,
  mobile_phone text, official_email text, address text,
  certifier_number text, certification_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lecturers_membership UNIQUE (tenant_id, membership_id)
);
CREATE INDEX IF NOT EXISTS idx_lecturer_nidn ON lecturers(tenant_id, nidn);
CREATE INDEX IF NOT EXISTS idx_lecturer_homebase ON lecturers(tenant_id, homebase_org_id);

-- 4. Master Tendik/Staff
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES tenant_memberships(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id),
  nip text, code text, full_name text NOT NULL,
  position_type text NOT NULL DEFAULT 'TERTENTU',
  structural_title text, functional_title text,
  employment_type employment_type NOT NULL DEFAULT 'TENAGA_HONORER',
  education_last text, start_date date,
  gender sex_type, birth_date date, mobile_phone text, official_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_staff_membership UNIQUE (tenant_id, membership_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_org ON staff(tenant_id, org_id);

-- 5. Alamat mahasiswa (DOMICILE/ORIGIN/INVOICE)
CREATE TABLE IF NOT EXISTS student_addresses (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'DOMICILE',
  address text, postal_code text,
  province_code text, regency_code text, district_code text, village_code text,
  is_preferred boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_addr_kind UNIQUE (tenant_id, student_id, kind)
);

-- 6. Wali/penjamin mahasiswa
CREATE TABLE IF NOT EXISTS student_guardians (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation text NOT NULL,
  full_name text NOT NULL,
  birth_date date, education text,
  occupation_code text, occupation_name text,
  income_band income_band, income_rupiah bigint,
  phone text, email text,
  is_financial_guarantor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_guardian_rel UNIQUE (tenant_id, student_id, relation)
);

-- 7. RLS FORCE utk semua tabel tenant-scoped baru (konsisten dgn generator 0001; policy TO public)
DO $$
DECLARE t text;
  tables text[] := ARRAY['lecturers','staff','student_addresses','student_guardians'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I;', t);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON public.%I
      AS PERMISSIVE FOR ALL TO public
      USING (tenant_id = app.tenant_id())
      WITH CHECK (tenant_id = app.tenant_id());
    $pol$, t);
  END LOOP;
END $$;
