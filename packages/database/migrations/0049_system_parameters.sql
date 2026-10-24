-- ==============================================================================
-- SICA Database Migration 0049: Dynamic Parameter Engine (`master_system_parameters` + riwayat)
-- Rujukan: docs/DATA_MODEL.md §21.2 (DDL), §21.3 (katalog 25 kunci), AGENTS §3.10
--          (parameter operasional juga wajib dinamis), API_SPEC §4.16 (kontrak + error 107–114).
--
-- RALAT terhadap DDL dokumen (dicatat, tidak disenyapkan): §21.2 menaruh
-- `value_num`/`value_bool`/`value_json` SEBELUM `data_type`, padahal PostgreSQL
-- mensyaratkan kolom generated hanya boleh menunjuk kolom yang sudah dideklarasikan
-- sebelumnya. `data_type` karena itu dinaikkan ke atas; nama, tipe, dan CHECK-nya
-- tidak berubah. DDL sumber perlu diselaraskan di `DATA_MODEL §21.2` (gap terbuka).
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM pg_class WHERE relname IN
--     ('master_system_parameters','master_system_parameter_history');              -- 2
--   SELECT count(*) FROM information_schema.columns WHERE table_name='master_system_parameters'
--     AND is_generated='ALWAYS';                                                   -- 3 (value_num/bool/json)
--   SELECT count(*) FROM pg_constraint WHERE conname IN
--     ('ck_param_not_secret','ck_param_not_env','ck_param_regulatory_approver');   -- 3
--   INSERT INTO master_system_parameters(id,tenant_id,module_code,parameter_key,parameter_value,data_type,description,risk_class,is_secret)
--     VALUES (gen_random_uuid(),'<t>','attendance','x','5','INT','d','SECURITY',true);  -- ERROR (is_secret=false)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS master_system_parameters (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_code text NOT NULL,                       -- 'attendance','krs','grading','feeder','finance','pmb','lms','platform'
  parameter_key text NOT NULL,                     -- 'attendance.totp_rotate_seconds' — berawalan modul, stabil
  parameter_value text NOT NULL,
  data_type text NOT NULL CHECK (data_type IN
    ('STRING','REGEX','INT','DECIMAL','PCT','BP','SECONDS','METERS','BOOL','JSON','DATE','TIME','CRON')),
  -- Tiga proyeksi bertipe: pembacaan murah tanpa `float` (AGENTS §3.4 paritas Web↔Mobile).
  value_num numeric GENERATED ALWAYS AS
    (CASE WHEN data_type IN ('INT','DECIMAL','PCT','SECONDS','METERS','BP') THEN parameter_value::numeric END) STORED,
  value_bool boolean GENERATED ALWAYS AS
    (CASE WHEN data_type = 'BOOL' THEN parameter_value::boolean END) STORED,
  value_json jsonb GENERATED ALWAYS AS
    (CASE WHEN data_type = 'JSON' THEN parameter_value::jsonb END) STORED,
  unit text,
  default_value text NOT NULL,
  min_value text, max_value text,
  enum_kind text REFERENCES reference_kinds(kind), -- sumber nilai = DAFTAR kamus, bukan CHECK literal
  description text NOT NULL,                       -- tampil di layar Admin; wajib menyebut efek bila diubah
  risk_class text NOT NULL CHECK (risk_class IN
    ('TECHNICAL','OPS','ACADEMIC','FINANCIAL','REGULATORY','SECURITY')),
  applies_to jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {programIds,sites,programTypes,periods}; kosong = seluruh tenant
  is_editable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  is_secret boolean NOT NULL DEFAULT false,
  requires_restart boolean NOT NULL DEFAULT false, -- true = pelanggaran norma hot-reload; wajib ada catatan deviasi
  source_of_truth text NOT NULL DEFAULT 'PARAM' CHECK (source_of_truth IN
    ('PARAM','academic_rules','reference_items','tenant_custom_attributes','tenant_settings','ENV')),
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  version int NOT NULL DEFAULT 1 CHECK (version > 0),
  requested_by uuid, approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (tenant_id, module_code, parameter_key),
  CONSTRAINT ck_param_not_secret CHECK (is_secret = false),
  CONSTRAINT ck_param_not_env CHECK (source_of_truth <> 'ENV'),
  CHECK (parameter_value ~ '^[^[:cntrl:]]{0,4000}$'),
  -- Kelas REGULATORY/SECURITY menuntut penyetuju kedua yang berbeda dari pemohon.
  CONSTRAINT ck_param_regulatory_approver CHECK (
    risk_class NOT IN ('REGULATORY','SECURITY') OR (approved_by IS NOT NULL AND approved_by <> requested_by)),
  CHECK (enum_kind IS NULL OR data_type IN ('STRING','INT')),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_sysparam_lookup
  ON master_system_parameters(tenant_id, module_code, is_active, parameter_key);
CREATE INDEX IF NOT EXISTS idx_sysparam_scope
  ON master_system_parameters USING gin (applies_to jsonb_path_ops);

ALTER TABLE master_system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_system_parameters FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master_system_parameters;
CREATE POLICY tenant_isolation ON master_system_parameters
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- Riwayat insert-only, beralasan, ber-IP, ber-penyetuju: tanpa ini tidak ada yang bisa
-- merekonstruksi "aturan mana yang berlaku saat itu" (pasangan kewajiban arsip BR-R12).
CREATE TABLE IF NOT EXISTS master_system_parameter_history (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  module_code text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  old_version int,
  new_version int NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  ip inet NOT NULL,
  request_id text,
  source text NOT NULL CHECK (source IN ('UI','API','IMPORT','MIGRATION','SEED')),
  approver_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sysparam_hist
  ON master_system_parameter_history(tenant_id, parameter_key, occurred_at DESC);

ALTER TABLE master_system_parameter_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_system_parameter_history FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master_system_parameter_history;
CREATE POLICY tenant_isolation ON master_system_parameter_history
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());
