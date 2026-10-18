-- ==============================================================================
-- SICA Database Migration 0004: Entitlement Modul & Add-on Gating (SaaS packaging)
-- Architecture: PostgreSQL 16 Single Schema Multi-Tenant with Mandatory RLS
-- Rujukan: docs/DATA_MODEL.md §12. (design-locked; perlu dijalankan saat DB tersedia)
-- ==============================================================================

-- 1. Enum (idempoten; skip bila sudah ada)
DO $$ BEGIN
  CREATE TYPE module_category AS ENUM ('CORE','ADDON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE module_license_metric AS ENUM ('INCLUDED','PER_SEAT','FLAT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tenant_module_status AS ENUM ('ACTIVE','TRIAL','PENDING_PAYMENT','DISABLED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Katalog modul GLOBAL (tanpa tenant_id → tidak ikut generator RLS)
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category module_category NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  license_metric module_license_metric NOT NULL DEFAULT 'INCLUDED',
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_modules_category ON modules(category, is_active);

CREATE TABLE IF NOT EXISTS module_dependencies (
  id uuid PRIMARY KEY,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  depends_on_module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_required boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_module_dependency UNIQUE (module_id, depends_on_module_id),
  CONSTRAINT no_self_dependency CHECK (module_id <> depends_on_module_id)
);
CREATE INDEX IF NOT EXISTS idx_module_dep_module ON module_dependencies(module_id);

CREATE TABLE IF NOT EXISTS plan_modules (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  included boolean NOT NULL DEFAULT true,
  seat_limit int,
  price_rupiah_month bigint,
  CONSTRAINT uq_plan_module UNIQUE (plan_id, module_id)
);

-- 3. Activation per-tenant (TENANT-SCOPED → RLS)
CREATE TABLE IF NOT EXISTS tenant_modules (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
  status tenant_module_status NOT NULL DEFAULT 'ACTIVE',
  seats int,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  activated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_module UNIQUE (tenant_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_active ON tenant_modules(tenant_id, status);

-- 4. Seed katalog: 9 Core + 10 Add-on
INSERT INTO modules (id, code, name, category, is_core, license_metric, sort_order) VALUES
  ('0a000000-0000-4000-8000-000000000001','identity','Identitas & Akses','CORE',true,'INCLUDED',10),
  ('0a000000-0000-4000-8000-000000000002','academic','Master Data Akademik','CORE',true,'INCLUDED',20),
  ('0a000000-0000-4000-8000-000000000003','teaching','Pengajaran & Penjadwalan','CORE',true,'INCLUDED',30),
  ('0a000000-0000-4000-8000-000000000004','enrollment','KRS & Approval DPA','CORE',true,'INCLUDED',40),
  ('0a000000-0000-4000-8000-000000000005','attendance','Presensi','CORE',true,'INCLUDED',50),
  ('0a000000-0000-4000-8000-000000000006','assessment','Nilai, KHS & Transkrip','CORE',true,'INCLUDED',60),
  ('0a000000-0000-4000-8000-000000000007','finance','Keuangan & Gerbang KRS','CORE',true,'INCLUDED',70),
  ('0a000000-0000-4000-8000-000000000008','feeder_pddikti','Feeder PDDIKTI','CORE',true,'INCLUDED',80),
  ('0a000000-0000-4000-8000-000000000009','audit','Audit Trail','CORE',true,'INCLUDED',90),
  ('0a000000-0000-4000-8000-000000000010','pmb','PMB & CBT','ADDON',false,'FLAT',110),
  ('0a000000-0000-4000-8000-000000000011','cbt','Computer-Based Test','ADDON',false,'FLAT',111),
  ('0a000000-0000-4000-8000-000000000012','lms','Pembelajaran Daring (LMS)','ADDON',false,'PER_SEAT',120),
  ('0a000000-0000-4000-8000-000000000013','mbkm','MBKM','ADDON',false,'FLAT',130),
  ('0a000000-0000-4000-8000-000000000014','thesis','Tingkat Akhir / Skripsi','ADDON',false,'PER_SEAT',140),
  ('0a000000-0000-4000-8000-000000000015','spmi','SPMI & Akreditasi','ADDON',false,'FLAT',150),
  ('0a000000-0000-4000-8000-000000000016','hr_bkd','SDM / BKD / SISTER','ADDON',false,'PER_SEAT',160),
  ('0a000000-0000-4000-8000-000000000017','parent_portal','Portal Orang Tua','ADDON',false,'INCLUDED',170),
  ('0a000000-0000-4000-8000-000000000018','graduation','Wisuda / SKPI / Legalisir','ADDON',false,'FLAT',180),
  ('0a000000-0000-4000-8000-000000000019','tracer_iku','Tracer Study & IKU','ADDON',false,'FLAT',190)
ON CONFLICT (code) DO NOTHING;

-- 5. Seed graf dependensi (addon → prasyarat required)
INSERT INTO module_dependencies (id, module_id, depends_on_module_id, is_required)
SELECT gen_random_uuid(), m.id, d.id, true
FROM (VALUES
  ('pmb','identity'), ('pmb','academic'),
  ('cbt','identity'),  ('cbt','academic'),
  ('lms','teaching'),  ('lms','enrollment'),
  ('mbkm','enrollment'), ('mbkm','assessment'), ('mbkm','academic'),
  ('thesis','enrollment'), ('thesis','assessment'),
  ('spmi','academic'), ('spmi','assessment'), ('spmi','feeder_pddikti'),
  ('hr_bkd','identity'), ('hr_bkd','teaching'),
  ('parent_portal','enrollment'), ('parent_portal','assessment'), ('parent_portal','finance'),
  ('graduation','assessment'), ('graduation','feeder_pddikti'),
  ('tracer_iku','graduation'), ('tracer_iku','feeder_pddikti')
) AS edges(child_code, parent_code)
JOIN modules m ON m.code = edges.child_code
JOIN modules d ON d.code = edges.parent_code
ON CONFLICT (module_id, depends_on_module_id) DO NOTHING;

-- 6. RLS hanya utk tenant_modules (tabel domain). Katalog global: SELECT-only.
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenant_modules;
CREATE POLICY tenant_isolation ON tenant_modules
  AS PERMISSIVE FOR ALL TO sica_app
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- Katalog global tidak boleh ditulis aplikasi runtime (hanya baca; penulisan via migrasi/operator).
GRANT  SELECT ON modules, module_dependencies, plan_modules TO sica_app;
REVOKE INSERT, UPDATE, DELETE ON modules, module_dependencies, plan_modules FROM sica_app;
