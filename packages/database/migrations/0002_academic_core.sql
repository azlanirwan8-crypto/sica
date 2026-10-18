-- ==============================================================================
-- SICA Database Migration 0002: Academic Core Engine & Operation Tables
-- Architecture: PostgreSQL 16 Single Schema Multi-Tenant with Mandatory RLS
-- ==============================================================================

-- 0. Enum types akademik (idempoten; dipakai tabel di bawah tapi sebelumnya tak dibuat)
DO $$ BEGIN CREATE TYPE academic_year_term AS ENUM ('GANJIL','GENAP','ANTAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE period_status AS ENUM ('DRAFT','OPEN','CLOSING','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE student_status AS ENUM ('CANDIDATE','ACTIVE','ON_LEAVE','GRADUATED','DROPPED','STOPPED','TRANSFERRED','EXPELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE enrollment_status AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED','EFFECTIVE','WITHDRAWN','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE grade_status AS ENUM ('EMPTY','DRAFT','SUBMITTED','LOCKED','CORRECTING','CORRECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE attendance_status AS ENUM ('PRESENT','EXCUSED','SICK','ABSENT_LATE','ABSENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Master Akademik: Organisasi, Tahun, dan Periode Akademik
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES organizations(id),
  kind text NOT NULL CHECK (kind IN ('FACULTY', 'DEPARTMENT', 'UNIT', 'LIBRARY', 'HQ')),
  name text NOT NULL,
  code text,
  CONSTRAINT uq_orgs_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_orgs_tenant ON organizations(tenant_id);

CREATE TABLE IF NOT EXISTS academic_years (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  CONSTRAINT uq_academic_years_label UNIQUE (tenant_id, label)
);

CREATE TABLE IF NOT EXISTS academic_periods (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term academic_year_term NOT NULL,
  status period_status NOT NULL DEFAULT 'DRAFT',
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  CHECK (ends_on > starts_on),
  CONSTRAINT uq_academic_periods_term UNIQUE (tenant_id, academic_year_id, term)
);
CREATE INDEX IF NOT EXISTS idx_academic_periods_tenant ON academic_periods(tenant_id);

-- 2. Program Studi & Skala Nilai
CREATE TABLE IF NOT EXISTS study_programs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  code text,
  pddikti_code text,
  level text NOT NULL CHECK (level IN ('D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3', 'PROFESI', 'SPESIALIS')),
  min_total_sks numeric(5,1) NOT NULL,
  nominal_study_semesters int NOT NULL,
  max_study_semesters int NOT NULL,
  sks_cap_lower_semesters numeric(4,1) NOT NULL DEFAULT 20.0,
  sks_cap_upper_semesters numeric(4,1) NOT NULL DEFAULT 24.0,
  sks_cap_between_term numeric(4,1) NOT NULL DEFAULT 9.0,
  graduation_min_ipk numeric(3,2) NOT NULL DEFAULT 2.00,
  accreditation_status text,
  accreditation_expires_on date,
  delivery_mode text NOT NULL DEFAULT 'ONSITE' CHECK (delivery_mode IN ('ONSITE', 'ONLINE', 'HYBRID')),
  allow_auto_class boolean NOT NULL DEFAULT true,
  waitlist_threshold_min int NOT NULL DEFAULT 15,
  max_parallel_classes int NOT NULL DEFAULT 4,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_study_programs_code UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_study_programs_tenant ON study_programs(tenant_id);

CREATE TABLE IF NOT EXISTS grade_scales (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  scale_type text NOT NULL CHECK (scale_type IN ('POINT4', 'POINT4_WITH_MINUS', 'PASS_FAIL', 'NUMERIC_100')),
  is_national_baseline boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_grade_scales_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS grade_scale_bands (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scale_id uuid NOT NULL REFERENCES grade_scales(id) ON DELETE CASCADE,
  min_score numeric(5,2) NOT NULL,
  letter_code text NOT NULL,
  point_value numeric(3,2) NOT NULL,
  is_passing boolean NOT NULL,
  is_default_when_blank boolean NOT NULL DEFAULT false,
  CHECK (min_score >= 0 AND min_score <= 100),
  CONSTRAINT uq_scale_letter UNIQUE (scale_id, letter_code)
);
CREATE INDEX IF NOT EXISTS idx_scale_bands_scale ON grade_scale_bands(scale_id);

-- 3. Kurikulum, Matakuliah, dan Ruang Kuliah
CREATE TABLE IF NOT EXISTS curricula (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES study_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  effective_from date NOT NULL,
  grade_scale_id uuid REFERENCES grade_scales(id),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_curricula_version UNIQUE (tenant_id, program_id, version)
);
CREATE INDEX IF NOT EXISTS idx_curricula_program ON curricula(program_id);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  sks numeric(4,1) NOT NULL CHECK (sks > 0),
  semester_ideal int CHECK (semester_ideal BETWEEN 1 AND 14),
  CONSTRAINT uq_courses_curriculum_code UNIQUE (tenant_id, curriculum_id, code)
);
CREATE INDEX IF NOT EXISTS idx_courses_curriculum ON courses(curriculum_id);

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  building text NOT NULL,
  floor int NOT NULL DEFAULT 1,
  capacity int NOT NULL CHECK (capacity > 0),
  room_type text NOT NULL CHECK (room_type IN ('CLASSROOM', 'LAB', 'AUDITORIUM', 'STUDIO')),
  facilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_rooms_code UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(tenant_id, building, is_active);

-- 4. Operasional Perkuliahan: Mahasiswa, Kelas, Penjadwalan & Sesi
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES tenant_memberships(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES study_programs(id),
  curriculum_id uuid REFERENCES curricula(id),
  nim text NOT NULL,
  full_name text NOT NULL,
  entry_year int NOT NULL,
  entry_route text,
  status student_status NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT uq_students_nim UNIQUE (tenant_id, nim),
  CONSTRAINT uq_students_membership UNIQUE (tenant_id, membership_id)
);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(tenant_id, program_id, status);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES study_programs(id),
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  name text NOT NULL,
  capacity int NOT NULL CHECK (capacity > 0),
  enrolled_count int NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  CHECK (enrolled_count <= capacity),
  status text NOT NULL DEFAULT 'OPEN',
  delivery_mode text NOT NULL DEFAULT 'ONSITE' CHECK (delivery_mode IN ('ONSITE', 'ONLINE_SYNC', 'ONLINE_ASYNC')),
  virtual_meeting_provider text CHECK (virtual_meeting_provider IN ('ZOOM', 'GOOGLE_MEET', 'TEAMS', 'BUILTIN_LMS')),
  virtual_meeting_url text,
  is_auto_generated boolean NOT NULL DEFAULT false,
  parent_class_id uuid REFERENCES classes(id),
  CONSTRAINT uq_classes_course_name UNIQUE (tenant_id, period_id, course_id, name)
);
CREATE INDEX IF NOT EXISTS idx_classes_open ON classes(tenant_id, period_id, program_id);

CREATE TABLE IF NOT EXISTS class_assignments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lecturer_membership_id uuid NOT NULL REFERENCES tenant_memberships(id) ON DELETE CASCADE,
  role_in_class text NOT NULL CHECK (role_in_class IN ('COORDINATOR', 'LECTURER', 'LAB_ASSIST', 'EXAMINER', 'ADVISER')),
  CONSTRAINT uq_class_assignments UNIQUE (class_id, lecturer_membership_id, role_in_class)
);

CREATE TABLE IF NOT EXISTS class_schedules (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time),
  CONSTRAINT uq_class_schedules UNIQUE (class_id, day_of_week, start_time)
);
CREATE INDEX IF NOT EXISTS idx_schedules_lookup ON class_schedules(tenant_id, room_id, day_of_week, start_time, end_time);

CREATE TABLE IF NOT EXISTS class_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  held_on date NOT NULL,
  seq int NOT NULL CHECK (seq > 0),
  topic text,
  delivery_type text NOT NULL DEFAULT 'ONSITE' CHECK (delivery_type IN ('ONSITE', 'SYNC_LIVE', 'ASYNC_MODULE')),
  virtual_room_url text,
  duration_minutes int NOT NULL DEFAULT 100,
  is_attendance_open boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_class_sessions_seq UNIQUE (class_id, seq)
);

CREATE TABLE IF NOT EXISTS class_waitlists (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  academic_period_id uuid NOT NULL REFERENCES academic_periods(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  target_class_id uuid REFERENCES classes(id),
  student_id uuid NOT NULL REFERENCES students(id),
  queue_number integer NOT NULL,
  held_credits numeric(4,1) NOT NULL,
  status text NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'PROMOTED', 'EXPIRED', 'CANCELLED')),
  promoted_class_id uuid REFERENCES classes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_waitlists_student_course UNIQUE (tenant_id, academic_period_id, course_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_waitlists_queue ON class_waitlists(tenant_id, academic_period_id, course_id, status, queue_number);

-- 5. Transaksi Akademik: Enrollment (KRS), Presensi, Komposisi Nilai, dan KHS
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  status enrollment_status NOT NULL DEFAULT 'DRAFT',
  submitted_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_enrollments_student_class UNIQUE (tenant_id, student_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_enroll_period ON enrollments(tenant_id, period_id, student_id);
CREATE INDEX IF NOT EXISTS idx_enroll_class_slot ON enrollments(class_id, status);

CREATE TABLE IF NOT EXISTS attendances (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  present boolean NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_attendances_session_student UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS grade_components (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id),
  class_id uuid REFERENCES classes(id),
  code text NOT NULL,
  name text NOT NULL,
  weight_pct numeric(5,2) NOT NULL CHECK (weight_pct BETWEEN 0 AND 100),
  is_mandatory boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 1,
  CHECK (course_id IS NOT NULL OR class_id IS NOT NULL),
  CONSTRAINT uq_grade_comp_class_code UNIQUE (class_id, code),
  CONSTRAINT uq_grade_comp_course_code UNIQUE (course_id, code)
);

CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES academic_periods(id),
  raw_score numeric(5,2) CHECK (raw_score BETWEEN 0 AND 100),
  letter_code text,
  point_value numeric(3,2),
  status grade_status NOT NULL DEFAULT 'DRAFT',
  locked_at timestamptz,
  locked_by uuid,
  version int NOT NULL DEFAULT 0,
  CONSTRAINT uq_grades_enrollment UNIQUE (tenant_id, enrollment_id)
);
CREATE INDEX IF NOT EXISTS idx_grades_period ON grades(tenant_id, period_id, status);

CREATE TABLE IF NOT EXISTS grade_corrections (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grade_id uuid NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  reason text NOT NULL CHECK (length(reason) >= 15),
  old_letter text,
  new_letter text,
  old_point numeric(3,2),
  new_point numeric(3,2),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED'))
);
CREATE INDEX IF NOT EXISTS idx_grade_corrections_grade ON grade_corrections(grade_id);

-- 6. Penegakan PostgreSQL Row-Level Security (RLS) di Seluruh Tabel Akademik
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'organizations',
    'academic_years',
    'academic_periods',
    'study_programs',
    'grade_scales',
    'grade_scale_bands',
    'curricula',
    'courses',
    'rooms',
    'students',
    'classes',
    'class_assignments',
    'class_schedules',
    'class_sessions',
    'class_waitlists',
    'enrollments',
    'attendances',
    'grade_components',
    'grades',
    'grade_corrections'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I;', t);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON public.%I
      AS PERMISSIVE FOR ALL
      TO public
      USING (tenant_id = app.tenant_id())
      WITH CHECK (tenant_id = app.tenant_id());
    $pol$, t);
  END LOOP;
END $$;
